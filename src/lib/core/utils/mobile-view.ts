export type MobileView = "notes" | "editor" | "search" | "graph" | "settings";

export const resolveMobileView = (
  view: MobileView,
  hasActiveNote: boolean
): MobileView => {
  if (view === "editor" && !hasActiveNote) {
    return "notes";
  }
  return view;
};
