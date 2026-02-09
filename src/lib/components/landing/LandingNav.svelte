<script lang="ts">
  import { Menu } from "lucide-svelte";

  let menuOpen = false;

  const toggleMenu = () => {
    menuOpen = !menuOpen;
  };

  const closeMenu = () => {
    menuOpen = false;
  };
</script>

<nav class="nav" aria-label="Primary">
  <div class="nav-inner">
    <div class="brand" aria-label="EmberVault">
      <span class="dot" aria-hidden="true"></span>
      <span class="brand-text">EmberVault</span>
    </div>

    <div class="nav-right">
      <div class="links">
        <a href="#how-it-works">How it works</a>
        <a href="#storage">Storage</a>
        <a href="#editor">Editor</a>
        <a href="#privacy">Privacy</a>
      </div>

      <div class="actions">
        <a class="btn secondary" href="#how-it-works">Learn how it works</a>
        <a class="btn primary" href="/onboarding">Choose storage</a>
      </div>

      <div class="mobile-actions">
        <a class="btn primary" href="/onboarding">Choose storage</a>
        <button
          class="icon-btn"
          type="button"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          on:click={toggleMenu}
        >
          <Menu size={16} />
        </button>
      </div>
    </div>
  </div>

  <div
    id="mobile-nav-menu"
    class:open={menuOpen}
    class="mobile-menu"
    role="menu"
    aria-label="Navigation"
  >
    <a role="menuitem" href="#how-it-works" on:click={closeMenu}>How it works</a>
    <a role="menuitem" href="#storage" on:click={closeMenu}>Storage</a>
    <a role="menuitem" href="#editor" on:click={closeMenu}>Editor</a>
    <a role="menuitem" href="#privacy" on:click={closeMenu}>Privacy</a>
    <a class="btn secondary" href="#how-it-works" on:click={closeMenu}>Learn how it works</a>
  </div>
</nav>

<style>
  .nav {
    position: sticky;
    top: 0;
    z-index: 50;
    height: 56px;
    background: rgba(15, 18, 23, 0.75);
    border-bottom: 1px solid var(--stroke-0);
    backdrop-filter: blur(8px) saturate(1.05);
  }

  .nav-inner {
    height: 100%;
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-0);
    box-shadow: 0 0 0 4px var(--accent-2);
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .links {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .links a {
    color: var(--text-1);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    transition: color 120ms ease, transform 120ms ease;
  }

  .links a:hover {
    color: var(--text-0);
    transform: translateY(-1px);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    padding: 0 16px;
    border-radius: var(--r-md);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid transparent;
    transition: background 120ms ease, color 120ms ease, transform 120ms ease;
  }

  .btn.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .btn.primary:hover {
    background: var(--accent-1);
    transform: translateY(-1px);
  }

  .btn.secondary {
    background: transparent;
    border-color: var(--stroke-1);
    color: var(--text-0);
  }

  .btn.secondary:hover {
    background: var(--bg-3);
    transform: translateY(-1px);
  }

  .btn:focus-visible,
  .links a:focus-visible,
  .icon-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--focus);
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    background: transparent;
    color: var(--text-1);
    transition: background 120ms ease, color 120ms ease, transform 120ms ease;
    cursor: pointer;
  }

  .icon-btn:hover {
    background: var(--bg-3);
    color: var(--text-0);
    transform: translateY(-1px);
  }

  .mobile-actions {
    display: none;
    align-items: center;
    gap: 8px;
  }

  .mobile-menu {
    position: absolute;
    right: 16px;
    top: 56px;
    min-width: 200px;
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-panel);
    padding: 8px;
    display: grid;
    gap: 8px;
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    pointer-events: none;
    transform: translateY(-8px);
    transition: max-height 160ms ease, opacity 160ms ease, transform 160ms ease;
  }

  .mobile-menu a {
    color: var(--text-0);
    text-decoration: none;
    font-size: 13px;
    padding: 8px;
    border-radius: var(--r-sm);
    transition: background 120ms ease, color 120ms ease;
  }

  .mobile-menu a:hover {
    background: var(--bg-3);
  }

  .mobile-menu.open {
    opacity: 1;
    max-height: 320px;
    pointer-events: auto;
    transform: translateY(0);
  }

  .mobile-menu .btn.secondary {
    justify-content: flex-start;
    height: 32px;
  }

  @media (max-width: 767px) {
    .nav-inner {
      padding: 0 16px;
    }

    .links,
    .actions {
      display: none;
    }

    .mobile-actions {
      display: flex;
    }
  }

  @media (min-width: 768px) {
    .mobile-menu {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .links a,
    .btn,
    .icon-btn {
      transition: opacity 80ms ease;
    }

    .links a:hover,
    .btn:hover,
    .icon-btn:hover {
      transform: none;
    }

    .mobile-menu {
      transition: opacity 80ms ease, max-height 160ms ease;
      transform: none;
    }
  }
</style>
