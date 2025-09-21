# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `yarn dev` - Start development server on port 8080
- `yarn build` - Build for production (runs TypeScript compilation and Vite build)
- `yarn preview` - Preview production build
- `yarn storybook` - Start Storybook development server on port 6006
- `yarn build-storybook` - Build Storybook for production

## Debug Logging

Use the debug utility in `src/utils/debug.ts` instead of console.log. All logs follow the format: `:emoji: :type:: :timestamp:: :message:`

```typescript
import debug from './utils/debug';

debug.info('General information');        // ℹ️ INFO: 14:32:15: General information
debug.warn('Warning message');           // ⚠️ WARN: 14:32:15: Warning message
debug.error('Error occurred');           // 🚨 ERROR: 14:32:15: Error occurred
debug.success('Operation completed!');   // ✅ SUCCESS: 14:32:15: Operation completed!
debug.auth('Authentication flow');       // 🔐 AUTH: 14:32:15: 🔒 ***MASKED***
debug.api('POST /api/login', response);  // 🌐 API: 14:32:15: POST /api/login 🔒 Response logged
debug.anime('Added to watchlist');      // 🍿 ANIME: 14:32:15: Added to watchlist
debug.log('Debug information');         // 🐛 DEBUG: 14:32:15: Debug information
```

**Features:**
- 🎯 **Consistent format** across all log types
- 🕐 **Automatic timestamps** in HH:MM:SS format
- 🔒 **Smart data masking** for sensitive information
- 📊 **Log levels** with environment-based filtering

**Environment Variables:**
- `VITE_DEBUG=true` - Enable debug logging in production
- `VITE_DEBUG_SENSITIVE=true` - Show sensitive data (tokens, etc)
- `VITE_LOG_LEVEL=debug|info|warn|error` - Set log level (default: info)

## Architecture Overview

This is an Astro frontend application for an anime tracking platform built with:

- **Astro** as the build tool and development server
- **Svelte** with TypeScript
- **TailwindCSS** for styling with SCSS for additional styles
- **TanStack Query** (Svelte Query) for data fetching and caching
- **Svelte stores** for global state management
- **Flagsmith** for feature flags
- **Motion** for animations

### Key Architectural Patterns

**Configuration System**: The app uses environment-specific config files in `src/config/static/` that get copied during build. Config is loaded at bootstrap and made globally available.

**Authentication**: Handled through Astro middleware with JWT token management. Login state managed in Svelte stores.

**Routing**: Uses lazy-loaded pages with two layout types:
- `DefaultLayout` - Standard layout with header
- `FullWidthLayout` - Full-width layout for detail pages

**Data Layer**: 
- GraphQL operations generated via GraphQL Code Generator from remote schema
- REST API calls handled through axios in `src/services/api/`
- Query caching via TanStack Query with React Query DevTools enabled

**Component Structure**: Components organized by feature in `src/components/` with index files for clean imports. Each component typically includes TypeScript interfaces and follows React functional patterns.

**State Management**:
- Global state via Svelte stores in `src/svelte/stores/`
- Local query state via TanStack Query
- Feature flags via Flagsmith integration

### Development Notes

The app serves different environments (development, staging) through config files. GraphQL schema is pulled from `https://gateway.weeb.vip/graphql` for code generation.

Key pages include:
- Home (`/`) - Main anime discovery
- Show detail (`/show/:id`) - Individual anime details  
- Profile (`/profile`) - User profile and anime lists
- Currently Airing (`/airing`) - Seasonal anime calendar

Components use TypeScript with `noImplicitAny: false` for flexibility. The build targets ES2018/Safari 11 for broader compatibility.
