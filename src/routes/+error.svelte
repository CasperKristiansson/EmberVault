<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/stores";

  let error: unknown = null;
  let status = 500;

  const permissionErrorNames = new Set(["NotAllowedError", "SecurityError"]);

  const resolveErrorMessage = (value: unknown): string => {
    if (value instanceof Error && value.message) {
      return value.message;
    }
    return "Something went wrong while loading EmberVault.";
  };

  $: error = $page.error;
  $: status = $page.status ?? 500;
  $: errorMessage = resolveErrorMessage(error);
  $: isPermissionError =
    error instanceof Error && permissionErrorNames.has(error.name);

  const handleReload = (): void => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };
</script>

<div class="error-page" role="alert">
  <div class="error-panel">
    <div class="error-title">We hit a snag</div>
    <div class="error-message">{errorMessage}</div>
    <div class="error-meta">Status {status}</div>
    <div class="error-actions">
      <button class="button primary" type="button" on:click={handleReload}>
        Reload
      </button>
      {#if isPermissionError}
        <a class="button secondary" href={resolve("/onboarding")}>
          Go to onboarding
        </a>
      {/if}
    </div>
  </div>
</div>

<style>
  .error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--bg-0);
    color: var(--text-0);
  }

  .error-panel {
    width: min(520px, 100%);
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-panel);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .error-title {
    font-size: 18px;
    font-weight: 500;
  }

  .error-message {
    font-size: 13px;
    color: var(--text-1);
    line-height: 1.5;
  }

  .error-meta {
    font-size: 12px;
    color: var(--text-2);
  }

  .error-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .button {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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

  .button.primary:hover {
    background: var(--accent-1);
  }

  .button.primary:active {
    transform: translateY(0.5px);
    filter: brightness(0.96);
  }

  .button.secondary {
    background: transparent;
    border-color: var(--stroke-1);
    color: var(--text-0);
  }

  .button.secondary:hover {
    background: var(--bg-3);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
