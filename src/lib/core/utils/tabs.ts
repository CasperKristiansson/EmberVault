export type TabState = {
  tabs: string[];
  activeTabId: string | null;
};

export const addTab = (tabs: string[], noteId: string): string[] => {
  if (tabs.includes(noteId)) {
    return tabs;
  }
  return [...tabs, noteId];
};

export const closeTabState = (state: TabState, noteId: string): TabState => {
  const { tabs, activeTabId } = state;
  if (!tabs.includes(noteId)) {
    return state;
  }
  const nextTabs = tabs.filter((tabId: string) => tabId !== noteId);
  if (activeTabId !== noteId) {
    return {
      tabs: nextTabs,
      activeTabId,
    };
  }
  if (nextTabs.length === 0) {
    return {
      tabs: nextTabs,
      activeTabId: null,
    };
  }
  const closingIndex = tabs.indexOf(noteId);
  const nextIndex = Math.min(closingIndex, nextTabs.length - 1);
  return {
    tabs: nextTabs,
    activeTabId: nextTabs[nextIndex],
  };
};

export const reorderTabs = (
  tabs: string[],
  fromId: string,
  toId: string
): string[] => {
  if (fromId === toId) {
    return tabs;
  }
  if (!tabs.includes(fromId) || !tabs.includes(toId)) {
    return tabs;
  }
  const filtered = tabs.filter((tabId: string) => tabId !== fromId);
  const targetIndex = filtered.indexOf(toId);
  if (targetIndex === -1) {
    return tabs;
  }
  const nextTabs = [...filtered];
  nextTabs.splice(targetIndex, 0, fromId);
  return nextTabs;
};
