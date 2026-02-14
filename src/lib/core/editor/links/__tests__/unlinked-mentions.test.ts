import { buildUnlinkedMentionSnippet } from "../unlinked-mentions";

describe("buildUnlinkedMentionSnippet", () => {
  it("returns null when title is empty", () => {
    expect(buildUnlinkedMentionSnippet("Alpha", "")).toBeNull();
  });

  it("returns null when there is no match", () => {
    expect(buildUnlinkedMentionSnippet("Nothing here", "Alpha")).toBeNull();
  });

  it("finds a match outside wiki links", () => {
    const text = "See [[Alpha]] but also Alpha appears unlinked.";
    const snippet = buildUnlinkedMentionSnippet(text, "Alpha", 20);
    expect(snippet).not.toBeNull();
    expect(snippet?.match.toLowerCase()).toBe("alpha");
    expect(`${snippet?.before}${snippet?.match}${snippet?.after}`).toContain(
      "Alpha appears unlinked"
    );
  });

  it("matches case-insensitively", () => {
    const snippet = buildUnlinkedMentionSnippet("alpha BETA", "Alpha", 10);
    expect(snippet?.match).toBe("alpha");
  });
});

