<script lang="ts">
  import { onMount } from "svelte";
  import type Graph from "graphology";
  import GraphToolbar from "$lib/components/graph/GraphToolbar.svelte";
  import GraphTooltip from "$lib/components/graph/GraphTooltip.svelte";
  import SigmaCanvas from "$lib/components/graph/SigmaCanvas.svelte";
  import { buildGraph } from "$lib/core/graph/build";
  import { applyCircularLayout } from "$lib/core/graph/layout";
  import {
    filterNotesByTag,
    resolveNeighborhoodNoteIds,
  } from "$lib/core/graph/filters";
  import type { NoteIndexEntry, Tag } from "$lib/core/storage/types";

  export let notes: NoteIndexEntry[] = [];
  export let tags: Record<string, Tag> = {};
  export let activeNoteId: string | null = null;
  export let onNodeClick: (noteId: string) => void = () => {};

  const globalWindow =
    typeof globalThis === "undefined"
      ? null
      : (globalThis as unknown as Window);
  const isE2E = (globalWindow?.location?.search ?? "").includes("e2e=1");

  let mode: "project" | "note" = "project";
  let depth = 1;
  let searchQuery = "";
  let tagFilter = "all";
  type GraphTooltipNode = {
    title: string;
    tags: string[];
  };

  let recenterToken = 0;
  let hoverNodeId: string | null = null;
  let graph: Graph | null = null;
  let tooltipNode: GraphTooltipNode | null = null;
  let depthDisabled = false;
  let colorTokens = {
    baseNode: "rgba(255, 255, 255, 0.5)",
    activeNode: "#FF8A2A",
    edge: "rgba(255, 255, 255, 0.12)",
  };

  const resolveTagOptions = (
    tagMap: Record<string, Tag>
  ): { id: string; name: string }[] =>
    Object.values(tagMap).map(tag => ({ id: tag.id, name: tag.name }));

  const resolveTooltipNode = (nodeId: string | null): GraphTooltipNode | null => {
    if (!nodeId || !graph) {
      return null;
    }
    const title = graph.getNodeAttribute(nodeId, "title") as string | undefined;
    const tagIds = graph.getNodeAttribute(nodeId, "tagIds") as string[] | undefined;
    const resolvedTags = (tagIds ?? [])
      .map(tagId => tags[tagId]?.name)
      .filter((tagName): tagName is string => Boolean(tagName));
    return {
      title: title?.trim() ? title : "Untitled",
      tags: resolvedTags,
    };
  };

  const refreshGraph = (input: {
    notes: NoteIndexEntry[];
    tagFilter: string;
    searchQuery: string;
    mode: "project" | "note";
    depth: number;
    activeNoteId: string | null;
    colorTokens: typeof colorTokens;
  }): void => {
    const activeNotes = input.notes.filter(note => note.deletedAt === null);
    const filteredByTag = filterNotesByTag(activeNotes, input.tagFilter);
    const normalizedQuery = input.searchQuery.trim().toLowerCase();
    const filteredByQuery = normalizedQuery
      ? filteredByTag.filter(note =>
          (note.title?.trim() || "Untitled")
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : filteredByTag;

    let visibleNotes = filteredByQuery;
    if (input.mode === "note") {
      if (!input.activeNoteId) {
        graph = null;
        tooltipNode = null;
        return;
      }
      const neighborhoodIds = resolveNeighborhoodNoteIds(
        filteredByQuery,
        input.activeNoteId,
        input.depth
      );
      visibleNotes = filteredByQuery.filter(note => neighborhoodIds.has(note.id));
    }

    const nextGraph = buildGraph(visibleNotes, {
      activeNoteId: input.activeNoteId,
      colors: input.colorTokens,
    });
    applyCircularLayout(nextGraph);
    graph = nextGraph;
    tooltipNode = resolveTooltipNode(hoverNodeId);
  };

  const recenter = (): void => {
    recenterToken += 1;
  };

  const setHoverNodeId = (nodeId: string | null): void => {
    hoverNodeId = nodeId;
  };

  const registerGraphTestApi = (): void => {
    if (!isE2E || !globalWindow) {
      return;
    }
    const api = {
      clickNode: (nodeId: string): boolean => {
        if (!graph || !graph.hasNode(nodeId)) {
          return false;
        }
        onNodeClick(nodeId);
        return true;
      },
    };
    const typedWindow = globalWindow as Window & {
      embervaultGraphTest?: typeof api;
    };
    typedWindow.embervaultGraphTest = api;
  };

  const clearGraphTestApi = (): void => {
    if (!isE2E || !globalWindow) {
      return;
    }
    const typedWindow = globalWindow as Window & {
      embervaultGraphTest?: unknown;
    };
    if (typedWindow.embervaultGraphTest) {
      delete typedWindow.embervaultGraphTest;
    }
  };

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }
    const styles = getComputedStyle(document.documentElement);
    colorTokens = {
      baseNode: styles.getPropertyValue("--text-2").trim() || colorTokens.baseNode,
      activeNode:
        styles.getPropertyValue("--accent-0").trim() || colorTokens.activeNode,
      edge: styles.getPropertyValue("--stroke-0").trim() || colorTokens.edge,
    };
    refreshGraph({
      notes,
      tagFilter,
      searchQuery,
      mode,
      depth,
      activeNoteId,
      colorTokens,
    });
    registerGraphTestApi();
    return () => {
      clearGraphTestApi();
    };
  });

  $: refreshGraph({
    notes,
    tagFilter,
    searchQuery,
    mode,
    depth,
    activeNoteId,
    colorTokens,
  });
  $: tooltipNode = resolveTooltipNode(hoverNodeId);
  $: depth = Math.min(3, Math.max(1, depth));
  $: depthDisabled = mode !== "note" || !activeNoteId;
</script>

<div class="graph-view" data-testid="graph-view">
  <GraphToolbar
    bind:mode
    bind:depth
    bind:searchQuery
    bind:tagFilter
    {depthDisabled}
    tagOptions={resolveTagOptions(tags)}
    onRecenter={recenter}
  />

  {#if mode === "note" && !activeNoteId}
    <div class="graph-empty">Select a note to view its neighborhood.</div>
  {:else if !graph || graph.order === 0}
    <div class="graph-empty">No notes to show in the graph.</div>
  {:else}
    <div class="graph-stage">
      <SigmaCanvas
        {graph}
        onNodeHover={setHoverNodeId}
        onNodeClick={onNodeClick}
        {recenterToken}
      />
      <GraphTooltip node={tooltipNode} />
    </div>
  {/if}
</div>

<style>
  .graph-view {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  .graph-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .graph-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--text-2);
    border-radius: var(--r-lg);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
  }
</style>
