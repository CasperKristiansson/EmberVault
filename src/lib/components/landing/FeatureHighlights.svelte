<script lang="ts">
  import { Zap, Lock, PenLine, Search } from "lucide-svelte";
</script>

<div class="features">
  <div class="card">
    <div class="icon"><Zap size={18} /></div>
    <div class="title">Native-like speed</div>
    <div class="body">Instant search, tabs, split panes. No lag.</div>
  </div>
  <div class="card">
    <div class="icon"><Lock size={18} /></div>
    <div class="title">Local-only by design</div>
    <div class="body">Notes never leave your device.</div>
  </div>
  <div class="card">
    <div class="icon"><PenLine size={18} /></div>
    <div class="title">Powerful editor</div>
    <div class="body">Blocks + Markdown + math + code + tables.</div>
  </div>
  <div class="card">
    <div class="icon"><Search size={18} /></div>
    <div class="title">Find anything</div>
    <div class="body">Full-text + filters + fuzzy matching.</div>
  </div>
</div>

<style>
  .features {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .card {
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    padding: 16px;
    display: grid;
    gap: 8px;
    transition: background 120ms ease, transform 120ms ease, border 120ms ease;
  }

  .card:hover {
    background: var(--bg-3);
    border-color: var(--stroke-1);
    transform: translateY(-2px);
  }

  .icon {
    color: var(--text-1);
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-0);
  }

  .body {
    font-size: 13px;
    color: var(--text-1);
    line-height: 1.5;
  }

  @media (max-width: 767px) {
    .features {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: opacity 80ms ease;
    }

    .card:hover {
      transform: none;
    }
  }
</style>
