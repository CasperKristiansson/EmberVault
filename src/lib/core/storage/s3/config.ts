import type { S3Config } from "../types";

export const normalizeS3BucketName = (bucket: string): string => {
  const trimmed = bucket.trim();
  const withoutScheme = trimmed.replace(/^s3:\/\//iu, "");
  const [bucketName] = withoutScheme.split("/");
  return bucketName.trim();
};

export const normalizeS3ConfigInput = (config: S3Config): S3Config => ({
  bucket: normalizeS3BucketName(config.bucket),
  region: config.region.trim(),
  prefix: config.prefix?.trim() ? config.prefix.trim() : undefined,
  accessKeyId: config.accessKeyId.trim(),
  secretAccessKey: config.secretAccessKey.trim(),
  sessionToken: config.sessionToken?.trim()
    ? config.sessionToken.trim()
    : undefined,
});
