<script lang="ts">
  import { ShieldCheck, EyeOff, WifiOff } from "lucide-svelte";
</script>

<div class="privacy-panel">
  <div class="columns">
    <div class="col">
      <div class="icon"><ShieldCheck size={18} /></div>
      <div class="title">Local-first. No accounts.</div>
      <div class="desc">Your vault stays on-device from day one.</div>
    </div>
    <div class="col">
      <div class="icon"><EyeOff size={18} /></div>
      <div class="title">No tracking.</div>
      <div class="desc">No analytics, no pixels, no behavioral profiles.</div>
    </div>
    <div class="col">
      <div class="icon"><WifiOff size={18} /></div>
      <div class="title">Offline-first.</div>
      <div class="desc">Fast even without a connection.</div>
    </div>
  </div>

  <div class="network">
    <div class="label">Network</div>
    <div class="value">Not required for your notes</div>
  </div>
</div>

<style>
  .privacy-panel {
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    padding: 24px;
    display: grid;
    gap: 16px;
  }

  .columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }

  .col {
    display: grid;
    gap: 8px;
    color: var(--text-1);
    font-size: 13px;
  }

  .icon {
    color: var(--text-1);
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-0);
  }

  .desc {
    color: var(--text-1);
    line-height: 1.5;
  }

  .network {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid var(--stroke-0);
    font-size: 12px;
    color: var(--text-2);
  }

  .value {
    color: var(--text-1);
  }

  @media (max-width: 767px) {
    .columns {
      grid-template-columns: 1fr;
    }

    .network {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style>
