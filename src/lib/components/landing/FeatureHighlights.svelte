<script lang="ts">
  import { Zap, Lock, PenLine, Search } from "lucide-svelte";
</script>

<div class="feature-rail" role="list">
  <div class="item" role="listitem">
    <div class="icon"><Zap size={16} /></div>
    <div class="title">Native-like speed</div>
    <div class="body">Instant search, tabs, and split panes. No lag.</div>
  </div>
  <div class="item" role="listitem">
    <div class="icon"><Lock size={16} /></div>
    <div class="title">Local-only by design</div>
    <div class="body">Notes never leave your device.</div>
  </div>
  <div class="item" role="listitem">
    <div class="icon"><PenLine size={16} /></div>
    <div class="title">Powerful editor</div>
    <div class="body">Blocks + Markdown + math + code + tables.</div>
  </div>
  <div class="item" role="listitem">
    <div class="icon"><Search size={16} /></div>
    <div class="title">Find anything</div>
    <div class="body">Full-text + filters + fuzzy matching.</div>
  </div>
</div>

<style>
  .feature-rail {
    border-top: 1px solid var(--stroke-0);
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .item {
    padding: 24px 16px 28px;
    display: grid;
    gap: 12px;
    position: relative;
  }

  .item + .item {
    border-left: 1px solid var(--stroke-0);
  }

  .icon {
    color: var(--text-2);
  }

  .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-0);
  }

  .body {
    font-size: 13px;
    color: var(--text-1);
    line-height: 1.55;
  }

  @media (max-width: 900px) {
    .feature-rail {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .item:nth-child(3) {
      border-left: none;
      border-top: 1px solid var(--stroke-0);
    }

    .item:nth-child(4) {
      border-top: 1px solid var(--stroke-0);
    }
  }

  @media (max-width: 767px) {
    .feature-rail {
      grid-template-columns: 1fr;
      border-top: none;
    }

    .item {
      padding: 20px 0 20px 16px;
      border-top: 1px solid var(--stroke-0);
    }

    .item + .item {
      border-left: none;
    }

    .item::before {
      content: "";
      position: absolute;
      left: 0;
      top: 18px;
      bottom: 18px;
      width: 2px;
      border-radius: 2px;
      background: transparent;
      transition: background 120ms ease;
    }

    .item:hover::before,
    .item:focus-within::before {
      background: var(--accent-0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .item::before {
      transition: opacity 80ms ease;
    }
  }
</style>
