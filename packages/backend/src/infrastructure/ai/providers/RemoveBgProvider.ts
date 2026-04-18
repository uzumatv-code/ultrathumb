// =============================================================================
// ThumbForge AI — Background Removal Provider
// Lightweight local cutout using edge color estimation + alpha matting.
// This keeps composition mode functional without requiring a paid third-party API.
// =============================================================================

import sharp from 'sharp';
import { logger } from '../../../shared/utils/logger.js';

export interface BackgroundRemovalResult {
  imageBuffer: Buffer;
  width: number;
  height: number;
  mimeType: 'image/png';
  provider: string;
}

type RawImage = {
  data: Buffer;
  width: number;
  height: number;
};

export class RemoveBgProvider {
  readonly name = 'sharp-cutout';
  private readonly threshold = parseInt(process.env['REMOVE_BG_THRESHOLD'] ?? '40');
  private readonly softness = parseInt(process.env['REMOVE_BG_SOFTNESS'] ?? '28');

  async removeBackground(sourceBuffer: Buffer): Promise<BackgroundRemovalResult> {
    const normalized = await sharp(sourceBuffer)
      .rotate()
      .ensureAlpha()
      .png()
      .toBuffer();

    const raw = await this.toRawImage(normalized);
    const backgroundColor = this.estimateBackgroundColor(raw);
    const composited = Buffer.alloc(raw.data.length);

    for (let index = 0; index < raw.data.length; index += 4) {
      const r = raw.data[index] ?? 0;
      const g = raw.data[index + 1] ?? 0;
      const b = raw.data[index + 2] ?? 0;
      const a = raw.data[index + 3] ?? 255;

      const distance = this.colorDistance([r, g, b], backgroundColor);
      const alpha = this.resolveAlpha(distance, a);

      composited[index] = r;
      composited[index + 1] = g;
      composited[index + 2] = b;
      composited[index + 3] = alpha;
    }

    const base = sharp(composited, {
      raw: {
        width: raw.width,
        height: raw.height,
        channels: 4,
      },
    });

    let output = await base.png().toBuffer();

    try {
      output = await sharp(output).trim().png().toBuffer();
    } catch {
      // Keep the padded result when trim cannot find a solid edge.
    }

    const metadata = await sharp(output).metadata();
    logger.debug(
      {
        provider: this.name,
        width: metadata.width,
        height: metadata.height,
      },
      'Background removal completed',
    );

    return {
      imageBuffer: output,
      width: metadata.width ?? raw.width,
      height: metadata.height ?? raw.height,
      mimeType: 'image/png',
      provider: this.name,
    };
  }

  private async toRawImage(buffer: Buffer): Promise<RawImage> {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return {
      data,
      width: info.width,
      height: info.height,
    };
  }

  private estimateBackgroundColor(image: RawImage): [number, number, number] {
    const samples: Array<[number, number, number]> = [];
    const borderStep = Math.max(1, Math.round(Math.min(image.width, image.height) / 40));

    for (let x = 0; x < image.width; x += borderStep) {
      samples.push(this.readPixel(image, x, 0));
      samples.push(this.readPixel(image, x, image.height - 1));
    }

    for (let y = 0; y < image.height; y += borderStep) {
      samples.push(this.readPixel(image, 0, y));
      samples.push(this.readPixel(image, image.width - 1, y));
    }

    const sums = samples.reduce(
      (acc, sample) => {
        acc[0] += sample[0];
        acc[1] += sample[1];
        acc[2] += sample[2];
        return acc;
      },
      [0, 0, 0],
    );

    const count = Math.max(samples.length, 1);
    return [
      Math.round(sums[0] / count),
      Math.round(sums[1] / count),
      Math.round(sums[2] / count),
    ];
  }

  private readPixel(image: RawImage, x: number, y: number): [number, number, number] {
    const clampedX = Math.max(0, Math.min(image.width - 1, x));
    const clampedY = Math.max(0, Math.min(image.height - 1, y));
    const offset = (clampedY * image.width + clampedX) * 4;

    return [
      image.data[offset] ?? 0,
      image.data[offset + 1] ?? 0,
      image.data[offset + 2] ?? 0,
    ];
  }

  private colorDistance(pixel: [number, number, number], background: [number, number, number]): number {
    const dr = pixel[0] - background[0];
    const dg = pixel[1] - background[1];
    const db = pixel[2] - background[2];
    return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
  }

  private resolveAlpha(distance: number, sourceAlpha: number): number {
    if (distance <= this.threshold) {
      return 0;
    }

    if (distance >= this.threshold + this.softness) {
      return sourceAlpha;
    }

    const ratio = (distance - this.threshold) / Math.max(this.softness, 1);
    return Math.max(0, Math.min(255, Math.round(sourceAlpha * ratio)));
  }
}
