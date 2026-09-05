<script lang="ts">
  import { fade, fly } from 'svelte/transition';

  /**
   * The /about page. Static copy, so no bloc: there is no state, no fetch and
   * no store here -- only content and the order it reads in.
   *
   * The whole template used to sit behind `{#if mounted}`, flipped in onMount, so the
   * page server-rendered nothing at all: crawlers saw an empty document and the h1
   * never existed in the HTML. The intro transitions below still play on client-side
   * navigation — they just no longer decide whether the content exists.
   *
   * The sections are data rather than six near-identical markup blocks. They
   * differ only in copy, and hand-copying the wrapper each time is how the
   * transition delays drifted out of step in the first place.
   */

  /** One accented rule beside a feature. Tokens only -- there is no green-500 in this product. */
  const FEATURES: { title: string; accent: string; body: string }[] = [
    {
      title: 'Anime Tracking',
      accent: 'var(--weeb-accent)',
      body:
        'Keep track of anime across different statuses: Currently Watching, Plan to Watch, Completed, ' +
        'On Hold, and Dropped. Update your progress and manage your personal anime database.',
    },
    {
      title: 'Episode Notifications',
      accent: 'var(--weeb-green)',
      body:
        'Get notified when new episodes of anime in your watchlist are released. The system tracks ' +
        'broadcast schedules and sends timely notifications so you never miss an episode.',
    },
    {
      title: 'Seasonal Discovery',
      accent: 'var(--weeb-violet)',
      body:
        'Browse currently airing anime and explore seasonal catalogs. Find new shows to add to ' +
        'your watchlist and stay current with what’s popular each season.',
    },
    {
      title: 'Search & Information',
      accent: 'var(--weeb-amber)',
      body:
        'Search through a comprehensive anime database with detailed information including ' +
        'descriptions, episode counts, air dates, studios, and more.',
    },
  ];

  const TECH: { heading: string; points: string[] }[] = [
    {
      heading: 'Frontend',
      points: [
        'Built with SvelteKit and Svelte 5',
        'Styled with TailwindCSS and design tokens',
        'Responsive design for all devices',
        'Server-rendered for a fast first paint',
        'Progressive Web App features',
      ],
    },
    {
      heading: 'Data & Search',
      points: [
        'GraphQL API for data queries',
        'Algolia-powered search',
        'Real-time episode tracking',
        'Broadcast schedule integration',
        'Comprehensive anime metadata',
      ],
    },
  ];

  /** Long-form prose blocks, in reading order. Each is one section on the page. */
  const PROSE: { heading: string; paragraphs: string[]; boxed?: boolean }[] = [
    {
      heading: 'Data Sources',
      paragraphs: [
        'WeebVIP aggregates anime information from multiple sources to provide comprehensive ' +
          'and up-to-date data. This includes basic anime information, episode schedules, ' +
          'broadcast times, and metadata.',
        'The platform focuses on accuracy and timeliness, especially for episode release ' +
          'schedules and broadcast information that powers the notification system.',
      ],
    },
    {
      heading: 'Development',
      paragraphs: [
        'WeebVIP is actively developed with a focus on user experience and reliability. ' +
          'The platform is continuously updated with bug fixes, performance improvements, ' +
          'and new features based on user feedback.',
        'Development priorities include maintaining accurate episode schedules, improving ' +
          'search functionality, and ensuring the platform remains fast and accessible ' +
          'across all devices.',
      ],
    },
    {
      heading: 'Feedback & Support',
      boxed: true,
      paragraphs: [
        'WeebVIP is an ongoing project that benefits from user feedback. If you encounter ' +
          'any issues, have suggestions for improvements, or notice incorrect anime information, ' +
          'your input helps make the platform better for everyone.',
        'The platform aims to be a reliable tool for anime fans without unnecessary complexity ' +
          'or bloated features - focusing on doing the core functionality really well.',
      ],
    },
  ];

  /** Sections enter in the order they are read, 100ms apart. */
  const flyIn = (index: number) => ({ y: 30, duration: 500, delay: 200 + index * 100 });
</script>

<div class="min-h-screen bg-weeb-surface transition-colors duration-300">
  <!-- Header -->
  <div class="bg-weeb-bg-elevated border-b border-weeb-border transition-colors duration-300">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="text-center" in:fade={{ duration: 600, delay: 100 }}>
        <h1 class="text-4xl font-bold text-weeb-fg mb-4">About WeebVIP</h1>
        <p class="text-lg text-weeb-fg-secondary">
          A modern anime tracking platform built for anime enthusiasts
        </p>
      </div>
    </div>
  </div>

  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <!-- What is WeebVIP -->
    <div class="mb-12" in:fly={flyIn(0)}>
      <h2 class="text-2xl font-semibold text-weeb-fg mb-6">What is WeebVIP?</h2>
      <div class="prose prose-lg max-w-none text-weeb-fg-secondary">
        <p class="mb-4">
          WeebVIP is an anime tracking platform that helps you manage your anime watching experience.
          It provides tools to track what you're currently watching, plan your next shows, and get
          notifications when new episodes are released.
        </p>
        <p>
          The platform was designed to be simple, fast, and focused on the core functionality that
          anime fans need most - keeping track of their watchlist and staying up to date with new episodes.
        </p>
      </div>
    </div>

    <!-- Core Features -->
    <div class="mb-12" in:fly={flyIn(1)}>
      <h2 class="text-2xl font-semibold text-weeb-fg mb-6">Core Features</h2>
      <div class="space-y-6">
        {#each FEATURES as feature (feature.title)}
          <div class="feature pl-4" style="border-color: {feature.accent};">
            <h3 class="text-lg font-medium text-weeb-fg mb-2">{feature.title}</h3>
            <p class="text-weeb-fg-secondary">{feature.body}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Technical Information -->
    <div class="mb-12" in:fly={flyIn(2)}>
      <h2 class="text-2xl font-semibold text-weeb-fg mb-6">Technical Details</h2>
      <div class="bg-weeb-bg-elevated rounded-lg p-6 border border-weeb-border">
        <div class="grid md:grid-cols-2 gap-6">
          {#each TECH as column (column.heading)}
            <div>
              <h3 class="text-lg font-medium text-weeb-fg mb-3">{column.heading}</h3>
              <ul class="space-y-1 text-weeb-fg-secondary">
                {#each column.points as point (point)}
                  <li>• {point}</li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>

        <div class="mt-6 pt-6 border-t border-weeb-border">
          <h3 class="text-lg font-medium text-weeb-fg mb-3">Performance & Accessibility</h3>
          <p class="text-weeb-fg-secondary">
            The site is optimized for performance with server-side rendering, efficient caching,
            and minimal JavaScript for core functionality. It follows web accessibility standards
            and works without JavaScript for basic browsing.
          </p>
        </div>
      </div>
    </div>

    {#each PROSE as section, i (section.heading)}
      <div class="mb-12" in:fly={flyIn(3 + i)}>
        <h2 class="text-2xl font-semibold text-weeb-fg mb-6">{section.heading}</h2>
        <div
          class="max-w-none text-weeb-fg-secondary"
          class:prose={!section.boxed}
          class:bg-weeb-surface={section.boxed}
          class:border={section.boxed}
          class:border-weeb-border={section.boxed}
          class:rounded-lg={section.boxed}
          class:p-6={section.boxed}
        >
          {#each section.paragraphs as paragraph, p (paragraph)}
            <p class={p < section.paragraphs.length - 1 ? 'mb-4' : ''}>{paragraph}</p>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- Simple Footer -->
  <div class="bg-weeb-bg-elevated border-t border-weeb-border mt-16">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="text-center text-sm text-weeb-fg-muted">
        <p>WeebVIP - Built for anime enthusiasts</p>
      </div>
    </div>
  </div>
</div>

<style>
  /* The accent rule. Its colour is a token passed per feature, so this only
     owns the shape. */
  .feature {
    border-left-width: 4px;
    border-left-style: solid;
  }
</style>
