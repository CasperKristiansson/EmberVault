export type DockSide = "left" | "right" | "top" | "bottom" | "center";

export type PaneLayoutLeaf = {
  type: "leaf";
  paneId: string;
};

export type PaneLayoutSplit = {
  type: "split";
  direction: "row" | "column";
  children: PaneLayoutNode[];
  sizes?: number[];
};

export type PaneLayoutNode = PaneLayoutLeaf | PaneLayoutSplit;

export const createLeaf = (paneId: string): PaneLayoutLeaf => ({
  type: "leaf",
  paneId,
});

export const countLeaves = (node: PaneLayoutNode): number => {
  if (node.type === "leaf") {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
};

export const collectLeafPaneIds = (node: PaneLayoutNode): string[] => {
  if (node.type === "leaf") {
    return [node.paneId];
  }
  return node.children.flatMap(collectLeafPaneIds);
};

export const findLeafPath = (
  node: PaneLayoutNode,
  paneId: string
): number[] | null => {
  if (node.type === "leaf") {
    return node.paneId === paneId ? [] : null;
  }
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];
    const path = findLeafPath(child, paneId);
    if (path) {
      return [index, ...path];
    }
  }
  return null;
};

const normalizeSizes = (node: PaneLayoutSplit): number[] => {
  const resolvedSizes = node.sizes?.slice(0, node.children.length) ?? [];
  while (resolvedSizes.length < node.children.length) {
    resolvedSizes.push(1);
  }
  const total = resolvedSizes.reduce((sum, size) => sum + size, 0);
  if (total <= 0) {
    return resolvedSizes.map(() => 1);
  }
  return resolvedSizes;
};

export const normalizeLayout = (node: PaneLayoutNode): PaneLayoutNode => {
  if (node.type === "leaf") {
    return node;
  }
  const normalizedChildren = node.children.map(normalizeLayout);
  if (normalizedChildren.length === 0) {
    // Should never happen, but keep a safe leaf fallback for callers.
    return createLeaf("primary");
  }
  if (normalizedChildren.length === 1) {
    return normalizedChildren[0] ?? createLeaf("primary");
  }
  const next: PaneLayoutSplit = {
    ...node,
    children: normalizedChildren,
  };
  next.sizes = normalizeSizes(next);
  return next;
};

export const dockLeaf = (input: {
  layout: PaneLayoutNode;
  targetPaneId: string;
  side: Exclude<DockSide, "center">;
  newPaneId: string;
}): PaneLayoutNode => {
  const { layout, targetPaneId, side, newPaneId } = input;
  const path = findLeafPath(layout, targetPaneId);
  if (!path) {
    return layout;
  }

  const direction = side === "left" || side === "right" ? "row" : "column";
  const newLeaf = createLeaf(newPaneId);

  const replaceAtPath = (
    node: PaneLayoutNode,
    currentPath: number[]
  ): PaneLayoutNode => {
    if (currentPath.length === 0) {
      if (node.type !== "leaf") {
        return node;
      }
      const existing = node;
      const children =
        side === "left" || side === "top"
          ? [newLeaf, existing]
          : [existing, newLeaf];
      return normalizeLayout({
        type: "split",
        sizes: [1, 1],
        direction,
        children,
      });
    }

    if (node.type !== "split") {
      return node;
    }
    const [head, ...rest] = currentPath;
    const index = head;
    const nextChildren = node.children.map((child, childIndex) =>
      childIndex === index ? replaceAtPath(child, rest) : child
    );
    return normalizeLayout({
      ...node,
      children: nextChildren,
    });
  };

  return replaceAtPath(layout, path);
};

export const removeLeaf = (input: {
  layout: PaneLayoutNode;
  paneId: string;
}): PaneLayoutNode => {
  const { layout, paneId } = input;

  const removeRecursive = (node: PaneLayoutNode): PaneLayoutNode | null => {
    if (node.type === "leaf") {
      return node.paneId === paneId ? null : node;
    }
    const nextChildren = node.children
      .map(removeRecursive)
      .filter((child): child is PaneLayoutNode => child !== null);
    if (nextChildren.length === 0) {
      return null;
    }
    if (nextChildren.length === 1) {
      return nextChildren[0] ?? null;
    }
    return normalizeLayout({
      type: "split",
      direction: node.direction,
      children: nextChildren,
    });
  };

  const next = removeRecursive(layout);
  return next ? normalizeLayout(next) : layout;
};
