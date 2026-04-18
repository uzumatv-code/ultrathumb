// =============================================================================
// ThumbForge AI — Compositor Service
// Layer-based thumbnail compositing with sharp.
// =============================================================================

import sharp, { type Blend } from 'sharp';
import type { CompositionDividerStyle, CompositionTextLayer } from '@thumbforge/shared';

export interface LayerShadowOptions {
  color: string;
  blur?: number | undefined;
  opacity?: number | undefined;
  offsetX?: number | undefined;
  offsetY?: number | undefined;
}

export interface CompositionLayerInput {
  name: string;
  kind: 'image' | 'divider' | 'text';
  zIndex: number;
  x: number;
  y: number;
  width?: number | undefined;
  height?: number | undefined;
  opacity?: number | undefined;
  blendMode?: Blend | undefined;
  fit?: 'cover' | 'contain' | 'fill' | undefined;
  blurPx?: number | undefined;
  brightness?: number | undefined;
  saturation?: number | undefined;
  buffer?: Buffer | undefined;
  svg?: string | undefined;
  rimLight?: LayerShadowOptions | undefined;
  dropShadow?: LayerShadowOptions | undefined;
  isVisible?: boolean | undefined;
}

export interface ComposeRequest {
  width: number;
  height: number;
  background?: string | undefined;
  dividerStyle?: CompositionDividerStyle | undefined;
  layers: CompositionLayerInput[];
  textLayers?: CompositionTextLayer[] | undefined;
}

export interface ComposeResult {
  buffer: Buffer;
  layers: Array<{
    name: string;
    zIndex: number;
    blendMode: string;
    x: number;
    y: number;
    width?: number | undefined;
    height?: number | undefined;
  }>;
}

type PreparedLayer = {
  input: Buffer;
  left: number;
  top: number;
  blend: Blend;
};

export class CompositorService {
  async compose(request: ComposeRequest): Promise<ComposeResult> {
    const sortedLayers = request.layers
      .filter((layer) => layer.isVisible !== false)
      .sort((left, right) => left.zIndex - right.zIndex);

    const textLayers = request.textLayers ?? [];
    const composites: PreparedLayer[] = [];
    const renderedLayers: ComposeResult['layers'] = [];

    for (const layer of sortedLayers) {
      const prepared = await this.prepareLayer(layer, request.width, request.height);
      composites.push(...prepared);
      renderedLayers.push({
        name: layer.name,
        zIndex: layer.zIndex,
        blendMode: layer.blendMode ?? 'over',
        x: layer.x,
        y: layer.y,
        ...(layer.width ? { width: layer.width } : {}),
        ...(layer.height ? { height: layer.height } : {}),
      });
    }

    for (const [index, textLayer] of textLayers.entries()) {
      const svg = this.buildTextSvg(textLayer);
      composites.push({
        input: Buffer.from(svg),
        left: Math.round(textLayer.x),
        top: Math.round(textLayer.y),
        blend: 'over',
      });
      renderedLayers.push({
        name: `text_${index + 1}`,
        zIndex: 900 + index,
        blendMode: 'over',
        x: Math.round(textLayer.x),
        y: Math.round(textLayer.y),
        ...(textLayer.width ? { width: textLayer.width } : {}),
      });
    }

    const canvas = sharp({
      create: {
        width: request.width,
        height: request.height,
        channels: 4,
        background: request.background ?? '#000000',
      },
    });

    const buffer = await canvas
      .composite(composites)
      .webp({ quality: 92 })
      .toBuffer();

    return {
      buffer,
      layers: renderedLayers,
    };
  }

  buildDividerLayer(
    width: number,
    height: number,
    style: CompositionDividerStyle = 'diagonal',
  ): CompositionLayerInput {
    return {
      name: 'divider',
      kind: 'divider',
      zIndex: 20,
      x: 0,
      y: 0,
      width,
      height,
      svg: this.buildDividerSvg(width, height, style),
    };
  }

  private async prepareLayer(
    layer: CompositionLayerInput,
    canvasWidth: number,
    canvasHeight: number,
  ): Promise<PreparedLayer[]> {
    if (layer.kind === 'divider' || layer.kind === 'text') {
      const svg = layer.svg ?? this.buildDividerSvg(
        layer.width ?? canvasWidth,
        layer.height ?? canvasHeight,
        'diagonal',
      );
      return [{
        input: Buffer.from(svg),
        left: Math.round(layer.x),
        top: Math.round(layer.y),
        blend: layer.blendMode ?? 'over',
      }];
    }

    if (!layer.buffer) {
      return [];
    }

    const preparedBuffer = await this.prepareImage(layer);
    const preparedLayers: PreparedLayer[] = [];

    if (layer.rimLight) {
      const rim = await this.createGlowFromAlpha(preparedBuffer, layer.rimLight);
      preparedLayers.push({
        input: rim,
        left: Math.round(layer.x + (layer.rimLight.offsetX ?? 0)),
        top: Math.round(layer.y + (layer.rimLight.offsetY ?? 0)),
        blend: 'screen',
      });
    }

    if (layer.dropShadow) {
      const shadow = await this.createGlowFromAlpha(preparedBuffer, layer.dropShadow);
      preparedLayers.push({
        input: shadow,
        left: Math.round(layer.x + (layer.dropShadow.offsetX ?? 0)),
        top: Math.round(layer.y + (layer.dropShadow.offsetY ?? 0)),
        blend: 'multiply',
      });
    }

    preparedLayers.push({
      input: preparedBuffer,
      left: Math.round(layer.x),
      top: Math.round(layer.y),
      blend: layer.blendMode ?? 'over',
    });

    return preparedLayers;
  }

  private async prepareImage(layer: CompositionLayerInput): Promise<Buffer> {
    if (!layer.buffer) {
      throw new Error(`Layer ${layer.name} does not have a source buffer`);
    }

    let pipeline = sharp(layer.buffer).rotate().ensureAlpha();

    if (layer.width || layer.height) {
      pipeline = pipeline.resize(layer.width, layer.height, {
        fit: layer.fit ?? 'contain',
        withoutEnlargement: false,
      });
    }

    if (layer.blurPx && layer.blurPx > 0) {
      pipeline = pipeline.blur(layer.blurPx);
    }

    if (layer.brightness || layer.saturation) {
      pipeline = pipeline.modulate({
        brightness: layer.brightness ?? 1,
        saturation: layer.saturation ?? 1,
      });
    }

    if (typeof layer.opacity === 'number' && layer.opacity < 1) {
      pipeline = pipeline.ensureAlpha(layer.opacity);
    }

    return pipeline.png().toBuffer();
  }

  private async createGlowFromAlpha(buffer: Buffer, options: LayerShadowOptions): Promise<Buffer> {
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 1;
    const height = meta.height ?? 1;
    const alphaMask = await sharp(buffer)
      .ensureAlpha()
      .extractChannel('alpha')
      .blur(options.blur ?? 16)
      .png()
      .toBuffer();

    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: this.hexToRgba(options.color, options.opacity ?? 0.85),
      },
    })
      .composite([{ input: alphaMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  private buildDividerSvg(width: number, height: number, style: CompositionDividerStyle): string {
    if (style === 'hard-split') {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <rect x="${Math.round(width / 2) - 2}" y="0" width="4" height="${height}" fill="rgba(255,255,255,0.55)" />
        </svg>
      `;
    }

    if (style === 'gradient') {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <defs>
            <linearGradient id="divider" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="45%" stop-color="rgba(255,255,255,0)" />
              <stop offset="50%" stop-color="rgba(255,255,255,0.8)" />
              <stop offset="55%" stop-color="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#divider)" />
        </svg>
      `;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <linearGradient id="diag" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="47%" stop-color="rgba(255,255,255,0)" />
            <stop offset="50%" stop-color="rgba(255,255,255,0.92)" />
            <stop offset="53%" stop-color="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <polygon points="0,${height} ${Math.round(width * 0.55)},0 ${Math.round(width * 0.65)},0 ${Math.round(width * 0.1)},${height}" fill="url(#diag)" />
      </svg>
    `;
  }

  private buildTextSvg(layer: CompositionTextLayer): string {
    const text = this.escapeXml(layer.uppercase ? layer.text.toUpperCase() : layer.text);
    const fontWeight = layer.fontWeight === 'black' ? 900 : layer.fontWeight === 'bold' ? 700 : 500;
    const width = Math.round(layer.width ?? Math.max(400, (text.length + 2) * layer.fontSize));
    const height = Math.round(layer.fontSize * 1.8);
    const anchor = layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start';
    const textX = layer.align === 'center' ? width / 2 : layer.align === 'right' ? width - 8 : 8;
    const textY = Math.round(layer.fontSize * 1.25);
    const shadowId = `shadow-${Math.abs(textX)}-${Math.abs(textY)}`;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <filter id="${shadowId}" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="${layer.shadowBlur ?? 0}" flood-color="${layer.shadowColor ?? '#000000'}" flood-opacity="0.85" />
          </filter>
        </defs>
        <text
          x="${textX}"
          y="${textY}"
          text-anchor="${anchor}"
          font-family="${this.escapeXml(layer.fontFamily ?? 'Arial Black')}"
          font-size="${layer.fontSize}"
          font-weight="${fontWeight}"
          letter-spacing="${layer.letterSpacing ?? 0}"
          fill="${layer.fill}"
          stroke="${layer.stroke ?? 'transparent'}"
          stroke-width="${layer.strokeWidth ?? 0}"
          paint-order="stroke"
          filter="url(#${shadowId})"
        >${text}</text>
      </svg>
    `;
  }

  private hexToRgba(hex: string, alpha: number): string {
    const sanitized = hex.replace('#', '');
    const normalized = sanitized.length === 3
      ? sanitized.split('').map((char) => `${char}${char}`).join('')
      : sanitized;

    const red = parseInt(normalized.slice(0, 2), 16) || 0;
    const green = parseInt(normalized.slice(2, 4), 16) || 0;
    const blue = parseInt(normalized.slice(4, 6), 16) || 0;

    return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(alpha, 1))})`;
  }

  private escapeXml(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&apos;');
  }
}
