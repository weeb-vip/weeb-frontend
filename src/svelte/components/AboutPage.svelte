<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let mounted = false;

  onMount(() => {
    mounted = true;
  });
</script>

{#if mounted}
  <div class="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-300">

    <!-- Header -->
    <div class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div class="text-center" in:fade="{{ duration: 600, delay: 100 }}">
          <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">About WeebVIP</h1>
          <p class="text-lg text-gray-600 dark:text-gray-300">
            A modern anime tracking platform built for anime enthusiasts
          </p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      <!-- What is WeebVIP -->
      <div class="mb-12" in:fly="{{ y: 30, duration: 500, delay: 200 }}">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">What is WeebVIP?</h2>
        <div class="prose prose-lg max-w-none text-gray-600 dark:text-gray-300">
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
      <div class="mb-12" in:fly="{{ y: 30, duration: 500, delay: 300 }}">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Core Features</h2>
        <div class="space-y-6">

          <div class="border-l-4 border-blue-500 pl-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Anime Tracking</h3>
            <p class="text-gray-600 dark:text-gray-300">
              Keep track of anime across different statuses: Currently Watching, Plan to Watch, Completed,
              On Hold, and Dropped. Update your progress and manage your personal anime database.
            </p>
          </div>

          <div class="border-l-4 border-green-500 pl-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Episode Notifications</h3>
            <p class="text-gray-600 dark:text-gray-300">
              Get notified when new episodes of anime in your watchlist are released. The system tracks
              broadcast schedules and sends timely notifications so you never miss an episode.
            </p>
          </div>

          <div class="border-l-4 border-purple-500 pl-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Seasonal Discovery</h3>
            <p class="text-gray-600 dark:text-gray-300">
              Browse currently airing anime and explore seasonal catalogs. Find new shows to add to
              your watchlist and stay current with what's popular each season.
            </p>
          </div>

          <div class="border-l-4 border-orange-500 pl-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Search & Information</h3>
            <p class="text-gray-600 dark:text-gray-300">
              Search through a comprehensive anime database with detailed information including
              descriptions, episode counts, air dates, studios, and more.
            </p>
          </div>

        </div>
      </div>

      <!-- Technical Information -->
      <div class="mb-12" in:fly="{{ y: 30, duration: 500, delay: 400 }}">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Technical Details</h2>
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">

          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Frontend</h3>
              <ul class="space-y-1 text-gray-600 dark:text-gray-300">
                <li>• Built with Astro and Svelte</li>
                <li>• Styled with TailwindCSS</li>
                <li>• Responsive design for all devices</li>
                <li>• Dark and light theme support</li>
                <li>• Progressive Web App features</li>
              </ul>
            </div>

            <div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Data & Search</h3>
              <ul class="space-y-1 text-gray-600 dark:text-gray-300">
                <li>• GraphQL API for data queries</li>
                <li>• Algolia-powered search</li>
                <li>• Real-time episode tracking</li>
                <li>• Broadcast schedule integration</li>
                <li>• Comprehensive anime metadata</li>
              </ul>
            </div>
          </div>

          <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Performance & Accessibility</h3>
            <p class="text-gray-600 dark:text-gray-300">
              The site is optimized for performance with server-side rendering, efficient caching,
              and minimal JavaScript for core functionality. It follows web accessibility standards
              and works without JavaScript for basic browsing.
            </p>
          </div>

        </div>
      </div>

      <!-- Data Sources -->
      <div class="mb-12" in:fly="{{ y: 30, duration: 500, delay: 500 }}">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Data Sources</h2>
        <div class="prose max-w-none text-gray-600 dark:text-gray-300">
          <p class="mb-4">
            WeebVIP aggregates anime information from multiple sources to provide comprehensive
            and up-to-date data. This includes basic anime information, episode schedules,
            broadcast times, and metadata.
          </p>
          <p>
            The platform focuses on accuracy and timeliness, especially for episode release
            schedules and broadcast information that powers the notification system.
          </p>
        </div>
      </div>

      <!-- Development -->
      <div class="mb-12" in:fly="{{ y: 30, duration: 500, delay: 600 }}">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Development</h2>
        <div class="prose max-w-none text-gray-600 dark:text-gray-300">
          <p class="mb-4">
            WeebVIP is actively developed with a focus on user experience and reliability.
            The platform is continuously updated with bug fixes, performance improvements,
            and new features based on user feedback.
          </p>
          <p>
            Development priorities include maintaining accurate episode schedules, improving
            search functionality, and ensuring the platform remains fast and accessible
            across all devices.
          </p>
        </div>
      </div>

      <!-- Contact/Feedback -->
      <div class="mb-12" in:fly="{{ y: 30, duration: 500, delay: 700 }}">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Feedback & Support</h2>
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <p class="text-gray-700 dark:text-gray-300 mb-4">
            WeebVIP is an ongoing project that benefits from user feedback. If you encounter
            any issues, have suggestions for improvements, or notice incorrect anime information,
            your input helps make the platform better for everyone.
          </p>
          <p class="text-gray-700 dark:text-gray-300">
            The platform aims to be a reliable tool for anime fans without unnecessary complexity
            or bloated features - focusing on doing the core functionality really well.
          </p>
        </div>
      </div>

    </div>

    <!-- Simple Footer -->
    <div class="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>WeebVIP - Built for anime enthusiasts</p>
        </div>
      </div>
    </div>

  </div>
{:else}
  <!-- Loading skeleton -->
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="bg-gray-200 dark:bg-gray-700 h-32 animate-pulse"></div>
    <div class="max-w-4xl mx-auto px-4 py-12 space-y-8">
      {#each Array(6) as _}
        <div class="bg-gray-200 dark:bg-gray-700 h-24 rounded animate-pulse"></div>
      {/each}
    </div>
  </div>
{/if}