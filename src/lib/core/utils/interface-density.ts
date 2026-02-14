export type InterfaceDensity = "comfortable" | "compact";

export const resolveInterfaceDensity = (value?: unknown): InterfaceDensity =>
  value === "compact" ? "compact" : "comfortable";
