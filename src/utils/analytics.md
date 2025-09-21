# Analytics Integration with Umami

This project uses Umami analytics for privacy-focused tracking.

## Setup

Analytics is automatically configured based on environment:
- **Production**: `weeb-vip`
- **Staging**: `weeb-staging`
- **Development**: `weeb-staging`
- **Local**: `weeb-local`

The website ID is loaded from `src/config/static/{environment}/index.json`

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

Access analytics at: `https://analytics.weeb.vip`
- **Username**: admin
- **Password**: umami (change after first login)

## Privacy

- Umami is GDPR compliant
- No cookies used for tracking
- No personal data collected
- All data stays on our servers