<script lang="ts">
  import LandingNav from "$lib/components/landing/LandingNav.svelte";
  import AppPreviewFrame from "$lib/components/landing/AppPreviewFrame.svelte";
  import FeatureHighlights from "$lib/components/landing/FeatureHighlights.svelte";
  import StorageExplainer from "$lib/components/landing/StorageExplainer.svelte";
  import EditorInfographicStack from "$lib/components/landing/EditorInfographicStack.svelte";
  import PrivacyPanel from "$lib/components/landing/PrivacyPanel.svelte";
</script>

<div class="landing">
  <LandingNav />

  <main class="main">
    <section class="section hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <h1>Local-first. No accounts. No cloud.</h1>
          <p class="subhead">
            A calm, macOS-like notes app that runs in your browser—fast, private, and fully offline.
            Your notes live on your device.
          </p>
          <div class="cta-row">
            <a class="btn primary" href="/onboarding">Choose storage</a>
            <a class="btn secondary" href="#how-it-works">Learn how it works</a>
          </div>
          <div class="microline">
            Folder vault on Chrome/Edge · Browser storage everywhere · No tracking
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
      </div>
      <div class="container">
        <FeatureHighlights />
      </div>
    </section>

    <section class="section" id="storage">
      <div class="container section-head">
        <h2>Choose how your notes live locally</h2>
      </div>
      <div class="container">
        <StorageExplainer />
      </div>
    </section>

    <section class="section" id="editor">
      <div class="container editor-grid">
        <div class="editor-copy">
          <h2>Write fast. Structure when you want.</h2>
          <p class="section-copy">
            Block-based editing with Markdown-friendly workflows—headings, lists, checklists, tables,
            code, and LaTeX math.
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
        <div>
          <h2>Privacy you can verify</h2>
          <ul class="privacy-bullets">
            <li>No accounts. No cloud.</li>
            <li>No analytics. No tracking.</li>
            <li>Offline-first after first load.</li>
            <li>Your data stays on your device.</li>
          </ul>
        </div>
      </div>
      <div class="container">
        <PrivacyPanel />
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">EmberVault</div>
      <div class="footer-actions">
        <div class="footer-links">
          <a href="#privacy">Privacy</a>
          <a href="#storage">Storage</a>
          <a href="#editor">Editor</a>
        </div>
        <a class="btn secondary footer-cta" href="/app">Open app</a>
      </div>
    </div>
    <div class="container footer-note">Local-only notes. No accounts.</div>
  </footer>
</div>

<style>
  .landing {
    --page-pad: 24px;
    --section-gap: 80px;
    --shadow-panel: 0 18px 60px rgba(0, 0, 0, 0.45);
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
    background: radial-gradient(600px 400px at 75% 10%, rgba(255, 138, 42, 0.08), transparent 60%),
      var(--bg-0);
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: var(--section-gap);
    padding: 40px 0 80px;
  }

  .section {
    padding: 0 var(--page-pad);
  }

  .container {
    max-width: 1120px;
    margin: 0 auto;
  }

  h1 {
    font-size: 44px;
    line-height: 1.12;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 16px;
  }

  h2 {
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--text-0);
  }

  .subhead {
    font-size: 16px;
    line-height: 1.6;
    font-weight: 400;
    color: var(--text-1);
    margin: 0 0 24px;
  }

  .section-copy {
    font-size: 14px;
    line-height: 1.6;
    color: var(--text-1);
    margin: 0;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 32px;
    align-items: center;
  }

  .hero-preview {
    width: min(620px, 100%);
    justify-self: end;
  }

  .cta-row {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 16px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border-radius: var(--r-md);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid transparent;
    transition: background 120ms ease, transform 120ms ease, color 120ms ease;
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
  .footer-links a:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--focus);
  }

  .microline {
    font-size: 12px;
    color: var(--text-2);
    font-weight: 500;
  }

  .section-head {
    margin-bottom: 16px;
  }

  .editor-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .editor-list {
    margin: 16px 0 0;
    padding-left: 16px;
    display: grid;
    gap: 8px;
    color: var(--text-1);
    font-size: 13px;
  }

  .privacy-head {
    margin-bottom: 16px;
  }

  .privacy-bullets {
    margin: 8px 0 0;
    padding-left: 16px;
    display: grid;
    gap: 8px;
    color: var(--text-1);
    font-size: 13px;
  }

  .footer {
    padding: 32px var(--page-pad) 48px;
    border-top: 1px solid var(--stroke-0);
  }

  .footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .footer-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .footer-brand {
    font-weight: 600;
  }

  .footer-links {
    display: flex;
    gap: 16px;
  }

  .footer-links a {
    color: var(--text-1);
    text-decoration: none;
    font-size: 13px;
    transition: color 120ms ease;
  }

  .footer-links a:hover {
    color: var(--text-0);
  }

  .footer-cta {
    height: 32px;
    font-weight: 500;
  }

  .footer-note {
    margin-top: 16px;
    font-size: 12px;
    color: var(--text-2);
  }

  @media (max-width: 767px) {
    .landing {
      --page-pad: 16px;
      --section-gap: 56px;
    }

    h1 {
      font-size: 34px;
    }

    .subhead {
      font-size: 15px;
    }

    .hero-grid {
      grid-template-columns: 1fr;
    }

    .hero-preview {
      justify-self: stretch;
    }

    .cta-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .editor-grid {
      grid-template-columns: 1fr;
    }

    .footer-inner {
      flex-direction: column;
      align-items: flex-start;
    }

    .footer-actions {
      width: 100%;
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn,
    .footer-links a {
      transition: opacity 80ms ease;
    }

    .btn:hover {
      transform: none;
    }
  }
</style>
