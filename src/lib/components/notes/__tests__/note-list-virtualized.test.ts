import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import NoteListVirtualized from "../NoteListVirtualized.svelte";
import type { NoteIndexEntry } from "../../../core/storage/types";

const ResizeObserverMock: typeof ResizeObserver = class ResizeObserverMock {
  public readonly observed = new Set<Element>();

  public observe(target?: Element): void {
    if (target) {
      this.observed.add(target);
    }
  }

  public unobserve(target?: Element): void {
    if (target) {
      this.observed.delete(target);
    }
  }

  public disconnect(): void {
    this.observed.clear();
  }
};

// eslint-disable-next-line compat/compat
globalThis.ResizeObserver = ResizeObserverMock;

afterEach(() => {
  cleanup();
});

const buildNotes = (count: number): NoteIndexEntry[] => {
  const notes: NoteIndexEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    notes.push({
      id: `note-${index}`,
      title: `Note ${index}`,
      folderId: null,
      tagIds: [],
      favorite: false,
      createdAt: index,
      updatedAt: index,
      deletedAt: null,
      isTemplate: false,
    });
  }
  return notes;
};

describe("NoteListVirtualized", () => {
  it("renders all rows when below virtualization threshold", () => {
    const notes = buildNotes(12);
    const { getByTestId } = render(NoteListVirtualized, {
      props: {
        notes,
        activeNoteId: notes[0]?.id ?? null,
        virtualizeThreshold: 100,
      },
    });

    const activeRow = getByTestId(`note-row-${notes[0]?.id ?? ""}`);
    expect(activeRow.classList.contains("active")).toBe(true);

    const lastNoteId = notes.at(-1)?.id ?? "";
    const lastRow = getByTestId(`note-row-${lastNoteId}`);
    expect(lastRow).toBeTruthy();
  });

  it("calls onSelect when a note row is clicked", async () => {
    const notes = buildNotes(3);
    const onSelect = vi.fn();
    const { getByTestId } = render(NoteListVirtualized, {
      props: {
        notes,
        onSelect,
        activeNoteId: null,
        virtualizeThreshold: 100,
      },
    });

    const targetId = notes[1]?.id ?? "";
    const row = getByTestId(`note-row-${targetId}`);
    await fireEvent.click(row);

    expect(onSelect).toHaveBeenCalledWith(targetId);
  });

  it("virtualizes rows above the threshold and updates on scroll", async () => {
    const notes = buildNotes(140);
    const { getByTestId, queryByTestId } = render(NoteListVirtualized, {
      props: {
        notes,
        activeNoteId: notes[0]?.id ?? null,
        virtualizeThreshold: 100,
      },
    });

    const list = getByTestId("note-list");
    if (!(list instanceof HTMLDivElement)) {
      throw new TypeError("Expected note list to be a div");
    }

    expect(list.getAttribute("data-virtualized")).toBe("true");

    const lastId = notes.at(-1)?.id ?? "";
    expect(queryByTestId(`note-row-${lastId}`)).toBeNull();

    const rowStep = 38;
    list.scrollTop = rowStep * (notes.length - 1);
    list.dispatchEvent(new Event("scroll"));
    await tick();

    expect(queryByTestId(`note-row-${lastId}`)).toBeTruthy();
  });

  it("limits rendered rows for large lists", () => {
    const notes = buildNotes(400);
    const { container, getByTestId } = render(NoteListVirtualized, {
      props: {
        notes,
        activeNoteId: notes[0]?.id ?? null,
        virtualizeThreshold: 100,
      },
    });

    const list = getByTestId("note-list");
    expect(list.getAttribute("data-virtualized")).toBe("true");

    const renderedRows = container.querySelectorAll(
      '[data-testid^="note-row-"]'
    );
    expect(renderedRows.length).toBeLessThan(50);
  });
});
