  <script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { Database, Folder } from "lucide-svelte";
    import { createDefaultVault } from "$lib/core/storage/indexeddb.adapter";
    import {
      readAppSettings,
      writeAppSettings,
    } from "$lib/core/storage/app-settings";
    import type { AppSettings } from "$lib/core/storage/types";
    import { initAdapter, type StorageMode } from "$lib/state/adapter.store";

  let supportsFileSystem = false;
  let isBusy = false;
  let activeMode: StorageMode | null = null;
  let errorMessage = "";

  const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === "AbortError";

  const isCloneError = (error: unknown): boolean =>
    (error instanceof DOMException && error.name === "DataCloneError") ||
    (error instanceof Error && error.message.includes("could not be cloned"));

  const setEphemeralHandle = (handle?: FileSystemDirectoryHandle): void => {
    if (typeof window === "undefined") {
      return;
    }
    const globalWithHandle = globalThis as typeof globalThis & {
      __emberVaultFsHandle?: FileSystemDirectoryHandle;
    };
    if (handle) {
      globalWithHandle.__emberVaultFsHandle = handle;
      return;
    }
    delete globalWithHandle.__emberVaultFsHandle;
  };

  const persistStorageChoice = async (
    mode: StorageMode,
    handle?: FileSystemDirectoryHandle
  ): Promise<void> => {
    const existing = await readAppSettings();
    const nextSettings: AppSettings = {
      storageMode: mode,
      fsHandle: mode === "filesystem" ? handle : undefined,
      lastVaultName: mode === "filesystem" ? handle?.name : undefined,
      settings: existing?.settings,
    };
    setEphemeralHandle(mode === "filesystem" ? handle : undefined);
    try {
      await writeAppSettings(nextSettings);
      return;
    } catch (error) {
      if (mode !== "filesystem" || !isCloneError(error)) {
        throw error;
      }
      await writeAppSettings({
        ...nextSettings,
        fsHandle: undefined,
      });
    }
  };

  const attemptAutoEnter = async (): Promise<void> => {
    const stored = await readAppSettings();
    if (!stored?.storageMode) {
      return;
    }
    if (stored.storageMode === "filesystem" && !stored.fsHandle) {
      return;
    }
    isBusy = true;
    activeMode = stored.storageMode;
    await goto(resolve("/app"));
  };

  onMount(() => {
    supportsFileSystem =
      typeof window !== "undefined" &&
      typeof window.showDirectoryPicker === "function";
    void attemptAutoEnter();
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
      const existingVault = await adapter.readVault();
      if (!existingVault) {
        await adapter.writeVault(createDefaultVault());
      }
      await persistStorageChoice("idb");
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
      const existingVault = await adapter.readVault();
      if (!existingVault) {
        await adapter.writeVault(createDefaultVault());
      }
      await persistStorageChoice("filesystem", handle);
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
    <p class="hero-note">You can switch storage later in Settings.</p>
  </header>

  <div class="cards">
    {#if !supportsFileSystem}
      <div class="info-note">
        Your browser doesn&apos;t support folder storage.
      </div>
    {/if}

    {#if supportsFileSystem}
      <div class="card">
        <div class="card-head">
          <div class="card-icon" aria-hidden="true">
            <Folder aria-hidden="true" size={16} />
          </div>
          <span class="badge">Recommended</span>
        </div>
        <div class="card-copy">
          <h2>Use a folder on this device</h2>
          <p>Keep files in a folder you choose (best in Chrome/Edge).</p>
        </div>
        <ul class="card-list">
          <li>Files are visible in Finder</li>
          <li>Best for large vaults</li>
          <li>Requires one-time permission</li>
        </ul>
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
      <div class="card-head">
        <div class="card-icon" aria-hidden="true">
          <Database aria-hidden="true" size={16} />
        </div>
      </div>
      <div class="card-copy">
        <h2>Store in this browser</h2>
        <p>IndexedDB keeps everything local and works everywhere.</p>
      </div>
      <ul class="card-list">
        <li>Fast setup, no permissions</li>
        <li>Great for quick trials</li>
        <li>Clears if browser data is erased</li>
      </ul>
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

  <div class="footer-note">
    We never upload your data. Storage stays on this device.
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

  .hero-note {
    font-size: 12px;
    color: var(--text-2);
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

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .badge {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    color: var(--text-1);
  }

  .card-copy h2 {
    margin-bottom: 6px;
  }

  .card-copy p {
    margin: 0;
    color: var(--text-1);
  }

  .card-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--text-2);
    font-size: 12px;
  }

  .card-list li::before {
    content: "•";
    margin-right: 6px;
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

  .footer-note {
    font-size: 12px;
    color: var(--text-2);
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
