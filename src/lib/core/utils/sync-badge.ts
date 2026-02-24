import type { SyncStatus } from "$lib/core/storage/types";

type SyncBadgeStatus = Pick<
  SyncStatus,
  "state" | "pendingCount" | "lastSuccessAt"
>;
type SyncTimestampFormatter = (timestamp: number | null) => string;

export const formatSyncTimestamp = (timestamp: number | null): string => {
  if (!timestamp) {
    return "Never";
  }
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "Unknown";
  }
};

export const resolveSyncBadgeLabel = (state: SyncStatus["state"]): string => {
  if (state === "syncing") {
    return "Syncing";
  }
  if (state === "offline") {
    return "Offline";
  }
  if (state === "error") {
    return "Needs attention";
  }
  return "Idle";
};

export const resolveSyncBadgeDetail = (
  status: SyncBadgeStatus,
  formatTimestamp: SyncTimestampFormatter = formatSyncTimestamp
): string =>
  status.pendingCount > 0
    ? `${status.pendingCount} pending`
    : `Last sync: ${formatTimestamp(status.lastSuccessAt)}`;

export const resolveSyncBadgeText = (
  status: SyncBadgeStatus,
  formatTimestamp: SyncTimestampFormatter = formatSyncTimestamp
): string =>
  `${resolveSyncBadgeLabel(status.state)}: ${resolveSyncBadgeDetail(status, formatTimestamp)}`;
