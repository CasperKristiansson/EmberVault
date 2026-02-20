export type S3Draft = {
  bucket: string;
  region: string;
  prefix: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

const storageKey = "embervault:s3-draft";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasString = (value: Record<string, unknown>, key: string): boolean =>
  typeof value[key] === "string";

const isS3Draft = (value: unknown): value is S3Draft => {
  if (!isRecord(value)) {
    return false;
  }
  const keys: (keyof S3Draft)[] = [
    "bucket",
    "region",
    "prefix",
    "accessKeyId",
    "secretAccessKey",
    "sessionToken",
  ];
  for (const key of keys) {
    if (!hasString(value, key)) {
      return false;
    }
  }
  return true;
};

const getLocalStorage = (): Storage | null => {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
};

export const readS3Draft = (): S3Draft | null => {
  const localStorage = getLocalStorage();
  if (!localStorage) {
    return null;
  }
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isS3Draft(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeS3Draft = (draft: S3Draft): void => {
  const localStorage = getLocalStorage();
  if (!localStorage) {
    return;
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Ignore quota/security errors and keep app usable.
  }
};
