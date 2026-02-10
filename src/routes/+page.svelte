<script lang="ts">
  import AppPreviewFrame from "$lib/components/landing/AppPreviewFrame.svelte";
  import FeatureHighlights from "$lib/components/landing/FeatureHighlights.svelte";
  import StorageExplainer from "$lib/components/landing/StorageExplainer.svelte";
  import EditorInfographicStack from "$lib/components/landing/EditorInfographicStack.svelte";
  import PrivacyPanel from "$lib/components/landing/PrivacyPanel.svelte";
</script>

<div class="landing">
  <main class="main">
    <section class="section hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <div class="wordmark">
            <span class="dot" aria-hidden="true"></span>
            EmberVault
          </div>
          <h1>Local-first. No accounts. No cloud.</h1>
          <p class="subhead">
            A calm, macOS-like notes app that runs entirely on your device. Your notes stay local,
            private, and fast - even offline.
          </p>
          <div class="cta-row">
            <a class="btn primary" href="/onboarding">Choose storage</a>
            <a class="btn secondary" href="#how-it-works">Learn how it works</a>
          </div>
        </div>

        <div class="hero-preview">
          <AppPreviewFrame />
        </div>
      </div>
    </section>

    <section class="section" id="how-it-works">
      <div class="container section-head">
        <h2>How it works</h2>
        <p class="section-copy">
          EmberVault keeps everything local while still feeling instant - search, tabs, and
          structured notes without the cloud.
        </p>
      </div>
      <div class="container">
        <FeatureHighlights />
      </div>
    </section>

    <section class="section" id="storage">
      <div class="container split-grid">
        <div class="section-copy-block">
          <h2>Choose how your notes live locally</h2>
          <p class="section-copy">
            Pick folder storage for full control, or stay entirely in the browser. Either way, your
            vault never leaves your device.
          </p>
        </div>
        <StorageExplainer />
      </div>
    </section>

    <section class="section" id="editor">
      <div class="container split-grid editor-grid">
        <div class="section-copy-block">
          <h2>Write fast. Structure when you want.</h2>
          <p class="section-copy">
            Block-based editing with Markdown-friendly workflows - headings, lists, checklists,
            tables, code, and LaTeX math.
          </p>
          <ul class="editor-list">
            <li>Markdown paste, export, and clean structure.</li>
            <li>Inline math that stays editable and readable.</li>
            <li>Syntax-highlighted code blocks for fast reference.</li>
            <li>Tables and checklists that stay lightweight.</li>
          </ul>
        </div>
        <div class="editor-visual">
          <EditorInfographicStack />
        </div>
      </div>
    </section>

    <section class="section" id="privacy">
      <div class="container privacy-head">
        <h2>Privacy you can verify</h2>
        <ul class="privacy-bullets">
          <li>No accounts. No cloud.</li>
          <li>No analytics. No tracking.</li>
          <li>Offline-first after first load.</li>
          <li>Your data stays on your device.</li>
        </ul>
      </div>
      <div class="container privacy-strip">
        <PrivacyPanel />
      </div>
    </section>
  </main>
</div>

<style>
  .landing {
    --page-pad: 28px;
    --section-gap: 110px;
    --hero-top: 96px;
    --content-width: 1120px;
    --shadow-showpiece: 0 40px 120px rgba(0, 0, 0, 0.55);
    --shadow-panel: 0 26px 80px rgba(0, 0, 0, 0.4);

    position: relative;
    min-height: 100vh;
    overflow: hidden;
    isolation: isolate;
    font-family:
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "SF Pro Display",
      "SF Pro Text",
      "Segoe UI",
      Roboto,
      Helvetica,
      Arial;
    background: var(--bg-0);
    color: var(--text-0);
    -webkit-font-smoothing: antialiased;
  }

  .landing::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(900px 520px at 8% 12%, rgba(77, 163, 255, 0.14), transparent 60%),
      radial-gradient(800px 520px at 82% 18%, rgba(255, 138, 42, 0.18), transparent 62%),
      radial-gradient(700px 520px at 70% 72%, rgba(255, 138, 42, 0.12), transparent 65%);
    animation: ember-drift 22s ease-in-out infinite;
    z-index: 0;
  }

  .landing::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(120% 90% at 50% -10%, rgba(0, 0, 0, 0.55), transparent 55%),
      radial-gradient(120% 90% at 50% 115%, rgba(0, 0, 0, 0.6), transparent 55%),
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E");
    opacity: 0.5;
    pointer-events: none;
    z-index: 1;
  }

  .main {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: var(--section-gap);
    padding: 0 0 120px;
  }

  .section {
    padding: 0 var(--page-pad);
  }

  .container {
    max-width: var(--content-width);
    width: 100%;
    margin: 0 auto;
  }

  .hero {
    padding-top: var(--hero-top);
  }

  .hero-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: 40px;
    align-items: center;
  }

  .hero-copy {
    grid-column: span 5;
    display: grid;
    gap: 24px;
  }

  .hero-preview {
    grid-column: span 7;
    justify-self: end;
    width: min(720px, 100%);
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--text-2);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .wordmark .dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--accent-0);
    box-shadow: 0 0 8px rgba(255, 138, 42, 0.6);
  }

  h1 {
    font-size: 50px;
    line-height: 1.08;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0;
  }

  h2 {
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 12px;
    color: var(--text-0);
  }

  .subhead {
    font-size: 16px;
    line-height: 1.65;
    font-weight: 400;
    color: var(--text-1);
    margin: 0;
    max-width: 46ch;
  }

  .section-head {
    display: grid;
    gap: 16px;
    margin-bottom: 32px;
  }

  .section-copy {
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-1);
    margin: 0;
    max-width: 52ch;
  }

  .section-copy-block {
    display: grid;
    gap: 24px;
  }

  .cta-row {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 18px;
    border-radius: var(--r-md);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid transparent;
    transition: background 140ms ease, color 140ms ease, border 140ms ease;
  }

  .btn.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .btn.primary:hover {
    background: var(--accent-1);
  }

  .btn.secondary {
    background: transparent;
    border-color: var(--stroke-0);
    color: var(--text-0);
  }

  .btn.secondary:hover {
    background: var(--bg-3);
  }

  .btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--focus-ring);
  }

  .split-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 40px;
    align-items: start;
  }

  .editor-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }

  .editor-list {
    margin: 0;
    padding-left: 16px;
    display: grid;
    gap: 12px;
    color: var(--text-1);
    font-size: 13px;
  }

  .privacy-head {
    display: grid;
    gap: 16px;
    margin-bottom: 24px;
  }

  .privacy-bullets {
    margin: 0;
    padding-left: 16px;
    display: grid;
    gap: 12px;
    color: var(--text-1);
    font-size: 13px;
  }

  .privacy-strip {
    margin-top: 8px;
  }

  @keyframes ember-drift {
    0% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(-2%, 1.5%, 0);
    }
    100% {
      transform: translate3d(0, 0, 0);
    }
  }

  @media (max-width: 900px) {
    .hero-grid {
      grid-template-columns: 1fr;
    }

    .hero-copy,
    .hero-preview {
      grid-column: span 1;
    }

    .hero-preview {
      justify-self: stretch;
    }

    .split-grid,
    .editor-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .landing {
      --page-pad: 16px;
      --section-gap: 72px;
      --hero-top: 72px;
    }

    h1 {
      font-size: 35px;
    }

    .cta-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .main {
      padding-bottom: 96px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .landing::before {
      animation: none;
    }

    .btn {
      transition: opacity 80ms ease;
    }
  }
</style>
