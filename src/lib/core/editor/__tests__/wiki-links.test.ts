import { describe, expect, it } from "vitest";
import {
  buildWikiLinkInsertText,
  filterWikiLinkCandidates,
  resolveWikiLinkTitle,
} from "../wiki-links";
import type { WikiLinkCandidate } from "../wiki-links";

const candidates: WikiLinkCandidate[] = [
  { id: "01HA", title: "Project Plan" },
  { id: "01HB", title: "" },
  { id: "01HC", title: "Roadmap" },
];

describe("resolveWikiLinkTitle", () => {
  it("returns Untitled for empty titles", () => {
    expect(resolveWikiLinkTitle("")).toBe("Untitled");
  });

  it("trims titles", () => {
    expect(resolveWikiLinkTitle("  Alpha  ")).toBe("Alpha");
  });
});

describe("filterWikiLinkCandidates", () => {
  it("returns all candidates when query is empty", () => {
    expect(filterWikiLinkCandidates(candidates, "")).toEqual(candidates);
  });

  it("filters by title substring", () => {
    expect(filterWikiLinkCandidates(candidates, "road")).toEqual([
      { id: "01HC", title: "Roadmap" },
    ]);
  });

  it("filters by id substring", () => {
    expect(filterWikiLinkCandidates(candidates, "01hb")).toEqual([
      { id: "01HB", title: "" },
    ]);
  });
});

describe("buildWikiLinkInsertText", () => {
  it("creates a wiki link with the candidate id", () => {
    expect(buildWikiLinkInsertText(candidates[0])).toBe("[[01HA]]");
  });
});
