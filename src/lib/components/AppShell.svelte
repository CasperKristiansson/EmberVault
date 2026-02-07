<script lang="ts">
  import type { MobileView } from "$lib/core/utils/mobile-view";

  export let saveState: "idle" | "saving" | "saved" = "idle";
  export let mobileView: MobileView = "notes";
  export let mobileSidebarOpen = false;
  export let mobileRightPanelOpen = false;
  export let workspaceMode: "notes" = "notes";
</script>

<div
  class="app-shell"
  data-save-state={saveState}
  data-mobile-view={mobileView}
  data-mobile-sidebar={mobileSidebarOpen ? "open" : "closed"}
  data-mobile-right-panel={mobileRightPanelOpen ? "open" : "closed"}
  data-workspace-mode={workspaceMode}
>
  <aside class="sidebar" data-testid="sidebar-pane">
    <slot name="sidebar" />
  </aside>

  <div class="topbar" data-testid="topbar-pane">
    <slot name="topbar" />
  </div>

  <section class="note-list" data-testid="note-list-pane">
    <slot name="note-list" />
  </section>

  <main class="editor" data-testid="editor-pane">
    <slot name="editor" />
  </main>

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
</div>

<style>
  .app-shell {
    --sidebar-width: 280px;
    --note-list-width: 340px;
    --right-panel-width: 320px;

    display: grid;
    grid-template-columns: minmax(240px, var(--sidebar-width))
      minmax(280px, var(--note-list-width))
      minmax(0, 1fr)
      minmax(280px, var(--right-panel-width));
    grid-template-rows: 44px 1fr;
    height: 100vh;
    background: var(--bg-0);
    color: var(--text-0);
  }

  .topbar {
    grid-column: 2 / 5;
    grid-row: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--stroke-0);
  }

  .sidebar {
    grid-column: 1;
    grid-row: 1 / 3;
    background: var(--bg-1);
    border-right: 1px solid var(--stroke-0);
    display: flex;
    flex-direction: column;
    padding: 20px 16px;
    gap: 8px;
  }

  .note-list {
    grid-column: 2;
    grid-row: 2;
    background: var(--bg-1);
    border-right: 1px solid var(--stroke-0);
    display: flex;
    flex-direction: column;
    padding: 20px 16px;
    gap: 16px;
    overflow: hidden;
  }

  .editor {
    grid-column: 3;
    grid-row: 2;
    background: var(--bg-1);
    display: flex;
    flex-direction: column;
    padding: 24px;
    gap: 16px;
    overflow: auto;
  }

  .right-panel {
    grid-column: 4;
    grid-row: 2;
    background: var(--bg-1);
    border-left: 1px solid var(--stroke-0);
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mobile-nav {
    display: none;
  }

  .app-shell-default-slot {
    display: none;
  }

  @media (max-width: 767px) {
    .app-shell {
      grid-template-columns: 1fr;
      grid-template-rows: 44px 1fr 56px;
    }

    .topbar {
      grid-column: 1;
      grid-row: 1;
      padding: 0 12px;
    }

    .sidebar,
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
      padding: 16px;
    }

    .sidebar,
    .right-panel {
      position: fixed;
      top: 44px;
      bottom: 56px;
      width: min(320px, 86vw);
      z-index: 20;
      box-shadow: var(--shadow-panel);
    }

    .sidebar {
      left: 0;
      transform: translateX(-100%);
    }

    .right-panel {
      right: 0;
      transform: translateX(100%);
    }

    .app-shell[data-mobile-sidebar="open"] .sidebar {
      transform: translateX(0);
    }

    .app-shell[data-mobile-right-panel="open"] .right-panel {
      transform: translateX(0);
    }

    .mobile-nav {
      grid-column: 1;
      grid-row: 3;
      display: flex;
      align-items: center;
      justify-content: space-around;
      height: 56px;
      padding: 0 12px;
      background: var(--bg-1);
      border-top: 1px solid var(--stroke-0);
    }
  }
</style>
