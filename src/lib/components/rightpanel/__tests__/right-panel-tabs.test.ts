/* eslint-disable sonarjs/no-implicit-dependencies */
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import RightPanelTabs from "$lib/components/rightpanel/RightPanelTabs.svelte";

const getPressedState = (element: HTMLElement): string | null =>
  element.getAttribute("aria-pressed");

describe("RightPanelTabs", () => {
  afterEach(cleanup);

  it("marks the active tab and switches on click", async () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(RightPanelTabs, {
      props: {
        activeTab: "outline",
        onSelect,
      },
    });

    const outline = getByTestId("right-panel-tab-outline");
    const metadata = getByTestId("right-panel-tab-metadata");

    expect(getPressedState(outline)).toBe("true");
    expect(getPressedState(metadata)).toBe("false");

    await fireEvent.click(metadata);

    expect(onSelect).toHaveBeenCalledWith("metadata");
  });

  it("renders metadata as active when selected", () => {
    const { getByTestId } = render(RightPanelTabs, {
      props: {
        activeTab: "metadata",
      },
    });

    const metadata = getByTestId("right-panel-tab-metadata");

    expect(getPressedState(metadata)).toBe("true");
  });
});
