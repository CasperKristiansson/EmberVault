import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultProject,
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "../indexeddb.adapter";

const defaultProjectName = "Personal";
const updatedProjectName = "Personal Updated";

describe("IndexedDBAdapter project persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("creates, reads, updates, and lists projects", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const project = createDefaultProject();
    expect(project.name).toBe(defaultProjectName);

    await adapter.createProject(project);

    const projects = await adapter.listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.id).toBe(project.id);
    expect(projects[0]?.name).toBe(defaultProjectName);

    const storedProject = await adapter.readProject(project.id);
    expect(storedProject).toEqual(project);

    const updatedProject = {
      ...project,
      name: updatedProjectName,
      updatedAt: project.updatedAt + 1,
    };

    await adapter.writeProject(project.id, updatedProject);

    const refreshedProject = await adapter.readProject(project.id);
    expect(refreshedProject?.name).toBe(updatedProjectName);
  });
});
