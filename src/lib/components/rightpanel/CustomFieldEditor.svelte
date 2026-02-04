<script lang="ts">
  import type { CustomFieldValue } from "$lib/core/storage/types";
  import {
    customFieldTypes,
    defaultCustomFieldValue,
    getCustomFieldType,
    parseCustomFieldInput,
    toCustomFieldInputValue,
    type CustomFieldType,
  } from "$lib/core/utils/custom-fields";

  export let fieldKey: string;
  export let value: CustomFieldValue;
  export let index = 0;
  export let reservedKeys: string[] = [];
  export let onCommit: (payload: {
    previousKey: string;
    nextKey: string;
    value: CustomFieldValue;
  }) => void = () => {};
  export let onDelete: (key: string) => void = () => {};

  let keyDraft = fieldKey;
  let keyError = "";
  let keyDirty = false;

  let valueDraft = "";
  let valueError = "";
  let valueDirty = false;

  $: fieldType = getCustomFieldType(value);

  $: if (!keyDirty) {
    keyDraft = fieldKey;
  }

  $: if (!valueDirty) {
    valueDraft = toCustomFieldInputValue(value, fieldType);
  }

  const handleKeyInput = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    keyDraft = target.value;
    keyDirty = true;
    keyError = "";
  };

  const commitKey = (): boolean => {
    const trimmed = keyDraft.trim();
    if (!trimmed) {
      keyError = "Key is required.";
      return false;
    }
    if (trimmed !== fieldKey && reservedKeys.includes(trimmed)) {
      keyError = "Key already exists.";
      return false;
    }
    keyError = "";
    keyDirty = false;
    if (trimmed !== fieldKey) {
      onCommit({ previousKey: fieldKey, nextKey: trimmed, value });
    }
    return true;
  };

  const handleKeyBlur = (): void => {
    commitKey();
  };

  const handleKeyKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitKey()) {
        (event.currentTarget as HTMLInputElement | null)?.blur();
      }
    }
  };

  const handleTypeChange = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    const nextType = target.value as CustomFieldType;
    if (nextType === fieldType) {
      return;
    }
    valueDirty = false;
    valueError = "";
    const nextValue = defaultCustomFieldValue(nextType);
    onCommit({ previousKey: fieldKey, nextKey: fieldKey, value: nextValue });
  };

  const handleValueInput = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    valueDraft = target.value;
    valueDirty = true;
    valueError = "";
    if (fieldType === "string") {
      commitValue();
    }
  };

  const commitValue = (): boolean => {
    const parsed = parseCustomFieldInput(fieldType, valueDraft);
    if (parsed === null) {
      valueError =
        fieldType === "number"
          ? "Enter a valid number."
          : "Enter a valid date.";
      return false;
    }
    valueDirty = false;
    valueError = "";
    onCommit({ previousKey: fieldKey, nextKey: fieldKey, value: parsed });
    return true;
  };

  const handleValueBlur = (): void => {
    if (fieldType === "boolean") {
      return;
    }
    commitValue();
  };

  const handleValueKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitValue()) {
        (event.currentTarget as HTMLInputElement | null)?.blur();
      }
    }
  };

  const handleBooleanChange = (event: Event): void => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const parsed = parseCustomFieldInput("boolean", target.checked);
    if (parsed === null) {
      return;
    }
    onCommit({ previousKey: fieldKey, nextKey: fieldKey, value: parsed });
  };
</script>

<div class="custom-field" data-testid={`custom-field-row-${index}`}>
  <div class="custom-field-row">
    <input
      class="field-input field-key"
      data-testid={`custom-field-key-${index}`}
      type="text"
      aria-label="Custom field key"
      value={keyDraft}
      on:input={handleKeyInput}
      on:blur={handleKeyBlur}
      on:keydown={handleKeyKeydown}
    />

    <select
      class="field-select"
      data-testid={`custom-field-type-${index}`}
      aria-label="Custom field type"
      value={fieldType}
      on:change={handleTypeChange}
    >
      {#each customFieldTypes as type (type)}
        <option value={type}>{type}</option>
      {/each}
    </select>

    {#if fieldType === "boolean"}
      <label class="boolean-field">
        <input
          type="checkbox"
          class="boolean-input"
          aria-label="Custom field boolean value"
          data-testid={`custom-field-boolean-${index}`}
          checked={typeof value === "boolean" ? value : false}
          on:change={handleBooleanChange}
        />
        <span class="boolean-label">
          {typeof value === "boolean" && value ? "True" : "False"}
        </span>
      </label>
    {:else}
      <input
        class="field-input field-value"
        data-testid={`custom-field-value-${index}`}
        type={fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text"}
        aria-label="Custom field value"
        value={valueDraft}
        on:input={handleValueInput}
        on:blur={handleValueBlur}
        on:keydown={handleValueKeydown}
      />
    {/if}

    <button
      class="icon-button"
      type="button"
      aria-label="Delete custom field"
      data-testid={`custom-field-delete-${index}`}
      on:click={() => onDelete(fieldKey)}
    >
      <svg
        class="icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 6h18" />
        <path d="M8 6v12" />
        <path d="M16 6v12" />
        <path d="M10 6V4h4v2" />
      </svg>
    </button>
  </div>

  {#if keyError}
    <div class="field-error">{keyError}</div>
  {/if}
  {#if valueError}
    <div class="field-error">{valueError}</div>
  {/if}
</div>

<style>
  .custom-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .custom-field-row {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) 96px minmax(0, 1fr) 28px;
    gap: 8px;
    align-items: center;
  }

  .field-input,
  .field-select {
    height: 32px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    color: var(--text-0);
    padding: 0 10px;
  }

  .field-input:focus,
  .field-select:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .field-key {
    min-width: 0;
  }

  .field-select {
    text-transform: capitalize;
  }

  .field-value {
    min-width: 0;
  }

  .boolean-field {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-md);
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
  }

  .boolean-input {
    width: 14px;
    height: 14px;
    accent-color: var(--accent-0);
  }

  .boolean-label {
    font-size: 12px;
    color: var(--text-1);
  }

  .icon-button {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .icon {
    width: 14px;
    height: 14px;
  }

  .field-error {
    font-size: 11px;
    color: var(--warning);
  }
</style>
