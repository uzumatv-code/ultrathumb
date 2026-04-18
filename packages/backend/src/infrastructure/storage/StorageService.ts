// =============================================================================
// ThumbForge AI — Storage Service (MinIO / S3-compatible)
// =============================================================================

import * as Minio from 'minio';
import { logger } from '../../shared/utils/logger.js';
import { StorageError } from '../../shared/errors/AppError.js';

export interface UploadOptions {
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StorageFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export class StorageService {
  private client: Minio.Client;
  private readonly bucketPrivate: string;
  private readonly bucketPublic: string;
  private readonly bucketAssets: string;
  private readonly publicUrl: string;
  private initialized = false;

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env['STORAGE_ENDPOINT'] ?? 'localhost',
      port: parseInt(process.env['STORAGE_PORT'] ?? '9000'),
      useSSL: process.env['STORAGE_USE_SSL'] === 'true',
      accessKey: process.env['STORAGE_ACCESS_KEY'] ?? '',
      secretKey: process.env['STORAGE_SECRET_KEY'] ?? '',
      region: process.env['STORAGE_REGION'] ?? 'us-east-1',
    });

    this.bucketPrivate = process.env['STORAGE_BUCKET_PRIVATE'] ?? 'thumbforge-private';
    this.bucketPublic = process.env['STORAGE_BUCKET_PUBLIC'] ?? 'thumbforge-public';
    this.bucketAssets = process.env['STORAGE_BUCKET_ASSETS'] ?? 'thumbforge-assets';
    this.publicUrl = this.normalizePublicBaseUrl(
      process.env['STORAGE_PUBLIC_URL'] ?? 'http://localhost:9000/thumbforge-public',
      this.bucketPublic,
    );
  }

  private normalizePublicBaseUrl(baseUrl: string, bucketName: string): string {
    const trimmedBaseUrl = baseUrl.replace(/\/+$/, '');

    try {
      const parsed = new URL(trimmedBaseUrl);
      const pathSegments = parsed.pathname.split('/').filter(Boolean);
      const hostIncludesBucket =
        parsed.hostname === bucketName || parsed.hostname.startsWith(`${bucketName}.`);

      if (!hostIncludesBucket && pathSegments[0] !== bucketName) {
        parsed.pathname = `/${[bucketName, ...pathSegments].join('/')}`;
      } else {
        parsed.pathname = pathSegments.length ? `/${pathSegments.join('/')}` : '';
      }

      return parsed.toString().replace(/\/+$/, '');
    } catch {
      if (trimmedBaseUrl.endsWith(`/${bucketName}`) || trimmedBaseUrl === bucketName) {
        return trimmedBaseUrl;
      }
      return `${trimmedBaseUrl}/${bucketName}`;
    }
  }

  getPublicObjectUrl(key: string): string {
    return `${this.publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const buckets = [
      { name: this.bucketPrivate, isPublic: false },
      { name: this.bucketPublic, isPublic: true },
      { name: this.bucketAssets, isPublic: true },
    ];

    for (const bucket of buckets) {
      const exists = await this.client.bucketExists(bucket.name);
      if (!exists) {
        await this.client.makeBucket(bucket.name);
        logger.info({ bucket: bucket.name }, 'Storage bucket created');

        if (bucket.isPublic) {
          const policy = {
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket.name}/*`],
            }],
          };
          await this.client.setBucketPolicy(bucket.name, JSON.stringify(policy));
        }
      }
    }

    this.initialized = true;
    logger.info('Storage initialized');
  }

  // ─── Upload ───────────────────────────────────────────────────────────────

  async uploadPrivate(
    key: string,
    buffer: Buffer,
    options: UploadOptions,
  ): Promise<string> {
    try {
      await this.client.putObject(this.bucketPrivate, key, buffer, buffer.length, {
        'Content-Type': options.contentType,
        ...options.metadata,
      });
      return key;
    } catch (err) {
      logger.error({ err, key }, 'Failed to upload private file');
      throw new StorageError(`Failed to upload file: ${key}`);
    }
  }

  async uploadPublic(
    key: string,
    buffer: Buffer,
    options: UploadOptions,
  ): Promise<string> {
    try {
      await this.client.putObject(this.bucketPublic, key, buffer, buffer.length, {
        'Content-Type': options.contentType,
        ...options.metadata,
      });
      return this.getPublicObjectUrl(key);
    } catch (err) {
      logger.error({ err, key }, 'Failed to upload public file');
      throw new StorageError(`Failed to upload file: ${key}`);
    }
  }

  // ─── Download ─────────────────────────────────────────────────────────────

  async getObject(bucket: string, key: string): Promise<Buffer> {
    try {
      const stream = await this.client.getObject(bucket, key);
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (err) {
      logger.error({ err, key }, 'Failed to get object');
      throw new StorageError(`Failed to get file: ${key}`);
    }
  }

  async getPrivateObject(key: string): Promise<Buffer> {
    return this.getObject(this.bucketPrivate, key);
  }

  // ─── Presigned URLs ───────────────────────────────────────────────────────

  async getPresignedDownloadUrl(
    key: string,
    expiresSeconds = 900, // 15 minutes
    filename?: string,
  ): Promise<string> {
    try {
      const reqParams: Record<string, string> = {};
      if (filename) {
        reqParams['response-content-disposition'] =
          `attachment; filename="${encodeURIComponent(filename)}"`;
      }
      return await this.client.presignedGetObject(
        this.bucketPrivate,
        key,
        expiresSeconds,
        reqParams,
      );
    } catch (err) {
      logger.error({ err, key }, 'Failed to generate presigned URL');
      throw new StorageError(`Failed to generate download URL for: ${key}`);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deletePrivate(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketPrivate, key);
    } catch (err) {
      logger.error({ err, key }, 'Failed to delete private file');
    }
  }

  async deletePublic(key: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketPublic, key);
    } catch (err) {
      logger.error({ err, key }, 'Failed to delete public file');
    }
  }

  // ─── Path Builders ────────────────────────────────────────────────────────

  buildInputPath(tenantId: string, generationId: string, filename: string): string {
    return `${tenantId}/${generationId}/input/${filename}`;
  }

  buildOutputPath(tenantId: string, generationId: string, variantIndex: number): string {
    return `${tenantId}/${generationId}/output/variant_${variantIndex}_hd.webp`;
  }

  buildProcessedAssetPath(
    tenantId: string,
    generationId: string,
    assetKey: string,
    extension: string,
  ): string {
    return `${tenantId}/${generationId}/processed/${assetKey}.${extension.replace(/^\./, '')}`;
  }

  buildPreviewPath(tenantId: string, generationId: string, variantIndex: number): string {
    return `${tenantId}/${generationId}/variant_${variantIndex}_preview.webp`;
  }

  buildThumbnailPath(tenantId: string, generationId: string, variantIndex: number): string {
    return `${tenantId}/${generationId}/thumbnails/variant_${variantIndex}_thumb.webp`;
  }
}

// Singleton
export const storageService = new StorageService();
