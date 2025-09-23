# Anime Actions Utilities

## Overview
The `anime-actions.ts` utility provides consolidated add-to-list and remove-from-list functionality with automatic error toast handling and login prompts.

## Quick Usage

```typescript
import { useAddAnimeWithToast, useDeleteAnimeWithToast, useQuickAddAnime } from '../utils/anime-actions';

// In your component:
const addMutation = useAddAnimeWithToast();
const deleteMutation = useDeleteAnimeWithToast();
const quickAdd = useQuickAddAnime();

// Add anime to list with automatic toast handling
function handleAddToList(animeId: string) {
  addMutation.mutate({
    animeID: animeId,
    status: 'PLAN_TO_WATCH'
  });
}

// Quick add methods
function addToPlanToWatch(animeId: string) {
  quickAdd.addToPlanToWatch(animeId); // Automatic success/error toasts
}

function addToWatching(animeId: string) {
  quickAdd.addToWatching(animeId);
}

// Remove from list
function handleRemove(animeId: string) {
  deleteMutation.mutate(animeId); // Automatic success/error toasts
}
```

## Features

✅ **Automatic Success Toasts** - Shows "Added to your list!" / "Removed from your list!"
✅ **Smart Error Handling** - Detects auth errors and shows login button in toast
✅ **Consistent Query Invalidation** - Refreshes all relevant queries automatically
✅ **Loading States** - Use `mutation.isPending` for loading indicators

## Error Handling

When a user is not logged in and tries to add anime:
- Shows error toast: "Please log in to add anime to your list"
- Includes a "Login" button that opens the login modal
- Works for all auth-related errors (unauthorized, forbidden, access denied, authentication)

## Migration from Raw Mutations

**Before:**
```typescript
const addMutation = createMutation({
  ...upsertAnime(),
  onSuccess: () => {
    // Manual query invalidation
    // Manual success handling
    // Manual error handling
  },
  onError: (error) => {
    // Manual error toast logic
    // Manual auth detection
  }
});
```

**After:**
```typescript
const addMutation = useAddAnimeWithToast();
// All success/error handling is automatic!
```

This utility ensures consistent UX across all pages with add-to-list functionality.

## Updated Components

The following components have been migrated to use the consolidated anime actions:

✅ **CurrentlyAiringDemo.svelte** - Currently airing page with add/remove functionality
✅ **HomepageSSR.svelte** - Homepage with seasonal anime and currently airing sections
✅ **ShowContent.svelte** - Individual anime detail page
✅ **HomepageDemo.svelte** - Homepage demo version with add/remove functionality
✅ **ProfileAnimeList.svelte** - User profile anime list management

## Universal Benefits

All these pages now have:
- **Consistent Error Toasts** with auth-aware login buttons
- **Automatic Success Toasts** for all add/remove operations
- **Smart Query Invalidation** for real-time UI updates
- **Unified Error Handling** across the entire application

## Adding to New Pages

To add this functionality to new pages, simply import and use:

```typescript
import { useQuickAddAnime } from '../utils/anime-actions';

const quickAdd = useQuickAddAnime();

// One-line implementation
<button onClick={() => quickAdd.addToPlanToWatch(animeId)}>
  Add to Plan to Watch
</button>
```