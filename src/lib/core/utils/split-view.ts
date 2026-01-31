export type ResolveSecondaryNoteIdInput = {
  availableIds: string[];
  primaryId: string | null;
  preferredId: string | null;
  fallbackIds?: string[];
};

export const resolveSecondaryNoteId = (
  input: ResolveSecondaryNoteIdInput
): string | null => {
  const { availableIds, primaryId, preferredId, fallbackIds = [] } = input;
  const availableSet = new Set(availableIds);
  const isValid = (id: string | null | undefined): id is string =>
    typeof id === "string" && availableSet.has(id) && id !== primaryId;

  if (isValid(preferredId)) {
    return preferredId;
  }

  for (const candidate of fallbackIds) {
    if (isValid(candidate)) {
      return candidate;
    }
  }

  for (const candidate of availableIds) {
    if (isValid(candidate)) {
      return candidate;
    }
  }

  return null;
};
