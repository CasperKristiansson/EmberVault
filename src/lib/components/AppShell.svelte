<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { MobileView } from "$lib/core/utils/mobile-view";

  export let saveState: "idle" | "saving" | "saved" = "idle";
  export let mobileView: MobileView = "notes";
  export let mobileRightPanelOpen = false;
  export let workspaceMode: "notes" = "notes";
  export let interfaceDensity: "comfortable" | "compact" = "comfortable";
  export let mobileKeyboardInset = 0;

  const dispatch = createEventDispatcher<{
    closeRightPanel: void;
  }>();

  const handleCloseRightPanel = (): void => {
    dispatch("closeRightPanel");
  };
</script>

<div
  class="app-shell"
  style={`--mobile-keyboard-inset:${Math.max(0, mobileKeyboardInset)}px;`}
  data-save-state={saveState}
  data-mobile-view={mobileView}
  data-mobile-right-panel={mobileRightPanelOpen ? "open" : "closed"}
  data-workspace-mode={workspaceMode}
  data-density={interfaceDensity}
>
  <div class="topbar" data-testid="topbar-pane">
    <slot name="topbar" />
  </div>

  <section class="note-list" data-testid="note-list-pane">
    <slot name="note-list" />
  </section>

  <main class="editor" data-testid="editor-pane">
    <slot name="editor" />
  </main>

  <button
    class="right-panel-backdrop"
    type="button"
    aria-label="Close right panel"
    data-testid="right-panel-backdrop"
    on:click={handleCloseRightPanel}
  ></button>

  <aside class="right-panel" data-testid="right-panel-pane">
    <slot name="right-panel" />
  </aside>

  <nav class="mobile-nav" data-testid="mobile-nav" aria-label="Primary">
    <slot name="bottom-nav" />
  </nav>

  <div class="app-shell-default-slot" aria-hidden="true">
    <slot />
  </div>

  <slot name="modal" />
  <slot name="toast" />
  <slot name="startup-overlay" />
</div>

<style>
  .app-shell {
    --note-list-width: 340px;
    --right-panel-width: 320px;
    --density-list-row-height-desktop: 34px;
    --density-list-row-height-mobile: 40px;
    --density-note-row-gap: 4px;
    --density-note-list-padding: 20px 16px;
    --density-note-list-gap: 16px;
    --density-editor-padding: 24px;
    --density-editor-padding-mobile: 16px;
    --density-editor-gap: 16px;
    --density-right-panel-padding: 20px 16px;
    --density-right-panel-gap: 12px;
    --mobile-keyboard-inset: 0px;

    display: grid;
    grid-template-columns: minmax(280px, var(--note-list-width)) minmax(0, 1fr)
      minmax(280px, var(--right-panel-width));
    grid-template-rows: 44px 1fr;
    height: 100vh;
    height: 100svh;
    background: var(--bg-0);
    color: var(--text-0);
    overflow-x: clip;
  }

  .topbar {
    grid-column: 1 / 4;
    grid-row: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--stroke-0);
    overflow: hidden;
  }

  .note-list {
    grid-column: 1;
    grid-row: 2;
    background: var(--bg-1);
    border-right: 1px solid var(--stroke-0);
    display: flex;
    flex-direction: column;
    padding: var(--density-note-list-padding);
    gap: var(--density-note-list-gap);
    overflow: hidden;
  }

  .editor {
    grid-column: 2;
    grid-row: 2;
    background: var(--bg-1);
    display: flex;
    flex-direction: column;
    padding: var(--density-editor-padding);
    gap: var(--density-editor-gap);
    overflow: auto;
  }

  .right-panel {
    grid-column: 3;
    grid-row: 2;
    background: var(--bg-1);
    border-left: 1px solid var(--stroke-0);
    padding: var(--density-right-panel-padding);
    display: flex;
    flex-direction: column;
    gap: var(--density-right-panel-gap);
  }

  .app-shell[data-density="compact"] {
    --density-list-row-height-desktop: 32px;
    --density-list-row-height-mobile: 36px;
    --density-note-list-padding: 16px 12px;
    --density-note-list-gap: 12px;
    --density-editor-padding: 16px;
    --density-editor-padding-mobile: 12px;
    --density-editor-gap: 12px;
    --density-right-panel-padding: 16px 12px;
  }

  .mobile-nav {
    display: none;
  }

  .right-panel-backdrop {
    display: none;
    border: 0;
    padding: 0;
    background: rgba(7, 9, 12, 0.48);
    backdrop-filter: blur(2px);
  }

  .app-shell-default-slot {
    display: none;
  }

  @media (max-width: 1100px) {
    .app-shell {
      grid-template-columns: minmax(240px, var(--note-list-width)) minmax(0, 1fr);
    }

    .topbar {
      grid-column: 1 / 3;
    }

    .note-list {
      grid-column: 1;
    }

    .editor {
      grid-column: 2;
    }

    .right-panel {
      position: fixed;
      top: calc(44px + env(safe-area-inset-top));
      right: 0;
      bottom: 0;
      width: min(320px, 86vw);
      z-index: 20;
      box-shadow: var(--shadow-panel);
      transform: translateX(100%);
      transition: transform 160ms ease;
    }

    .right-panel-backdrop {
      position: fixed;
      inset: calc(44px + env(safe-area-inset-top)) 0 0 0;
      z-index: 18;
    }

    .app-shell[data-mobile-right-panel="open"] .right-panel {
      transform: translateX(0);
    }

    .app-shell[data-mobile-right-panel="open"] .right-panel-backdrop {
      display: block;
    }
  }

  @media (max-width: 767px) {
    .app-shell {
      grid-template-columns: 1fr;
      grid-template-rows: 44px 1fr 56px;
    }

    .topbar {
      grid-column: 1;
      grid-row: 1;
      padding: env(safe-area-inset-top) 12px 0;
    }

    .note-list,
    .editor,
    .right-panel {
      grid-column: 1;
      grid-row: 2;
    }

    .note-list,
    .editor {
      display: none;
    }

    .app-shell[data-mobile-view="notes"] .note-list {
      display: flex;
    }

    .app-shell[data-mobile-view="editor"] .editor {
      display: flex;
    }

    .editor {
      padding: var(--density-editor-padding-mobile);
    }

    .right-panel {
      position: fixed;
      top: calc(44px + env(safe-area-inset-top));
      bottom: calc(56px + env(safe-area-inset-bottom));
      width: min(320px, 86vw);
      z-index: 20;
      box-shadow: var(--shadow-panel);
    }

    .right-panel {
      right: 0;
      transform: translateX(100%);
    }

    .app-shell[data-mobile-right-panel="open"] .right-panel {
      transform: translateX(0);
    }

    .app-shell[data-mobile-right-panel="open"] .right-panel-backdrop {
      display: block;
      position: fixed;
      inset: calc(44px + env(safe-area-inset-top)) 0
        calc(56px + env(safe-area-inset-bottom) + var(--mobile-keyboard-inset)) 0;
      z-index: 18;
    }

    .mobile-nav {
      grid-column: 1;
      grid-row: 3;
      display: flex;
      align-items: center;
      justify-content: space-around;
      height: calc(56px + env(safe-area-inset-bottom));
      padding: 0 12px env(safe-area-inset-bottom);
      transform: translateY(calc(var(--mobile-keyboard-inset) * -1));
      background: var(--bg-1);
      border-top: 1px solid var(--stroke-0);
    }
  }
</style>
