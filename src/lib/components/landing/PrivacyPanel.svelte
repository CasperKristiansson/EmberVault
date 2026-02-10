<div class="privacy-panel">
  <ul class="proof-list">
    <li>Local-first by default. No accounts or cloud.</li>
    <li>No analytics, tracking pixels, or behavior profiles.</li>
    <li>Offline-first after the first load.</li>
    <li>Your vault lives on this device only.</li>
  </ul>

  <div class="status-strip">
    <div class="label">Network</div>
    <div class="value">Not required for your notes</div>
  </div>
</div>

<style>
  .privacy-panel {
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    padding: 32px 32px 24px;
    background:
      radial-gradient(600px 200px at 0% 0%, rgba(255, 255, 255, 0.04), transparent 60%),
      rgba(15, 18, 23, 0.6);
    display: grid;
    gap: 24px;
  }

  .proof-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 24px;
    font-size: 13px;
    color: var(--text-1);
  }

  .proof-list li {
    position: relative;
    padding-left: 18px;
    line-height: 1.6;
  }

  .proof-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.6em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-0);
    opacity: 0.7;
  }

  .status-strip {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    background: rgba(11, 13, 16, 0.6);
    font-size: 12px;
    color: var(--text-2);
  }

  .value {
    color: var(--text-1);
  }

  @media (max-width: 900px) {
    .proof-list {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .privacy-panel {
      padding: 24px 20px 20px;
    }

    .status-strip {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }
  }
</style>
