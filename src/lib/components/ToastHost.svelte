<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import { X } from "lucide-svelte";
  import { dismissToast, toastStore } from "$lib/state/ui.store";
</script>

<div
  class="toast-host"
  data-testid="toast-host"
  aria-live="polite"
  aria-atomic="true"
>
  {#each $toastStore as toast (toast.id)}
    <div
      class="toast"
      data-tone={toast.tone}
      data-testid="toast"
      role="status"
      transition:motion={{
        preset: "list",
        reducedMotion: $prefersReducedMotion,
        offset: 6,
      }}
    >
      <div class="toast-message">{toast.message}</div>
      <button
        class="toast-dismiss"
        type="button"
        aria-label="Dismiss notification"
        on:click={() => dismissToast(toast.id)}
      >
        <X aria-hidden="true" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-host {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 200;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: min(360px, 90vw);
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-2);
    border: 1px solid var(--stroke-1);
    border-left: 3px solid var(--info);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-panel);
    color: var(--text-0);
    font-size: 12px;
  }

  .toast[data-tone="error"] {
    border-left-color: var(--danger);
  }

  .toast[data-tone="success"] {
    border-left-color: var(--success);
  }

  .toast[data-tone="info"] {
    border-left-color: var(--info);
  }

  .toast-message {
    line-height: 1.4;
  }

  .toast-dismiss {
    width: 28px;
    height: 28px;
    border-radius: var(--r-sm);
    border: none;
    background: transparent;
    color: var(--text-1);
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .toast-dismiss:hover {
    color: var(--text-0);
    background: var(--bg-3);
  }

  .toast-dismiss:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .toast-dismiss :global(svg) {
    width: 14px;
    height: 14px;
    display: block;
  }

  @media (max-width: 767px) {
    .toast-host {
      right: auto;
      left: 50%;
      transform: translateX(-50%);
      bottom: 16px;
    }
  }
</style>
