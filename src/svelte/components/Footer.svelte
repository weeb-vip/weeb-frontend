<script lang="ts">
  // Use the global version variable injected by Vite
  const version = __APP_VERSION__;
</script>

<footer class="footer">
  <span>&copy; {new Date().getFullYear()} weeb.vip</span>
  <div class="footer-links">
    <a href="/about">About</a>
    <a href="#">API</a>
    <a href="#">GitHub</a>
    <span class="version">v{version}</span>
  </div>
</footer>

<style>
  .footer {
    padding: var(--weeb-section-py, 40px) var(--weeb-section-px, 48px);
    margin-top: 40px;
    border-top: 1px solid var(--weeb-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--weeb-fg-muted);
  }
  .footer-links {
    display: flex;
    gap: 20px;
    align-items: center;
  }
  .footer-links a {
    color: var(--weeb-fg-secondary);
    text-decoration: none;
    transition: color 0.15s;
  }
  .footer-links a:hover {
    color: var(--weeb-fg);
  }
  .version {
    font-size: 11px;
    color: var(--weeb-fg-muted);
    font-family: var(--weeb-font-mono);
  }

  @media (max-width: 768px) {
    .footer {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }
  }
  @media (max-width: 480px) {
    .footer {
      padding: 24px 16px;
    }
  }
</style>
