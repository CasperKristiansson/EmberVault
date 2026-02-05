<script lang="ts">
  import { onMount } from "svelte";

  export let title = "Confirm";
  export let message = "";
  export let confirmLabel = "Confirm";
  export let cancelLabel = "Cancel";
  export let destructive = false;
  export let onConfirm: () => void | Promise<void> = () => {};
  export let onCancel: () => void = () => {};

  let cancelButton: HTMLButtonElement | null = null;

  onMount(() => {
    cancelButton?.focus();
  });
</script>

<div class="modal-overlay" data-testid="confirm-dialog">
  <div class="modal-panel" role="dialog" aria-modal="true">
    <div class="modal-title">{title}</div>
    {#if message}
      <div class="modal-message">{message}</div>
    {/if}
    <div class="modal-actions">
      <button
        class="button secondary"
        type="button"
        data-testid="confirm-cancel"
        bind:this={cancelButton}
        on:click={onCancel}
      >
        {cancelLabel}
      </button>
      <button
        class={`button ${destructive ? "danger" : "primary"}`}
        type="button"
        data-testid="confirm-submit"
        on:click={onConfirm}
      >
        {confirmLabel}
      </button>
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
    width: min(420px, calc(100% - 32px));
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-panel);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 110;
  }

  .modal-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-0);
  }

  .modal-message {
    font-size: 12px;
    color: var(--text-1);
    line-height: 1.4;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
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

  .button.danger {
    background: var(--danger);
    color: #0b0d10;
  }

  .button.danger:hover {
    background: rgba(255, 77, 77, 0.85);
  }

  .button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
