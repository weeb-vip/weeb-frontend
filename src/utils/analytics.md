# Analytics Integration with PostHog

This project uses PostHog analytics for comprehensive product analytics and feature tracking.

## Setup

Analytics is automatically configured based on environment using API keys:
- **Production**: Production PostHog API key
- **Staging**: Staging PostHog API key
- **Development**: Development PostHog API key
- **Local**: Local development API key

The API key is loaded from `src/config/static/{environment}/index.json`

## Usage

Import the analytics utility:

```typescript
import { analytics } from '../utils/analytics';
```

### Pre-defined Events

**Anime Interactions:**
```typescript
// Track when user views an anime page
analytics.animeViewed('123', 'Attack on Titan');

// Track adding anime to lists
analytics.animeAddedToList('123', 'Attack on Titan', 'watching');
analytics.animeRemovedFromList('123', 'Attack on Titan', 'watching');

// Track ratings
analytics.animeRated('123', 'Attack on Titan', 8);
```

**Search & Discovery:**
```typescript
// Track searches
analytics.searchPerformed('attack on titan', 25);

// Track seasonal anime browsing
analytics.seasonalAnimeViewed('winter', 2024);
```

**User Engagement:**
```typescript
// Track profile views
analytics.profileViewed('user123');

// Track list sharing
analytics.listShared('watching', 15);

// Track page navigation
analytics.pageViewed('home', { section: 'trending' });
```

**Error Tracking:**
```typescript
analytics.errorOccurred('api_error', 'Failed to load anime list');
```

### Custom Events

For custom events not covered by pre-defined functions:

```typescript
import { trackEvent } from '../utils/analytics';

trackEvent('custom_action', {
  anime_id: '123',
  custom_data: 'value'
});
```

## Implementation Examples

**In Svelte Components:**
```typescript
<script lang="ts">
  import { analytics } from '../../utils/analytics';

  function handleAnimeClick(animeId: string, title: string) {
    analytics.animeViewed(animeId, title);
    // Navigate to anime page
  }
</script>

<button on:click={() => handleAnimeClick('123', 'Anime Title')}>
  View Anime
</button>
```

**In Astro Pages:**
```typescript
---
// In the frontmatter, you can't directly call analytics
// Add client-side script or use Svelte components
---

<script>
  import { analytics } from '../utils/analytics';

  // Track page view
  analytics.pageViewed('anime-detail', {
    anime_id: '123'
  });
</script>
```

## Analytics Dashboard

Access analytics at: `https://us.i.posthog.com`
- Log in with your configured authentication method
- PostHog provides comprehensive dashboards for events, user journeys, and feature flags

## Privacy

- PostHog is GDPR compliant
- Configurable data retention policies
- User privacy controls available
- Self-hosted on our infrastructure for data control
