<div class="hero-skeleton">
  <!-- Background -->
  <div class="hero-skeleton-bg"></div>

  <!-- Overlay gradients -->
  <div class="hero-skeleton-overlay"></div>

  <!-- Content -->
  <div class="hero-skeleton-content">
    <!-- Badge -->
    <div class="skeleton-badge">
      <div class="skeleton-dot"></div>
      <div class="skeleton-line" style="width: 96px; height: 16px;"></div>
    </div>

    <!-- Title -->
    <div class="skeleton-line" style="width: 320px; height: 36px; margin-bottom: 16px;"></div>

    <!-- Description lines -->
    <div class="skeleton-line" style="width: 280px; height: 20px; margin-bottom: 8px;"></div>
    <div class="skeleton-line" style="width: 200px; height: 20px; margin-bottom: 24px;"></div>

    <!-- Meta tags -->
    <div style="display: flex; gap: 8px; margin-bottom: 20px;">
      <div class="skeleton-line" style="width: 60px; height: 24px; border-radius: 4px;"></div>
      <div class="skeleton-line" style="width: 80px; height: 24px; border-radius: 4px;"></div>
      <div class="skeleton-line" style="width: 70px; height: 24px; border-radius: 4px;"></div>
    </div>

    <!-- Buttons -->
    <div style="display: flex; gap: 10px;">
      <div class="skeleton-line" style="width: 120px; height: 40px; border-radius: var(--weeb-radius, 8px);"></div>
      <div class="skeleton-line" style="width: 100px; height: 40px; border-radius: var(--weeb-radius, 8px);"></div>
    </div>
  </div>
</div>

<style>
  .hero-skeleton {
    position: relative;
    width: 100%;
    min-height: 720px;
    overflow: hidden;
  }
  .hero-skeleton-bg {
    position: absolute;
    inset: 0;
    background: var(--weeb-surface);
    animation: shimmer 1.5s infinite;
  }
  .hero-skeleton-overlay {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to top, var(--weeb-bg) 0%, oklch(14% 0.015 275 / 0.85) 40%, oklch(14% 0.015 275 / 0.55) 70%, oklch(14% 0.015 275 / 0.3) 100%),
      linear-gradient(to right, oklch(14% 0.015 275 / 0.7) 0%, transparent 60%);
  }
  .hero-skeleton-content {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    height: 100%;
    min-height: 720px;
    padding: 0 48px 48px;
  }
  .skeleton-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    background: var(--weeb-surface-hover);
    margin-bottom: 16px;
    width: fit-content;
  }
  .skeleton-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--weeb-surface-hover);
  }
  .skeleton-line {
    background: var(--weeb-surface-hover);
    border-radius: 6px;
    animation: shimmer 1.5s infinite;
  }
  @keyframes shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }
  @media (max-width: 1024px) {
    .hero-skeleton-content { padding: 0 24px 32px; }
  }
  @media (max-width: 768px) {
    .hero-skeleton, .hero-skeleton-content { min-height: 560px; }
  }
  @media (max-width: 480px) {
    .hero-skeleton-content { padding: 0 16px 24px; }
    .hero-skeleton, .hero-skeleton-content { min-height: 480px; }
  }
</style>
