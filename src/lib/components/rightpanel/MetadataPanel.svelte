<script lang="ts">
  import type {
    CustomFieldValue,
    NoteDocumentFile,
    Vault,
  } from "$lib/core/storage/types";
  import { createCustomFieldKey } from "$lib/core/utils/custom-fields";
  import CustomFieldEditor from "$lib/components/rightpanel/CustomFieldEditor.svelte";
  import BacklinksPanel from "$lib/components/rightpanel/BacklinksPanel.svelte";
  import type { BacklinkSnippet } from "$lib/core/editor/links/backlinks";

  export let note: NoteDocumentFile | null = null;
  export let vault: Vault | null = null;
  export let linkedMentions: Array<{
    id: string;
    title: string;
    snippet: BacklinkSnippet | null;
  }> = [];
  export let unlinkedMentions: Array<{
    id: string;
    title: string;
    snippet: BacklinkSnippet | null;
  }> = [];
  export let backlinksLoading = false;
  export let unlinkedMentionsLoading = false;
  export let onOpenNote: (noteId: string) => void = () => {};
  export let onResolveWikiLink: (
    raw: string,
    targetId: string
  ) => void | Promise<void> = async () => {};
  export let onNormalizeWikiLinks: (
    replacements: Array<{ raw: string; targetId: string }>
  ) => void | Promise<void> = async () => {};
  export let onCreateNoteForWikiLink: (title: string) => Promise<string> =
    async () => "";
  export let onUpdateCustomFields: (
    noteId: string,
    fields: Record<string, CustomFieldValue>
  ) => void = () => {};

  const formatTimestamp = (timestamp: number): string =>
    new Date(timestamp).toLocaleString();

  const resolveFolderName = (noteValue: NoteDocumentFile): string => {
    if (!noteValue.folderId) {
      return "No folder";
    }
    const resolved = vault?.folders[noteValue.folderId]?.name;
    return resolved ?? "Unknown folder";
  };

  const resolveTagNames = (noteValue: NoteDocumentFile): string => {
    if (noteValue.tagIds.length === 0) {
      return "No tags";
    }
    return noteValue.tagIds
      .map((tagId) => vault?.tags[tagId]?.name ?? "Unknown tag")
      .join(", ");
  };

  const updateCustomFields = (
    noteId: string,
    nextFields: Record<string, CustomFieldValue>
  ): void => {
    onUpdateCustomFields(noteId, nextFields);
  };

  const handleAddField = (): void => {
    if (!note) {
      return;
    }
    const existingKeys = Object.keys(note.customFields);
    const nextKey = createCustomFieldKey(existingKeys);
    updateCustomFields(note.id, {
      ...note.customFields,
      [nextKey]: "",
    });
  };

  const handleCommitField = (payload: {
    previousKey: string;
    nextKey: string;
    value: CustomFieldValue;
  }): void => {
    if (!note) {
      return;
    }
    const nextFields = { ...note.customFields };
    const hasPrevious = Object.prototype.hasOwnProperty.call(
      note.customFields,
      payload.previousKey
    );
    const resolvedValue =
      payload.previousKey !== payload.nextKey && hasPrevious
        ? note.customFields[payload.previousKey]
        : payload.value;
    if (payload.previousKey !== payload.nextKey) {
      delete nextFields[payload.previousKey];
    }
    nextFields[payload.nextKey] = resolvedValue;
    updateCustomFields(note.id, nextFields);
  };

  const handleDeleteField = (fieldKey: string): void => {
    if (!note) {
      return;
    }
    const { [fieldKey]: _removed, ...rest } = note.customFields;
    updateCustomFields(note.id, rest);
  };

  $: customFieldEntries = note
    ? Object.entries(note.customFields)
    : ([] as Array<[string, CustomFieldValue]>);

  let unresolvedSelection: Record<string, string> = {};

  const resolveMatchesForRaw = (
    raw: string
  ): Array<{ id: string; title: string }> => {
    if (!vault) {
      return [];
    }
    const normalized = raw.trim();
    if (!normalized) {
      return [];
    }
    return Object.values(vault.notesIndex)
      .filter((entry) => entry.deletedAt === null && entry.title === normalized)
      .map((entry) => ({ id: entry.id, title: entry.title }));
  };

  $: unresolvedOutgoing =
    note && vault
      ? (note.derived?.outgoingLinks ?? []).filter(
          (target) => !Object.hasOwn(vault.notesIndex, target)
        )
      : ([] as string[]);

  $: unresolvedDetails = unresolvedOutgoing.map((raw) => ({
    raw,
    matches: resolveMatchesForRaw(raw),
  }));

  $: convertibleReplacements = unresolvedDetails
    .filter((detail) => detail.matches.length === 1)
    .map((detail) => ({ raw: detail.raw, targetId: detail.matches[0]!.id }));

  $: {
    // Initialize selection defaults for ambiguous links.
    const next: Record<string, string> = { ...unresolvedSelection };
    let changed = false;
    for (const detail of unresolvedDetails) {
      if (detail.matches.length > 0 && !next[detail.raw]) {
        next[detail.raw] = detail.matches[0]!.id;
        changed = true;
      }
    }
    if (changed) {
      unresolvedSelection = next;
    }
  }

  const handleResolveRaw = async (raw: string): Promise<void> => {
    const targetId = unresolvedSelection[raw] ?? "";
    if (!targetId) {
      return;
    }
    await onResolveWikiLink(raw, targetId);
  };

  const handleCreateAndResolve = async (raw: string): Promise<void> => {
    const title = raw.trim();
    if (!title) {
      return;
    }
    const createdId = await onCreateNoteForWikiLink(title);
    if (!createdId) {
      return;
    }
    await onResolveWikiLink(raw, createdId);
  };

  const handleNormalize = async (): Promise<void> => {
    if (convertibleReplacements.length === 0) {
      return;
    }
    await onNormalizeWikiLinks(convertibleReplacements);
  };
</script>

<div class="panel" data-testid="metadata-panel">
  {#if !note}
    <div class="panel-empty">Select a note to view metadata.</div>
  {:else}
    <section class="panel-section" aria-label="System fields">
      <div class="panel-section-title">System fields</div>
      <div class="system-fields">
        <div class="system-row">
          <span class="system-label">Created</span>
          <span class="system-value">{formatTimestamp(note.createdAt)}</span>
        </div>
        <div class="system-row">
          <span class="system-label">Updated</span>
          <span class="system-value">{formatTimestamp(note.updatedAt)}</span>
        </div>
        <div class="system-row">
          <span class="system-label">Folder</span>
          <span class="system-value">{resolveFolderName(note)}</span>
        </div>
        <div class="system-row">
          <span class="system-label">Tags</span>
          <span class="system-value">{resolveTagNames(note)}</span>
        </div>
        <div class="system-row">
          <span class="system-label">Favorite</span>
          <span class="system-value">{note.favorite ? "Yes" : "No"}</span>
        </div>
      </div>
    </section>

    <section class="panel-section" aria-label="Unresolved links">
      <div class="panel-section-header">
        <div class="panel-section-title">Unresolved links</div>
        <button
          class="button"
          type="button"
          data-testid="normalize-wiki-links"
          on:click={() => void handleNormalize()}
          disabled={convertibleReplacements.length === 0}
        >
          Convert
        </button>
      </div>
      {#if unresolvedDetails.length === 0}
        <div class="panel-empty">No unresolved links.</div>
      {:else}
        <div class="unresolved-list" data-testid="unresolved-links-list">
          {#each unresolvedDetails as detail (detail.raw)}
            <div class="unresolved-row">
              <div class="unresolved-copy">
                <div class="unresolved-title">[[{detail.raw}]]</div>
                <div class="unresolved-subtitle">
                  {#if detail.matches.length === 0}
                    No matching notes found.
                  {:else if detail.matches.length === 1}
                    One match found.
                  {:else}
                    {detail.matches.length} matches found.
                  {/if}
                </div>
              </div>
              <div class="unresolved-controls">
                {#if detail.matches.length > 0}
                  <select
                    class="select"
                    aria-label="Select link target"
                    value={unresolvedSelection[detail.raw] ?? ""}
                    on:change={(event) => {
                      const value =
                        event.currentTarget instanceof HTMLSelectElement
                          ? event.currentTarget.value
                          : "";
                      unresolvedSelection = {
                        ...unresolvedSelection,
                        [detail.raw]: value,
                      };
                    }}
                  >
                    {#each detail.matches as match (match.id)}
                      <option value={match.id}>
                        {match.title} ({match.id})
                      </option>
                    {/each}
                  </select>
                  <button
                    class="button"
                    type="button"
                    on:click={() => void handleResolveRaw(detail.raw)}
                    disabled={!unresolvedSelection[detail.raw]}
                  >
                    Resolve
                  </button>
                {:else}
                  <button
                    class="button"
                    type="button"
                    on:click={() => void handleCreateAndResolve(detail.raw)}
                    disabled={!detail.raw.trim()}
                  >
                    Create note
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="panel-section" aria-label="Custom fields">
      <div class="panel-section-header">
        <div class="panel-section-title">Custom fields</div>
        <button
          class="button"
          type="button"
          data-testid="metadata-add-field"
          on:click={handleAddField}
        >
          Add field
        </button>
      </div>
      {#if customFieldEntries.length === 0}
        <div class="panel-empty">No custom fields yet.</div>
      {:else}
        <div class="custom-fields">
          {#each customFieldEntries as [fieldKey, fieldValue], index (index)}
            <CustomFieldEditor
              fieldKey={fieldKey}
              value={fieldValue}
              index={index}
              reservedKeys={customFieldEntries
                .map(([key]) => key)
                .filter((key) => key !== fieldKey)}
              onCommit={handleCommitField}
              onDelete={handleDeleteField}
            />
          {/each}
        </div>
      {/if}
    </section>

    <BacklinksPanel
      activeNoteId={note.id}
      {linkedMentions}
      loading={backlinksLoading}
      {unlinkedMentions}
      unlinkedLoading={unlinkedMentionsLoading}
      onOpenNote={onOpenNote}
    />
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panel-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .panel-section-title {
    font-size: 12px;
    color: var(--text-2);
  }

  .system-fields {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .system-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }

  .system-label {
    color: var(--text-2);
  }

  .system-value {
    color: var(--text-0);
    text-align: right;
  }

  .custom-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .button {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-1);
    background: transparent;
    color: var(--text-0);
    font-size: 12px;
    cursor: pointer;
  }

  .button:hover {
    background: var(--bg-3);
  }

  .button:active {
    transform: translateY(0.5px);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .panel-empty {
    font-size: 12px;
    color: var(--text-2);
  }

  .unresolved-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .unresolved-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--stroke-0);
  }

  .unresolved-row:first-child {
    border-top: none;
    padding-top: 0;
  }

  .unresolved-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .unresolved-title {
    font-size: 12px;
    color: var(--text-0);
    word-break: break-word;
  }

  .unresolved-subtitle {
    font-size: 12px;
    color: var(--text-2);
  }

  .unresolved-controls {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .select {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-1);
    font-size: 12px;
    max-width: 240px;
  }

  .select:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
