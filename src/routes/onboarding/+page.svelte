<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import {
    createDefaultProject,
    IndexedDBAdapter,
  } from "$lib/core/storage/indexeddb.adapter";

  const supportsFileSystem = false;
  let isBusy = false;
  let errorMessage = "";

  const adapter = new IndexedDBAdapter();

  const initBrowserStorage = async () => {
    if (isBusy) {
      return;
    }
    isBusy = true;
    errorMessage = "";
    try {
      await adapter.init();
      const projects = await adapter.listProjects();
      const project = projects[0] ?? createDefaultProject();
      if (projects.length === 0) {
        await adapter.createProject(project);
      }
      await adapter.writeUIState({ lastProjectId: project.id });
      await goto(resolve("/app/[projectId]", { projectId: project.id }));
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Unable to set up storage.";
    } finally {
      isBusy = false;
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

    <div class="card">
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
        {isBusy ? "Setting up..." : "Use browser storage"}
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
