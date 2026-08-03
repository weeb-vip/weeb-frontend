<script lang="ts">
  import { page } from '$app/stores';

  export let title: string | undefined = undefined;
  export let description: string | undefined = undefined;
  export let image: string | undefined = undefined;
  export let noIndex: boolean = false;

  const defaultTitle = 'WeebVIP - Track Your Anime Watchlist';
  const defaultDescription = 'Discover, track, and manage your anime watchlist with WeebVIP. Get notifications for new episodes, explore seasonal anime, and connect with other anime fans.';
  const defaultImage = '/assets/og-image.jpg';
  const siteUrl = 'https://weeb.vip';

  $: pageTitle = title ? `${title} | WeebVIP` : defaultTitle;
  $: pageDescription = description || defaultDescription;
  // Resolved against the host that actually served this page, not the canonical site.
  // og:image has to be fetchable: on staging, resolving against siteUrl pointed the tag
  // at https://weeb.vip/og/<id>, which is a different deployment and 404s there.
  $: pageImage = new URL(image || defaultImage, $page.url.origin).toString();
  // canonical, og:url and twitter:url deliberately stay on the canonical host. Staging
  // self-canonicalising would make it an indexable duplicate of production.
  $: canonicalUrl = new URL($page.url.pathname, siteUrl).toString();
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={pageDescription} />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:image" content={pageImage} />
  <!-- Honest for every outcome: /og/<id> resolves to a CDN banner or poster resized
       to exactly 1200x630, and the branded default is 1200x630 too. -->
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={pageTitle} />
  <meta property="og:site_name" content="WeebVIP" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={pageDescription} />
  <meta name="twitter:image" content={pageImage} />
  <meta name="twitter:creator" content="@weebvip" />
  <meta name="twitter:site" content="@weebvip" />

  {#if noIndex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
</svelte:head>
