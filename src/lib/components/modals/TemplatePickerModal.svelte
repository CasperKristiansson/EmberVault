<script lang="ts">
  import { onMount } from "svelte";
  import type { TemplateIndexEntry } from "$lib/core/storage/types";

  export let templates: TemplateIndexEntry[] = [];
  export let lastUsedTemplateId: string | null = null;
  export let onClose: () => void = () => {};
  export let onCreateBlank: (() => void | Promise<void>) | null = null;
  export let onCreateFromTemplate:
    | ((templateId: string) => void | Promise<void>)
    | null = null;

  type PickerItem = {
    id: string;
    label: string;
    type: "blank" | "template";
    templateId?: string;
    context?: "last-used" | "list";
    disabled?: boolean;
  };

  let items: PickerItem[] = [];
  let selectedIndex = 0;
  let panelElement: HTMLDivElement | null = null;

  const resolveTitle = (template: TemplateIndexEntry): string =>
    template.title.trim() || "Untitled";

  const runItem = async (item: PickerItem | undefined): Promise<void> => {
    if (!item || item.disabled) {
      return;
    }
    onClose();
    if (item.type === "blank") {
      await onCreateBlank?.();
      return;
    }
    if (item.templateId) {
      await onCreateFromTemplate?.(item.templateId);
    }
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (items.length > 0) {
        selectedIndex = (selectedIndex + 1) % items.length;
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length > 0) {
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void runItem(items[selectedIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  $: {
    const entries: PickerItem[] = [
      {
        id: "blank",
        label: "Blank note",
        type: "blank",
        disabled: !onCreateBlank,
      },
    ];

    if (lastUsedTemplateId) {
      const lastUsed = templates.find(
        (template) => template.id === lastUsedTemplateId
      );
      if (lastUsed) {
        entries.push({
          id: `last-${lastUsed.id}`,
          label: resolveTitle(lastUsed),
          type: "template",
          templateId: lastUsed.id,
          context: "last-used",
          disabled: !onCreateFromTemplate,
        });
      }
    }

    for (const template of templates) {
      if (template.id === lastUsedTemplateId) {
        continue;
      }
      entries.push({
        id: `template-${template.id}`,
        label: resolveTitle(template),
        type: "template",
        templateId: template.id,
        context: "list",
        disabled: !onCreateFromTemplate,
      });
    }

    items = entries;
    if (selectedIndex >= items.length) {
      selectedIndex = items.length > 0 ? 0 : -1;
    }
  }

  onMount(() => {
    panelElement?.focus();
  });
</script>

<div class="modal-overlay" data-testid="template-picker-modal">
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    aria-label="New note from template"
    tabindex="0"
    bind:this={panelElement}
    on:keydown={handleKeydown}
  >
    <header class="modal-header">
      <div class="modal-title">New note</div>
      <button class="icon-button" type="button" on:click={onClose}>
        Close
      </button>
    </header>

    <div class="picker-section">
      <div class="section-title">Quick start</div>
      <div class="picker-list">
        {#each items as item, index (item.id)}
          {#if item.type === "blank" || item.context === "last-used"}
            <button
              class="picker-item"
              type="button"
              data-selected={index === selectedIndex}
              data-testid={`template-picker-item-${item.id}`}
              disabled={item.disabled}
              on:click={() => void runItem(item)}
            >
              <span class="picker-title">
                {item.type === "blank" ? "Blank note" : item.label}
              </span>
              {#if item.context === "last-used"}
                <span class="picker-meta">Last used</span>
              {/if}
            </button>
          {/if}
        {/each}
      </div>
    </div>

    <div class="picker-section">
      <div class="section-title">Templates</div>
      <div class="picker-list" data-testid="template-picker-list">
        {#if templates.length === 0}
          <div class="picker-empty">No templates yet.</div>
        {:else}
          {#each items as item, index (item.id)}
            {#if item.context === "list"}
              <button
                class="picker-item"
                type="button"
                data-selected={index === selectedIndex}
                data-testid={`template-picker-item-${item.templateId}`}
                disabled={item.disabled}
                on:click={() => void runItem(item)}
              >
                <span class="picker-title">{item.label}</span>
              </button>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 12px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    z-index: 100;
  }

  .modal-panel {
    margin-top: 56px;
    width: min(520px, 100% - 24px);
    background: var(--bg-1);
    border-radius: var(--r-lg);
    border: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-panel);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    z-index: 110;
    outline: none;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-title {
    font-weight: 500;
  }

  .icon-button {
    height: 32px;
    padding: 0 12px;
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

  .picker-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 12px;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .picker-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .picker-item {
    height: 36px;
    padding: 0 12px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: var(--bg-2);
    color: var(--text-0);
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }

  .picker-item:hover {
    background: var(--bg-3);
  }

  .picker-item[data-selected="true"] {
    border-color: var(--accent-0);
    background: var(--accent-2);
    color: var(--accent-0);
  }

  .picker-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .picker-title {
    font-size: 13px;
  }

  .picker-meta {
    font-size: 11px;
    color: var(--text-2);
  }

  .picker-empty {
    font-size: 13px;
    color: var(--text-2);
    padding: 8px 0;
  }
</style>
