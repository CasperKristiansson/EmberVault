<script lang="ts">
  import type { NoteDocumentFile } from "$lib/core/storage/types";

  type PMNode = {
    type?: unknown;
    attrs?: unknown;
    content?: unknown;
    text?: unknown;
  };

  type OutlineItem = {
    id: string;
    title: string;
    level: number;
  };

  export let activeNote: NoteDocumentFile | null = null;

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const isPmNode = (value: unknown): value is PMNode => isRecord(value);

  const getNodeContent = (node: PMNode): PMNode[] => {
    const raw = node.content;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(isPmNode);
  };

  const collectText = (node: PMNode): string => {
    const text = typeof node.text === "string" ? node.text : "";
    const children = getNodeContent(node).map(collectText).join("");
    return text + children;
  };

  const resolveHeadingLevel = (node: PMNode): number => {
    if (!isRecord(node.attrs)) {
      return 1;
    }
    const level = node.attrs.level;
    if (typeof level === "number" && level >= 1 && level <= 6) {
      return level;
    }
    return 1;
  };

  const buildOutline = (pmDocument: Record<string, unknown> | null): OutlineItem[] => {
    if (!pmDocument) {
      return [];
    }
    const rawContent: unknown = pmDocument.content;
    if (!Array.isArray(rawContent)) {
      return [];
    }
    const nodes = rawContent.filter(isPmNode);
    const items: OutlineItem[] = [];
    const first = nodes[0];
    const skipTitle =
      Boolean(first) &&
      first.type === "heading" &&
      isRecord(first.attrs) &&
      first.attrs.level === 1;

    const walk = (node: PMNode, isFirstTopLevel: boolean): void => {
      if (node.type === "heading") {
        const level = resolveHeadingLevel(node);
        if (skipTitle && isFirstTopLevel && level === 1) {
          return;
        }
        const title = collectText(node).trim() || "Untitled";
        items.push({
          id: `${items.length}-${level}`,
          title,
          level,
        });
        return;
      }
      for (const child of getNodeContent(node)) {
        walk(child, false);
      }
    };

    nodes.forEach((node, index) => {
      walk(node, skipTitle && index === 0);
    });

    return items;
  };

  $: outlineItems = buildOutline(activeNote?.pmDoc ?? null);
</script>

<div class="panel" data-testid="outline-panel">
  {#if !activeNote}
    <div class="panel-empty">Select a note to view the outline.</div>
  {:else if outlineItems.length === 0}
    <div class="panel-empty">No headings yet.</div>
  {:else}
    <div class="outline-list">
      {#each outlineItems as item (item.id)}
        <div class="outline-item" style={`--outline-level:${item.level};`}>
          <span class="outline-title">{item.title}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .panel-empty {
    font-size: 12px;
    color: var(--text-2);
  }

  .outline-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .outline-item {
    padding: 4px 6px;
    border-radius: var(--r-sm);
    color: var(--text-1);
    font-size: 12px;
    padding-left: calc(6px + (var(--outline-level, 1) - 1) * 10px);
  }

  .outline-item:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .outline-title {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
