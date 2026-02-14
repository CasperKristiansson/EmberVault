<script lang="ts">
  import { motion } from "@motionone/svelte";
  import {
    ArrowDownUp,
    Cloud,
    Database,
    HardDrive,
    Info,
    Keyboard,
    FileText,
    Palette,
    PenLine,
    Shield,
    SlidersHorizontal,
    X,
  } from "lucide-svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import type { StorageMode } from "$lib/state/adapter.store";
  import type { AppPreferences, S3Config } from "$lib/core/storage/types";
  import type { VaultIntegrityReport } from "$lib/core/utils/vault-integrity";

  const defaultPreferences: AppPreferences = {
    startupView: "last-opened",
    defaultSort: "updated",
    openNoteBehavior: "new-tab",
    newNoteLocation: "current-folder",
    confirmTrash: true,
    spellcheck: true,
    showNoteDates: true,
    showNotePreview: true,
    showTagPillsInList: true,
    markdownViewByDefault: false,
    smartListContinuation: true,
    interfaceDensity: "comfortable",
    accentColor: "orange",
  };

  export let storageMode: StorageMode = "idb";
  export let settingsVaultName: string | null = null;
  export let settingsS3Bucket: string | null = null;
  export let settingsS3Region: string | null = null;
  export let settingsS3Prefix: string | null = null;
  export let supportsFileSystem = true;
  export let settingsBusy = false;
  export let preferences: AppPreferences = defaultPreferences;
  export let onClose: (() => void | Promise<void>) | null = null;
  export let onChooseFolder: (() => void | Promise<void>) | null = null;
  export let onChooseBrowserStorage: (() => void | Promise<void>) | null = null;
  export let onConnectS3:
    | ((config: S3Config) => void | Promise<void>)
    | null = null;
  export let onUpdatePreferences:
    | ((patch: Partial<AppPreferences>) => void | Promise<void>)
    | null = null;
  export let onExportVault: (() => void | Promise<void>) | null = null;
  export let onImportFromFolder: (() => void | Promise<void>) | null = null;
  export let onDownloadBackup: (() => void | Promise<void>) | null = null;
  export let onRestoreBackup: ((file: File) => void | Promise<void>) | null =
    null;
  export let onRunIntegrityCheck:
    | (() => Promise<VaultIntegrityReport>)
    | null = null;
  export let onRepairVault:
    | ((report: VaultIntegrityReport) => void | Promise<void>)
    | null = null;
  export let onRebuildSearchIndex: (() => void | Promise<void>) | null = null;
  export let onClearWorkspaceState: (() => void | Promise<void>) | null = null;
  export let onResetPreferences: (() => void | Promise<void>) | null = null;

  type SettingsSection =
    | "storage"
    | "general"
    | "notes"
    | "editor"
    | "appearance"
    | "shortcuts"
    | "import-export"
    | "privacy"
    | "about";
  let activeSection: SettingsSection = "storage";
  $: preferencesDisabled = !onUpdatePreferences || settingsBusy;

  let s3Bucket = "";
  let s3Region = "";
  let s3Prefix = "embervault/";
  let s3AccessKeyId = "";
  let s3SecretAccessKey = "";
  let s3SessionToken = "";
  let s3Dirty = false;

  $: if (!s3Dirty) {
    s3Bucket = settingsS3Bucket ?? s3Bucket;
    s3Region = settingsS3Region ?? s3Region;
    s3Prefix = settingsS3Prefix ?? s3Prefix;
  }

  const buildS3Config = (): S3Config => ({
    bucket: s3Bucket.trim(),
    region: s3Region.trim(),
    prefix: s3Prefix.trim() ? s3Prefix.trim() : undefined,
    accessKeyId: s3AccessKeyId.trim(),
    secretAccessKey: s3SecretAccessKey.trim(),
    sessionToken: s3SessionToken.trim() ? s3SessionToken.trim() : undefined,
  });

  let restoreBackupInput: HTMLInputElement | null = null;

  const openRestoreBackupPicker = (): void => {
    restoreBackupInput?.click();
  };

  const handleRestoreBackupChange = (): void => {
    const file = restoreBackupInput?.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (restoreBackupInput) {
      restoreBackupInput.value = "";
    }
    void onRestoreBackup?.(file);
  };

  let integrityReport: VaultIntegrityReport | null = null;
  let integrityBusy = false;

  const runIntegrityCheck = async (): Promise<void> => {
    if (!onRunIntegrityCheck || integrityBusy) {
      return;
    }
    integrityBusy = true;
    try {
      integrityReport = await onRunIntegrityCheck();
    } finally {
      integrityBusy = false;
    }
  };

  const repairVault = async (): Promise<void> => {
    if (!onRepairVault || !integrityReport || integrityBusy) {
      return;
    }
    integrityBusy = true;
    try {
      await onRepairVault(integrityReport);
      if (onRunIntegrityCheck) {
        integrityReport = await onRunIntegrityCheck();
      }
    } finally {
      integrityBusy = false;
    }
  };
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
          data-active={activeSection === "general"}
          on:click={() => (activeSection = "general")}
        >
          <SlidersHorizontal aria-hidden="true" size={16} />
          <span>General</span>
        </button>
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "notes"}
          on:click={() => (activeSection = "notes")}
        >
          <FileText aria-hidden="true" size={16} />
          <span>Notes</span>
        </button>
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "editor"}
          on:click={() => (activeSection = "editor")}
        >
          <PenLine aria-hidden="true" size={16} />
          <span>Editor</span>
        </button>
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "appearance"}
          on:click={() => (activeSection = "appearance")}
        >
          <Palette aria-hidden="true" size={16} />
          <span>Appearance</span>
        </button>
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "shortcuts"}
          on:click={() => (activeSection = "shortcuts")}
        >
          <Keyboard aria-hidden="true" size={16} />
          <span>Shortcuts</span>
        </button>
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "import-export"}
          on:click={() => (activeSection = "import-export")}
        >
          <ArrowDownUp aria-hidden="true" size={16} />
          <span>Import/Export</span>
        </button>
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "privacy"}
          on:click={() => (activeSection = "privacy")}
        >
          <Shield aria-hidden="true" size={16} />
          <span>Privacy</span>
        </button>
        <button
          class="settings-item"
          type="button"
          data-active={activeSection === "about"}
          on:click={() => (activeSection = "about")}
        >
          <Info aria-hidden="true" size={16} />
          <span>About</span>
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
              {#if storageMode === "filesystem" && settingsVaultName}
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

            <div class="card" data-active={storageMode === "s3"}>
              <div class="card-icon" aria-hidden="true">
                <Cloud aria-hidden="true" size={16} />
              </div>
              <div class="card-copy">
                <h2>Sync with AWS S3</h2>
                <p>Write directly to your bucket. Works across devices.</p>
              </div>
              {#if settingsS3Bucket}
                <div class="card-meta">
                  Current bucket: <span>{settingsS3Bucket}</span>
                </div>
              {/if}
              <div class="form">
                <label>
                  <span>Bucket</span>
                  <input
                    class="input"
                    type="text"
                    bind:value={s3Bucket}
                    disabled={settingsBusy}
                    autocomplete="off"
                    on:input={() => (s3Dirty = true)}
                  />
                </label>
                <label>
                  <span>Region</span>
                  <input
                    class="input"
                    type="text"
                    bind:value={s3Region}
                    disabled={settingsBusy}
                    autocomplete="off"
                    on:input={() => (s3Dirty = true)}
                  />
                </label>
                <label>
                  <span>Prefix (optional)</span>
                  <input
                    class="input"
                    type="text"
                    bind:value={s3Prefix}
                    disabled={settingsBusy}
                    autocomplete="off"
                    on:input={() => (s3Dirty = true)}
                  />
                </label>
                <label>
                  <span>Access key ID</span>
                  <input
                    class="input"
                    type="text"
                    bind:value={s3AccessKeyId}
                    disabled={settingsBusy}
                    autocomplete="off"
                    on:input={() => (s3Dirty = true)}
                  />
                </label>
                <label>
                  <span>Secret access key</span>
                  <input
                    class="input"
                    type="password"
                    bind:value={s3SecretAccessKey}
                    disabled={settingsBusy}
                    autocomplete="off"
                    on:input={() => (s3Dirty = true)}
                  />
                </label>
                <label>
                  <span>Session token (optional)</span>
                  <input
                    class="input"
                    type="password"
                    bind:value={s3SessionToken}
                    disabled={settingsBusy}
                    autocomplete="off"
                    on:input={() => (s3Dirty = true)}
                  />
                </label>
              </div>
              <button
                class="button primary"
                type="button"
                on:click={() => void onConnectS3?.(buildS3Config())}
                disabled={settingsBusy}
              >
                {storageMode === "s3" ? "Update credentials" : "Connect S3"}
              </button>
            </div>
          </div>
        {:else if activeSection === "general"}
          <div class="section-header">
            <div class="section-title">General</div>
            <div class="section-description">Tune your default behavior.</div>
          </div>

          <div class="settings-group">
            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Startup view</div>
                <div class="setting-description">
                  Choose what opens when the app starts.
                </div>
              </div>
              <div class="setting-control">
                <div class="segmented" role="group" aria-label="Startup view">
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.startupView === "last-opened"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({ startupView: "last-opened" })}
                  >
                    Last opened
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.startupView === "all-notes"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({ startupView: "all-notes" })}
                  >
                    All notes
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Default sort</div>
                <div class="setting-description">
                  Controls the note list order when no manual order is set.
                </div>
              </div>
              <div class="setting-control">
                <div class="segmented" role="group" aria-label="Default sort">
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.defaultSort === "updated"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({ defaultSort: "updated" })}
                  >
                    Updated
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.defaultSort === "created"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({ defaultSort: "created" })}
                  >
                    Created
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.defaultSort === "title"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({ defaultSort: "title" })}
                  >
                    Title
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Open notes</div>
                <div class="setting-description">
                  Behavior when selecting a note from the list.
                </div>
              </div>
              <div class="setting-control">
                <div class="segmented" role="group" aria-label="Open note behavior">
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.openNoteBehavior === "new-tab"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({ openNoteBehavior: "new-tab" })}
                  >
                    New tab
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.openNoteBehavior === "reuse-tab"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({ openNoteBehavior: "reuse-tab" })}
                  >
                    Reuse tab
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Confirm move to Trash</div>
                <div class="setting-description">
                  Ask before moving a note to Trash.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="toggle"
                  type="button"
                  aria-label="Confirm move to Trash"
                  aria-pressed={preferences.confirmTrash}
                  data-active={preferences.confirmTrash}
                  disabled={preferencesDisabled}
                  on:click={() =>
                    void onUpdatePreferences?.({
                      confirmTrash: !preferences.confirmTrash,
                    })}
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          </div>
        {:else if activeSection === "notes"}
          <div class="section-header">
            <div class="section-title">Notes</div>
            <div class="section-description">List and capture behavior.</div>
          </div>

          <div class="settings-group">
            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">New notes go to</div>
                <div class="setting-description">
                  Choose the default location for new notes.
                </div>
              </div>
              <div class="setting-control">
                <div class="segmented" role="group" aria-label="New note location">
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.newNoteLocation === "current-folder"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        newNoteLocation: "current-folder",
                      })}
                  >
                    Current folder
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.newNoteLocation === "all-notes"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        newNoteLocation: "all-notes",
                      })}
                  >
                    All notes
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Show updated date</div>
                <div class="setting-description">
                  Display the last update date in the note list.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="toggle"
                  type="button"
                  aria-label="Show updated date"
                  aria-pressed={preferences.showNoteDates}
                  data-active={preferences.showNoteDates}
                  disabled={preferencesDisabled}
                  on:click={() =>
                    void onUpdatePreferences?.({
                      showNoteDates: !preferences.showNoteDates,
                    })}
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Show note preview</div>
                <div class="setting-description">
                  One-line snippet beneath the title.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="toggle"
                  type="button"
                  aria-label="Show note preview"
                  aria-pressed={preferences.showNotePreview}
                  data-active={preferences.showNotePreview}
                  disabled={preferencesDisabled}
                  on:click={() =>
                    void onUpdatePreferences?.({
                      showNotePreview: !preferences.showNotePreview,
                    })}
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Show tag pills in list</div>
                <div class="setting-description">
                  Display up to three tag chips on each row.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="toggle"
                  type="button"
                  aria-label="Show tag pills in list"
                  aria-pressed={preferences.showTagPillsInList}
                  data-active={preferences.showTagPillsInList}
                  disabled={preferencesDisabled}
                  on:click={() =>
                    void onUpdatePreferences?.({
                      showTagPillsInList: !preferences.showTagPillsInList,
                    })}
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          </div>
        {:else if activeSection === "editor"}
          <div class="section-header">
            <div class="section-title">Editor</div>
            <div class="section-description">Writing and editing defaults.</div>
          </div>

          <div class="settings-group">
            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Spellcheck</div>
                <div class="setting-description">
                  Enable browser spellcheck inside the editor.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="toggle"
                  type="button"
                  aria-label="Spellcheck"
                  aria-pressed={preferences.spellcheck}
                  data-active={preferences.spellcheck}
                  disabled={preferencesDisabled}
                  on:click={() =>
                    void onUpdatePreferences?.({
                      spellcheck: !preferences.spellcheck,
                    })}
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Markdown view by default</div>
                <div class="setting-description">
                  Start notes in read-only Markdown preview.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="toggle"
                  type="button"
                  aria-label="Markdown view by default"
                  aria-pressed={preferences.markdownViewByDefault}
                  data-active={preferences.markdownViewByDefault}
                  disabled={preferencesDisabled}
                  on:click={() =>
                    void onUpdatePreferences?.({
                      markdownViewByDefault: !preferences.markdownViewByDefault,
                    })}
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Smart list continuation</div>
                <div class="setting-description">
                  Automatically continue lists on Enter.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="toggle"
                  type="button"
                  aria-label="Smart list continuation"
                  aria-pressed={preferences.smartListContinuation}
                  data-active={preferences.smartListContinuation}
                  disabled={preferencesDisabled}
                  on:click={() =>
                    void onUpdatePreferences?.({
                      smartListContinuation: !preferences.smartListContinuation,
                    })}
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          </div>
        {:else if activeSection === "appearance"}
          <div class="section-header">
            <div class="section-title">Appearance</div>
            <div class="section-description">Theme and motion preferences.</div>
          </div>

          <div class="settings-group">
            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Theme</div>
                <div class="setting-description">
                  EmberVault is currently optimized for dark mode.
                </div>
              </div>
              <div class="setting-control">
                <span class="pill">Dark</span>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Reduce motion</div>
                <div class="setting-description">
                  Follows your system preference.
                </div>
              </div>
              <div class="setting-control">
                <span class="pill">{$prefersReducedMotion ? "On" : "Off"}</span>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Interface density</div>
                <div class="setting-description">
                  Compact spacing for dense note workflows.
                </div>
              </div>
              <div class="setting-control">
                <div class="segmented" role="group" aria-label="Interface density">
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.interfaceDensity === "comfortable"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        interfaceDensity: "comfortable",
                      })}
                  >
                    Comfortable
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.interfaceDensity === "compact"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        interfaceDensity: "compact",
                      })}
                  >
                    Compact
                  </button>
                </div>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Accent color</div>
                <div class="setting-description">
                  Choose a secondary accent color.
                </div>
              </div>
              <div class="setting-control">
                <div class="segmented" role="group" aria-label="Accent color">
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.accentColor === "orange"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        accentColor: "orange",
                      })}
                  >
                    Orange
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.accentColor === "sky"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        accentColor: "sky",
                      })}
                  >
                    Sky
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.accentColor === "mint"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        accentColor: "mint",
                      })}
                  >
                    Mint
                  </button>
                  <button
                    class="segmented-button"
                    type="button"
                    data-active={preferences.accentColor === "rose"}
                    disabled={preferencesDisabled}
                    on:click={() =>
                      void onUpdatePreferences?.({
                        accentColor: "rose",
                      })}
                  >
                    Rose
                  </button>
                </div>
              </div>
            </div>
          </div>
        {:else if activeSection === "shortcuts"}
          <div class="section-header">
            <div class="section-title">Shortcuts</div>
            <div class="section-description">Keyboard reference.</div>
          </div>

          <div class="shortcut-list">
            <div class="shortcut-row">
              <span class="shortcut-action">Command palette</span>
              <span class="shortcut-keys">
                <kbd>Cmd</kbd> <kbd>K</kbd> / <kbd>Ctrl</kbd> <kbd>K</kbd>
              </span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-action">New note</span>
              <span class="shortcut-keys">
                <kbd>Cmd</kbd> <kbd>N</kbd> / <kbd>Ctrl</kbd> <kbd>N</kbd>
              </span>
            </div>
            <div class="shortcut-row">
              <span class="shortcut-action">Global search</span>
              <span class="shortcut-keys">
                <kbd>Cmd</kbd> <kbd>Shift</kbd> <kbd>F</kbd> / <kbd>Ctrl</kbd>
                <kbd>Shift</kbd> <kbd>F</kbd>
              </span>
            </div>
          </div>
        {:else if activeSection === "import-export"}
          <div class="section-header">
            <div class="section-title">Import/Export</div>
            <div class="section-description">Move data in and out of EmberVault.</div>
          </div>

          <div class="settings-group">
            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Backup (single file)</div>
                <div class="setting-description">
                  Download a backup you can restore later.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="button secondary"
                  type="button"
                  data-testid="download-backup"
                  on:click={() => void onDownloadBackup?.()}
                  disabled={!onDownloadBackup || settingsBusy}
                >
                  Download
                </button>
                <button
                  class="button secondary"
                  type="button"
                  data-testid="restore-backup"
                  on:click={openRestoreBackupPicker}
                  disabled={!onRestoreBackup || settingsBusy}
                >
                  Restore
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Export vault</div>
                <div class="setting-description">
                  Export Markdown + assets to a folder.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="button secondary"
                  type="button"
                  on:click={() => void onExportVault?.()}
                  disabled={!supportsFileSystem || !onExportVault || settingsBusy}
                >
                  Export
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Import from folder</div>
                <div class="setting-description">
                  Bring existing Markdown notes into a vault.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="button secondary"
                  type="button"
                  on:click={() => void onImportFromFolder?.()}
                  disabled={
                    !supportsFileSystem ||
                    !onImportFromFolder ||
                    settingsBusy
                  }
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        {:else if activeSection === "privacy"}
          <div class="section-header">
            <div class="section-title">Privacy & diagnostics</div>
            <div class="section-description">Local-only tools and maintenance.</div>
          </div>

          <div class="settings-group">
            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Vault integrity check</div>
                <div class="setting-description">
                  Scan for missing notes/assets and safe cleanup opportunities.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="button secondary"
                  type="button"
                  on:click={() => void runIntegrityCheck()}
                  disabled={!onRunIntegrityCheck || settingsBusy || integrityBusy}
                >
                  Run
                </button>
                <button
                  class="button secondary"
                  type="button"
                  on:click={() => void repairVault()}
                  disabled={
                    !onRepairVault ||
                    !integrityReport ||
                    settingsBusy ||
                    integrityBusy
                  }
                >
                  Repair
                </button>
              </div>
            </div>

            {#if integrityReport}
              <div class="info-note" data-testid="integrity-report">
                {integrityReport.issues.length === 0
                  ? "No issues found."
                  : `${integrityReport.issues.length} issue${integrityReport.issues.length === 1 ? "" : "s"} found.`}
              </div>
            {/if}

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Rebuild search index</div>
                <div class="setting-description">
                  Refresh search data without touching notes.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="button secondary"
                  type="button"
                  on:click={() => void onRebuildSearchIndex?.()}
                  disabled={!onRebuildSearchIndex || settingsBusy}
                >
                  Rebuild
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Reset workspace layout</div>
                <div class="setting-description">
                  Clears panes, tabs, and focused note.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="button secondary"
                  type="button"
                  on:click={() => void onClearWorkspaceState?.()}
                  disabled={!onClearWorkspaceState || settingsBusy}
                >
                  Reset layout
                </button>
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-copy">
                <div class="setting-title">Reset preferences</div>
                <div class="setting-description">
                  Restore defaults for general and editor settings.
                </div>
              </div>
              <div class="setting-control">
                <button
                  class="button danger"
                  type="button"
                  on:click={() => void onResetPreferences?.()}
                  disabled={!onResetPreferences || settingsBusy}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        {:else if activeSection === "about"}
          <div class="section-header">
            <div class="section-title">About</div>
            <div class="section-description">Local build information.</div>
          </div>

          <div class="info-grid">
            <div class="info-row">
              <div class="info-label">Storage</div>
              <div class="info-value">
                {storageMode === "filesystem" ? "Folder vault" : "Browser storage"}
              </div>
            </div>
            <div class="info-row">
              <div class="info-label">Vault</div>
              <div class="info-value">{settingsVaultName ?? "Not set"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Build</div>
              <div class="info-value">Local</div>
            </div>
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>

<input
  bind:this={restoreBackupInput}
  type="file"
  data-testid="restore-backup-input"
  accept=".json,.gz,application/json,application/gzip"
  style="display: none"
  on:change={handleRestoreBackupChange}
/>

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
    width: min(860px, calc(100% - 32px));
    height: min(600px, 84vh);
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

  .form {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: var(--text-2);
  }

  .input {
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-2);
    color: var(--text-1);
  }

  .input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
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

  .button.danger {
    background: transparent;
    border-color: color-mix(in srgb, var(--danger) 60%, transparent);
    color: var(--danger);
  }

  .button.danger:hover:enabled {
    background: color-mix(in srgb, var(--danger) 16%, transparent);
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

  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-top: 1px solid var(--stroke-0);
  }

  .setting-row:first-child {
    border-top: none;
    padding-top: 0;
  }

  .setting-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .setting-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-0);
  }

  .setting-description {
    font-size: 12px;
    color: var(--text-1);
  }

  .setting-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .segmented {
    display: inline-flex;
    align-items: center;
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    padding: 2px;
    gap: 2px;
  }

  .segmented-button {
    height: 26px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--text-1);
    font-size: 12px;
    cursor: pointer;
  }

  .segmented-button[data-active="true"] {
    background: var(--bg-2);
    color: var(--text-0);
  }

  .segmented-button:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .segmented-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .toggle {
    width: 40px;
    height: 22px;
    border-radius: 999px;
    border: 1px solid var(--stroke-1);
    background: var(--bg-1);
    padding: 2px;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .toggle[data-active="true"] {
    background: color-mix(in srgb, var(--accent-0) 35%, var(--bg-1));
    border-color: color-mix(in srgb, var(--accent-0) 60%, var(--stroke-1));
  }

  .toggle-knob {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--text-0);
    transform: translateX(0);
    transition: transform 120ms ease;
  }

  .toggle[data-active="true"] .toggle-knob {
    transform: translateX(18px);
    background: #0b0d10;
  }

  .toggle:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .pill {
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    font-size: 11px;
    color: var(--text-2);
  }

  .shortcut-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--stroke-0);
  }

  .shortcut-row:last-child {
    border-bottom: none;
  }

  .shortcut-action {
    font-size: 13px;
    color: var(--text-0);
  }

  .shortcut-keys {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-1);
    font-size: 12px;
  }

  kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
  }

  .info-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--stroke-0);
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    font-size: 12px;
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .info-value {
    font-size: 13px;
    color: var(--text-0);
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

  @media (max-width: 800px) {
    .modal-panel {
      width: min(94vw, 820px);
      height: min(82vh, 600px);
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
