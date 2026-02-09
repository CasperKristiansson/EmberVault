<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { HardDrive, Database, Keyboard, Settings, X } from "lucide-svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import type { StorageMode } from "$lib/state/adapter.store";

  export let storageMode: StorageMode = "idb";
  export let settingsVaultName: string | null = null;
  export let supportsFileSystem = true;
  export let settingsBusy = false;
  export let onClose: (() => void | Promise<void>) | null = null;
  export let onChooseFolder: (() => void | Promise<void>) | null = null;
  export let onChooseBrowserStorage: (() => void | Promise<void>) | null = null;

  type SettingsSection = "storage" | "general" | "shortcuts";
  let activeSection: SettingsSection = "storage";
</script>

<div
  class="modal-overlay"
  data-testid="settings-modal"
  transition:motion={{ preset: "fade", reducedMotion: $prefersReducedMotion }}
>
  <div
    class="modal-panel"
    role="dialog"
    aria-modal="true"
    transition:motion={{ preset: "modal", reducedMotion: $prefersReducedMotion }}
  >
    <header class="modal-header">
      <div class="modal-heading">
        <div class="modal-title">Settings</div>
        <div class="modal-subtitle">Manage storage and preferences</div>
      </div>
      <button
        class="icon-button"
        type="button"
        aria-label="Close settings"
        on:click={() => void onClose?.()}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </header>

    <div class="modal-body">
      <nav class="settings-nav" aria-label="Settings sections">
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "storage"}
          on:click={() => (activeSection = "storage")}
        >
          <HardDrive aria-hidden="true" size={16} />
          <span>Storage</span>
        </button>
        <button
          class="settings-item"
          type="button"
          disabled
          aria-disabled="true"
        >
          <Settings aria-hidden="true" size={16} />
          <span>General</span>
        </button>
        <button
          class="settings-item"
          type="button"
          disabled
          aria-disabled="true"
        >
          <Keyboard aria-hidden="true" size={16} />
          <span>Shortcuts</span>
        </button>
      </nav>

      <section class="settings-content">
        {#if activeSection === "storage"}
          <div class="section-header">
            <div class="section-title">Storage</div>
            <div class="section-description">Choose where your notes live.</div>
          </div>

          {#if !supportsFileSystem}
            <div class="info-note">
              Your browser doesn&apos;t support folder storage.
            </div>
          {/if}

          <div class="cards">
            <div
              class="card"
              data-active={storageMode === "filesystem"}
              data-disabled={!supportsFileSystem}
            >
              <div class="card-icon" aria-hidden="true">
                <HardDrive aria-hidden="true" size={16} />
              </div>
              <div class="card-copy">
                <h2>Use a folder on this device</h2>
                <p>Keep files in a folder you choose (best in Chrome/Edge).</p>
              </div>
              {#if settingsVaultName}
                <div class="card-meta">
                  Current folder: <span>{settingsVaultName}</span>
                </div>
              {/if}
              <button
                class="button primary"
                type="button"
                on:click={() => void onChooseFolder?.()}
                disabled={!supportsFileSystem || settingsBusy}
              >
                {storageMode === "filesystem" ? "Change folder" : "Choose folder"}
              </button>
            </div>

            <div class="card" data-active={storageMode === "idb"}>
              <div class="card-icon" aria-hidden="true">
                <Database aria-hidden="true" size={16} />
              </div>
              <div class="card-copy">
                <h2>Store in this browser</h2>
                <p>IndexedDB keeps everything local and works everywhere.</p>
              </div>
              <button
                class="button secondary"
                type="button"
                on:click={() => void onChooseBrowserStorage?.()}
                disabled={storageMode === "idb" || settingsBusy}
              >
                {storageMode === "idb"
                  ? "Using browser storage"
                  : "Use browser storage"}
              </button>
            </div>
          </div>
        {:else}
          <div class="placeholder">
            <div class="placeholder-title">Coming soon</div>
            <p>More settings will appear here.</p>
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-panel {
    width: min(720px, calc(100% - 32px));
    height: min(520px, 80vh);
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-panel);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    z-index: 110;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .modal-heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .modal-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-0);
  }

  .modal-subtitle {
    font-size: 12px;
    color: var(--text-1);
  }

  .modal-body {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 16px;
    flex: 1;
    min-height: 0;
  }

  .settings-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .settings-item {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
  }

  .settings-item[data-active="true"] {
    background: var(--bg-2);
    border-color: var(--stroke-0);
    color: var(--text-0);
  }

  .settings-item:hover:enabled {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .settings-item:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .settings-content {
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: auto;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-title {
    font-size: 13px;
    font-weight: 500;
  }

  .section-description {
    font-size: 12px;
    color: var(--text-1);
  }

  .info-note {
    padding: 10px 12px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    color: var(--text-1);
    font-size: 12px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
  }

  .card[data-active="true"] {
    border-color: var(--accent-2);
    box-shadow: inset 0 0 0 1px var(--accent-2);
  }

  .card[data-disabled="true"] {
    opacity: 0.65;
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
    font-size: 14px;
  }

  .card-copy p {
    margin: 0;
    color: var(--text-1);
    font-size: 12px;
  }

  .card-meta {
    font-size: 12px;
    color: var(--text-2);
  }

  .card-meta span {
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

  .button.secondary {
    background: transparent;
    border-color: var(--stroke-1);
    color: var(--text-0);
  }

  .button.secondary:hover:enabled {
    background: var(--bg-3);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .icon-button {
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: var(--r-md);
    border: none;
    background: transparent;
    color: var(--text-1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .icon-button:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .icon-button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .placeholder {
    border-radius: var(--r-md);
    border: 1px dashed var(--stroke-1);
    padding: 24px;
    text-align: center;
    color: var(--text-1);
    background: rgba(255, 255, 255, 0.01);
  }

  .placeholder-title {
    font-weight: 500;
    margin-bottom: 4px;
    color: var(--text-0);
  }

  @media (max-width: 800px) {
    .modal-panel {
      width: min(92vw, 720px);
      height: min(78vh, 520px);
    }

    .modal-body {
      grid-template-columns: 1fr;
    }

    .settings-nav {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 8px;
    }

    .settings-item {
      flex: 1 1 140px;
      justify-content: center;
    }
  }
</style>
