<div class="privacy-panel">
  <div class="network">
    <div class="label">Network</div>
    <div class="value">Not required for your notes</div>
  </div>
</div>

<style>
  .privacy-panel {
    display: block;
  }

  .network {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    background: rgba(15, 18, 23, 0.6);
    font-size: 12px;
    color: var(--text-2);
  }

  .value {
    color: var(--text-1);
  }

  @media (max-width: 767px) {
    .network {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }
  }
</style>
