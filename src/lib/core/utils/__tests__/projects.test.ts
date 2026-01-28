import { describe, expect, it } from "vitest";
import { sortProjectsByUpdatedAt } from "../projects";

const getProjectId = (project: { id: string }) => project.id;

describe("sortProjectsByUpdatedAt", () => {
  it("sorts projects by updatedAt descending", () => {
    const projects = [
      {
        id: "a",
        name: "Alpha",
        createdAt: 1,
        updatedAt: 10,
        folders: {},
        tags: {},
        notesIndex: {},
        templatesIndex: {},
        settings: {},
      },
      {
        id: "b",
        name: "Beta",
        createdAt: 1,
        updatedAt: 30,
        folders: {},
        tags: {},
        notesIndex: {},
        templatesIndex: {},
        settings: {},
      },
      {
        id: "c",
        name: "Gamma",
        createdAt: 1,
        updatedAt: 20,
        folders: {},
        tags: {},
        notesIndex: {},
        templatesIndex: {},
        settings: {},
      },
    ];

    const sorted = sortProjectsByUpdatedAt(projects);

    expect(sorted.map(getProjectId)).toEqual(["b", "c", "a"]);
    expect(projects.map(getProjectId)).toEqual(["a", "b", "c"]);
  });
});
