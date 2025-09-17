# React Islands

This directory contains React components wrapped as Astro islands for the migrated application.

## What are Islands?

Islands are interactive React components that are hydrated on the client-side while the rest of the page is server-rendered by Astro.

## Island Strategy

### Client Directives Used

- `client:load` - Hydrates immediately when the page loads
- `client:idle` - Hydrates when the main thread is idle
- `client:visible` - Hydrates when the component scrolls into view

### Current Islands

1. **HomePage** - Complete homepage with all interactive features
2. **ShowDetailsPage** - Anime detail pages with dynamic content
3. **ProfilePage** - User profile with authentication
4. **CurrentlyAiringPage** - Seasonal anime listings
5. **LoginPage** - Authentication form
6. **RegisterPage** - User registration

## Usage in Astro Pages

```astro
---
import HomePage from '../components/islands/HomePage';
---

<Layout>
  <HomePage client:load />
</Layout>
```

## Provider Wrapping

Each island is wrapped with necessary providers:
- QueryProvider (React Query)
- FlagsmithProvider (Feature flags)

This ensures full compatibility with existing React components while leveraging Astro's performance benefits.

## Migration Notes

- All existing React components in `src/components/` remain unchanged
- Islands act as entry points that wrap page-level components
- State management (Zustand) and data fetching (React Query) work as before
- Web workers and service workers continue to function normally