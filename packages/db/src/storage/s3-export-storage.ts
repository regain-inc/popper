/**
 * S3-compatible export bundle storage (MinIO)
 *
 * Implements IExportBundleStorage from @popper/core for production use.
 * Uses AWS SDK v3 configured for MinIO with:
 * - forcePathStyle: true (required for MinIO)
 * - ServerSideEncryption: AES256 (encrypt at rest)
 * - Presigned URLs for secure downloads
 *
 * @module storage/s3-export-storage
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3ExportStorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  forcePathStyle?: boolean;
}

/**
 * S3ExportBundleStorage — Production export storage using S3/MinIO
 *
 * Stores regulatory export bundles encrypted at rest.
 * URI scheme: s3://bucket/exports/{bundleId}
 */
export class S3ExportBundleStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3ExportStorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region ?? 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle ?? true,
    });
  }

  async upload(bundleId: string, data: Buffer, contentType: string): Promise<string> {
    const key = `exports/${bundleId}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );

    return `s3://${this.bucket}/${key}`;
  }

  async download(storageUri: string): Promise<Buffer> {
    const { bucket, key } = this.parseUri(storageUri);

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Empty response for: ${storageUri}`);
    }

    return Buffer.from(bytes);
  }

  async delete(storageUri: string): Promise<void> {
    const { bucket, key } = this.parseUri(storageUri);

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  async getDownloadUrl(storageUri: string, expiresIn: number): Promise<string> {
    const { bucket, key } = this.parseUri(storageUri);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  private parseUri(uri: string): { bucket: string; key: string } {
    const match = uri.match(/^s3:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid S3 URI: ${uri}`);
    }
    return { bucket: match[1], key: match[2] };
  }
}
