<div class="storage-grid">
  <div class="storage-card">
    <span class="badge">Local-only</span>
    <span class="pill">Recommended</span>
    <div class="title">Folder vault (best on Chrome/Edge)</div>
    <div class="body">
      Store notes in a folder you choose. Files stay yours—easy to back up and move.
    </div>
    <ul>
      <li>Notes saved as files on disk</li>
      <li>Great for backups and portability</li>
      <li>Requires folder permission</li>
    </ul>
    <div class="meta">Uses File System Access on Chrome/Edge.</div>
  </div>

  <div class="storage-card">
    <span class="badge">Local-only</span>
    <div class="title">Browser storage (works everywhere)</div>
    <div class="body">
      Fast setup using IndexedDB. Still local-only—stored in this browser profile.
    </div>
    <ul>
      <li>No permissions prompt</li>
      <li>Great for quick setup</li>
      <li>Tied to this browser/device</li>
    </ul>
    <div class="meta">Available on all modern browsers.</div>
  </div>
</div>

<style>
  .storage-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }

  .storage-card {
    position: relative;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-lg);
    padding: 24px;
    display: grid;
    gap: 16px;
    transition: background 120ms ease, transform 120ms ease, border 120ms ease;
  }

  .storage-card:hover {
    background: var(--bg-3);
    border-color: var(--stroke-1);
    transform: translateY(-2px);
  }

  .badge {
    position: absolute;
    top: 16px;
    right: 16px;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid var(--stroke-0);
    color: var(--text-1);
    background: var(--bg-3);
  }

  .pill {
    justify-self: start;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--accent-2);
    color: var(--accent-1);
  }

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-0);
  }

  .body {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-1);
  }

  ul {
    list-style: disc;
    padding-left: 16px;
    margin: 0;
    display: grid;
    gap: 8px;
    color: var(--text-1);
    font-size: 13px;
  }

  .meta {
    font-size: 12px;
    color: var(--text-2);
  }

  @media (max-width: 767px) {
    .storage-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .storage-card {
      transition: opacity 80ms ease;
    }

    .storage-card:hover {
      transform: none;
    }
  }
</style>
