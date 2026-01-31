import type Graph from "graphology";

export type GraphLayoutOptions = {
  radius?: number;
};

export const applyCircularLayout = (
  graph: Graph,
  options: GraphLayoutOptions = {}
): void => {
  const nodes = graph.nodes();
  if (nodes.length === 0) {
    return;
  }
  const baseRadius = options.radius ?? Math.max(8, Math.sqrt(nodes.length) * 6);
  const step = (Math.PI * 2) / nodes.length;

  for (const [index, node] of nodes.entries()) {
    const angle = index * step;
    graph.setNodeAttribute(node, "x", Math.cos(angle) * baseRadius);
    graph.setNodeAttribute(node, "y", Math.sin(angle) * baseRadius);
  }
};
