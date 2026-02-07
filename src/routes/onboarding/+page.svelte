  <script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { Database, Folder } from "lucide-svelte";
    import { createDefaultProject } from "$lib/core/storage/indexeddb.adapter";
  import {
    initAdapter,
    type StorageMode,
  } from "$lib/state/adapter.store";

  let supportsFileSystem = false;
  let isBusy = false;
  let activeMode: StorageMode | null = null;
  let errorMessage = "";

  const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === "AbortError";

  onMount(() => {
    supportsFileSystem =
      typeof window !== "undefined" &&
      typeof window.showDirectoryPicker === "function";
  });

  const initBrowserStorage = async (): Promise<void> => {
    if (isBusy) {
      return;
    }
    isBusy = true;
    activeMode = "idb";
    errorMessage = "";
    try {
      const adapter = initAdapter("idb");
      await adapter.init();
      const projects = await adapter.listProjects();
      const project = projects[0] ?? createDefaultProject();
      if (projects.length === 0) {
        await adapter.createProject(project);
      }
      await adapter.writeUIState({ lastProjectId: project.id });
      await goto(resolve("/app"));
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Unable to set up storage.";
    } finally {
      isBusy = false;
      activeMode = null;
    }
  };

  const initFolderStorage = async (): Promise<void> => {
    if (isBusy || !supportsFileSystem || !window.showDirectoryPicker) {
      return;
    }
    isBusy = true;
    activeMode = "filesystem";
    errorMessage = "";
    try {
      const handle = await window.showDirectoryPicker();
      const adapter = initAdapter("filesystem", { directoryHandle: handle });
      await adapter.init();
      const projects = await adapter.listProjects();
      const project = projects[0] ?? createDefaultProject();
      if (projects.length === 0) {
        await adapter.createProject(project);
      }
      await adapter.writeUIState({ lastProjectId: project.id });
      await goto(resolve("/app"));
    } catch (error) {
      if (!isAbortError(error)) {
        errorMessage =
          error instanceof Error ? error.message : "Unable to access folder.";
      }
    } finally {
      isBusy = false;
      activeMode = null;
    }
  };
</script>

<div class="onboarding">
  <header class="hero">
    <h1>Choose where your notes live</h1>
    <p>Store everything locally. No accounts. No cloud.</p>
  </header>

  <div class="cards">
    {#if !supportsFileSystem}
      <div class="info-note">
        Your browser doesn&apos;t support folder storage.
      </div>
    {/if}

    {#if supportsFileSystem}
      <div class="card">
        <div class="card-icon" aria-hidden="true">
          <Folder aria-hidden="true" size={16} />
        </div>
        <div class="card-copy">
          <h2>Use a folder on this device</h2>
          <p>Keep files in a folder you choose (best in Chrome/Edge).</p>
        </div>
        <button
          class="button primary"
          data-testid="use-folder-storage"
          on:click={initFolderStorage}
          disabled={isBusy}
        >
          {activeMode === "filesystem" ? "Opening folder..." : "Choose folder"}
        </button>
      </div>
    {/if}

    <div class="card">
      <div class="card-icon" aria-hidden="true">
        <Database aria-hidden="true" size={16} />
      </div>
      <div class="card-copy">
        <h2>Store in this browser</h2>
        <p>IndexedDB keeps everything local and works everywhere.</p>
      </div>
      <button
        class="button primary"
        data-testid="use-browser-storage"
        on:click={initBrowserStorage}
        disabled={isBusy}
      >
        {activeMode === "idb" ? "Setting up..." : "Use browser storage"}
      </button>
    </div>
  </div>

  {#if errorMessage}
    <p class="error" role="alert">{errorMessage}</p>
  {/if}
</div>

<style>
  .onboarding {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 48px 24px;
    max-width: 920px;
    margin: 0 auto;
  }

  .hero {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hero p {
    color: var(--text-1);
    margin: 0;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
  }

  .card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 16px;
    padding: 20px;
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
  }

  .card-icon {
    width: 32px;
    height: 32px;
    border-radius: var(--r-sm);
    background: var(--bg-2);
    color: var(--accent-0);
    display: grid;
    place-items: center;
  }

  .card-copy h2 {
    margin-bottom: 6px;
  }

  .card-copy p {
    margin: 0;
    color: var(--text-1);
  }

  .button {
    height: 32px;
    padding: 0 14px;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    cursor: pointer;
  }

  .button.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .button.primary:hover:enabled {
    background: var(--accent-1);
  }

  .button.primary:active:enabled {
    transform: translateY(0.5px);
    filter: brightness(0.96);
  }

  .button.primary:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .info-note {
    padding: 12px 16px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-1);
  }

  .error {
    color: var(--danger);
    margin: 0;
  }

  @media (max-width: 600px) {
    .onboarding {
      padding: 32px 20px;
    }
  }
</style>
