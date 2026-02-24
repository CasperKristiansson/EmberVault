export const skipLandingAutoRedirectSessionKey =
  "embervault_skip_landing_redirect_once";

type StoredVaultSession = {
  storageMode?: "filesystem" | "idb" | "s3";
  fsHandle?: unknown;
  s3?: unknown;
};

type SessionStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const hasStoredVaultSession = <
  T extends StoredVaultSession | null | undefined,
>(
  settings: T
): settings is Exclude<T, null | undefined> => {
  if (!settings?.storageMode) {
    return false;
  }
  if (settings.storageMode === "filesystem") {
    return Boolean(settings.fsHandle);
  }
  if (settings.storageMode === "s3") {
    return Boolean(settings.s3);
  }
  return true;
};

export const markSkipLandingAutoRedirectOnce = (
  storage: SessionStorageLike | null | undefined
): void => {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(skipLandingAutoRedirectSessionKey, "1");
  } catch {
    // Ignore storage write failures and keep default redirect behavior.
  }
};

export const consumeSkipLandingAutoRedirect = (
  storage: SessionStorageLike | null | undefined
): boolean => {
  if (!storage) {
    return false;
  }
  try {
    if (storage.getItem(skipLandingAutoRedirectSessionKey) !== "1") {
      return false;
    }
    storage.removeItem(skipLandingAutoRedirectSessionKey);
    return true;
  } catch {
    return false;
  }
};
