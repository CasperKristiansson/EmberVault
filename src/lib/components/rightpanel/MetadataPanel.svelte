<script lang="ts">
  import type {
    CustomFieldValue,
    NoteDocumentFile,
    Vault,
  } from "$lib/core/storage/types";
  import { createCustomFieldKey } from "$lib/core/utils/custom-fields";
  import CustomFieldEditor from "$lib/components/rightpanel/CustomFieldEditor.svelte";

  export let note: NoteDocumentFile | null = null;
  export let vault: Vault | null = null;
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
</style>
