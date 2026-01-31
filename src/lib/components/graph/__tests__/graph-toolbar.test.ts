/* eslint-disable sonarjs/no-implicit-dependencies */
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import GraphToolbar from "$lib/components/graph/GraphToolbar.svelte";

describe("GraphToolbar", () => {
  afterEach(cleanup);

  it("toggles mode buttons", async () => {
    const { getByText } = render(GraphToolbar, {
      props: {
        mode: "project",
      },
    });

    const projectButton = getByText("Project");
    const neighborhoodButton = getByText("Neighborhood");

    expect(projectButton.getAttribute("aria-pressed")).toBe("true");

    await fireEvent.click(neighborhoodButton);

    expect(neighborhoodButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("invokes recenter callback and disables depth when requested", async () => {
    const onRecenter = vi.fn();
    const { getByRole, getByLabelText } = render(GraphToolbar, {
      props: {
        depth: 2,
        depthDisabled: true,
        onRecenter,
      },
    });

    const slider = getByLabelText("Neighborhood depth");
    if (!(slider instanceof HTMLInputElement)) {
      throw new TypeError("Expected range input for depth slider.");
    }
    expect(slider.disabled).toBe(true);

    const recenterButton = getByRole("button", { name: "Recenter" });
    await fireEvent.click(recenterButton);
    expect(onRecenter).toHaveBeenCalled();
  });
});
