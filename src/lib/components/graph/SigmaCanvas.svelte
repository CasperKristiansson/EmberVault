<script lang="ts">
  import { afterUpdate, onDestroy, onMount } from "svelte";
  import type Graph from "graphology";
  import type SigmaType from "sigma";

  export let graph: Graph | null = null;
  export let onNodeHover: (nodeId: string | null) => void = () => {};
  export let onNodeClick: (nodeId: string) => void = () => {};
  export let recenterToken = 0;

  let container: HTMLDivElement | null = null;
  let renderer: SigmaType | null = null;
  const graphRef = { current: null as Graph | null };
  let sigmaConstructor: typeof SigmaType | null = null;

  const loadSigma = async (): Promise<typeof SigmaType | null> => {
    if (sigmaConstructor) {
      return sigmaConstructor;
    }
    const module = await import("sigma");
    const candidate = module.default ?? module.Sigma ?? module;
    if (typeof candidate !== "function") {
      return null;
    }
    sigmaConstructor = candidate as typeof SigmaType;
    return sigmaConstructor;
  };

  const attachRenderer = async (): Promise<void> => {
    if (!container || !graph) {
      return;
    }
    const SigmaCtor = await loadSigma();
    if (!SigmaCtor) {
      return;
    }
    renderer?.kill();
    renderer = new SigmaCtor(graph, container, {
      renderLabels: false,
    });
    graphRef.current = graph;

    renderer.on("enterNode", ({ node }) => {
      onNodeHover(node);
    });
    renderer.on("leaveNode", () => {
      onNodeHover(null);
    });
    renderer.on("clickNode", ({ node }) => {
      onNodeClick(node);
    });
  };

  const recenter = (): void => {
    const camera = renderer?.getCamera();
    if (!camera) {
      return;
    }
    const maybeAnimatedReset = camera as { animatedReset?: () => void };
    if (typeof maybeAnimatedReset.animatedReset === "function") {
      maybeAnimatedReset.animatedReset();
      return;
    }
    camera.setState({ x: 0, y: 0, ratio: 1 });
  };

  onMount(() => {
    void attachRenderer();
    return () => {
      renderer?.kill();
      renderer = null;
      graphRef.current = null;
    };
  });

  onDestroy(() => {
    renderer?.kill();
  });

  afterUpdate(() => {
    if (!graph || !container) {
      return;
    }
    if (graph === graphRef.current) {
      return;
    }
    void attachRenderer();
  });

  $: if (recenterToken > 0) {
    recenter();
  }
</script>

<div class="graph-canvas" bind:this={container} data-testid="graph-canvas"></div>

<style>
  .graph-canvas {
    flex: 1;
    min-height: 0;
    border-radius: var(--r-lg);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    overflow: hidden;
  }
</style>
