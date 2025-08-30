import { AnimeCardSkeleton, AnimeCardStyle } from "../AnimeCard/AnimeCard";
import { Skeleton } from "../Skeleton/Skeleton";
import {HeroBannerSkeleton} from "../HeroBanner/HeroBanner";

// Home page skeleton that matches the actual home page structure exactly
export function HomePageSkeleton() {
  return (
    <div className={"flex flex-col space-y-6 max-w-screen-2xl"} style={{margin: "0 auto"}}>
      {/* Hero Banner - matches index.tsx:135-148 exactly */}
      <HeroBannerSkeleton />

      {/* Currently Airing Section - matches index.tsx:150-220 exactly */}
      <div className={"w-full flex flex-col"}>
        <div className="flex items-center justify-between mb-4">
          <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Currently Airing Anime</h1>
          <div className="text-blue-600 dark:text-blue-400 font-medium">
            See all →
          </div>
        </div>
        <div className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
          {Array(8).fill({id: 1}).map((anime, index) => (
            <AnimeCardSkeleton key={`currently-airing-${index}`} {...anime} style={AnimeCardStyle.DETAIL} />
          ))}
        </div>
      </div>

      {/* Most Popular Section - matches index.tsx:221-271 exactly */}
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Most Popular Anime</h1>
        <div className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
          {Array(8).fill({id: 1}).map((anime, index) => (
            <AnimeCardSkeleton key={`most-popular-${index}`} {...anime} style={AnimeCardStyle.DETAIL} />
          ))}
        </div>
      </div>

      {/* Top Rated Section - matches index.tsx:273-316 exactly */}
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Top Rated Anime</h1>
        <div className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
          {Array(8).fill({id: 1}).map((anime, index) => (
            <AnimeCardSkeleton key={`top-rated-${index}`} {...anime} style={AnimeCardStyle.DETAIL} />
          ))}
        </div>
      </div>

      {/* Newest Section - matches index.tsx:318-363 exactly */}
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Newest Anime</h1>
        <div className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
          {Array(8).fill({id: 1}).map((anime, index) => (
            <AnimeCardSkeleton key={`newest-${index}`} {...anime} style={AnimeCardStyle.DETAIL} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Show/anime detail page skeleton that matches the exact structure
export function ShowPageSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 relative transition-colors duration-300">
      {/* Sticky Header Skeleton - matches show/index.tsx:128-189 */}
      <div className="fixed top-22 left-0 right-0 z-30 -translate-y-full opacity-0">
        <div className="relative overflow-hidden border-b border-gray-200 dark:border-gray-700 px-4 py-4 shadow-md">
          <div className="absolute inset-0 bg-white/90 dark:bg-black/60 backdrop-blur-sm" />
          <div className="max-w-screen-2xl mx-auto relative z-10">
            <div className="flex items-center gap-4">
              <Skeleton className="w-8 h-12 flex-shrink-0" />
              <div className="min-w-0 flex-1 pr-16">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-32 mt-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background banner skeleton - matches show/index.tsx:190-233 */}
      <div className="relative bg-cover bg-center bg-white dark:bg-gray-900 h-[420px] transition-all duration-300 overflow-hidden">
        <div className="absolute block inset-0 bg-white dark:bg-gray-900 w-full h-full transition-colors duration-300"/>
        <div className="absolute inset-0 w-full h-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
      </div>

      {/* Main content card skeleton - matches show/index.tsx:235-278 */}
      <div className="bg-gray-100 dark:bg-gray-900 -mt-[350px] lg:-mt-[200px] transition-colors duration-300">
        <div className="relative z-10 flex justify-center pt-20">
          <div className="flex flex-col lg:flex-row items-start max-w-screen-2xl w-full mx-4 lg:mx-auto p-6 text-white backdrop-blur-lg bg-black/50 rounded-md shadow-md">
            {/* Poster skeleton */}
            <div className="h-48 w-32 lg:h-64 lg:w-48 bg-gray-600 rounded-md animate-pulse" />

            {/* Content skeleton */}
            <div className="lg:ml-10 mt-4 lg:mt-0 space-y-4 w-full">
              <div className="h-8 bg-gray-600 rounded w-3/4 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-gray-600 rounded w-full animate-pulse" />
                <div className="h-4 bg-gray-600 rounded w-5/6 animate-pulse" />
                <div className="h-4 bg-gray-600 rounded w-4/5 animate-pulse" />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-neutral-300">
                <div className="h-4 bg-gray-600 rounded w-16 animate-pulse" />
                <div className="h-4 bg-gray-600 rounded w-20 animate-pulse" />
                <div className="h-4 bg-gray-600 rounded w-16 animate-pulse" />
              </div>
              <div className="flex flex-wrap gap-2">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-6 bg-gray-600 rounded-full w-16 animate-pulse" />
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="h-10 bg-gray-600 rounded w-32 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Content sections skeleton - matches show/index.tsx:279-390 */}
        <div className="bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-8 lg:px-16 transition-colors duration-300">
          <div className="max-w-screen-2xl mx-auto flex flex-col gap-8">
            {/* Next episode card skeleton */}
            <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded shadow text-sm transition-colors duration-300">
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-4 w-64 mt-1" />
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
              {/* Details Panel skeleton - matches show/index.tsx:325-367 */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-md text-sm w-full lg:max-w-xs transition-colors duration-300">
                <div className="space-y-6">
                  {/* Titles section */}
                  <div className="space-y-3">
                    <div className="font-bold border-b border-gray-200 dark:border-gray-600 pb-1">
                      <Skeleton className="h-5 w-12" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                  {/* Production section */}
                  <div className="space-y-3">
                    <div className="font-bold border-b border-gray-200 dark:border-gray-600 pb-1">
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  {/* Rating section */}
                  <div className="space-y-3">
                    <div className="font-bold border-b border-gray-200 dark:border-gray-600 pb-1">
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  {/* Aired section */}
                  <div className="space-y-3">
                    <div className="font-bold border-b border-gray-200 dark:border-gray-600 pb-1">
                      <Skeleton className="h-5 w-12" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </div>

              {/* Tabs Section skeleton - matches show/index.tsx:369-382 */}
              <div className="w-full">
                <div className="flex gap-4 border-b pb-2 mb-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
                <div className="space-y-4">
                  {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded shadow">
                      <div className="flex gap-4">
                        <Skeleton className="h-12 w-20 flex-shrink-0" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer skeleton */}
            <div className="flex justify-end mt-8">
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile page skeleton - matches profile/index.tsx structure
export function ProfilePageSkeleton() {
  return (
    <div className="max-w-screen-md mx-auto p-6">
      <Skeleton className="h-9 w-48 mb-4" />

      <div className="bg-white dark:bg-gray-800 shadow rounded p-4 space-y-4 mb-6 transition-colors duration-300">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-4 w-80" />
        <div className="space-y-2 pl-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
    </div>
  );
}

// Currently airing page skeleton - matches CurrentlyAiring/index.tsx exactly
export function CurrentlyAiringPageSkeleton() {
  return (
    <div className="flex flex-col space-y-8 max-w-screen-2xl w-full mx-auto">
      {/* Hero Section - matches index.tsx:182-193 */}
      <HeroBannerSkeleton />

      {/* Header with View Calendar button - matches index.tsx:195-207 */}
      <div className="px-4">
        <div className="top-0 p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-sm float-right">
          <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
      </div>

      {/* Category Sections - matches index.tsx:209-215 */}
      <div className="px-4 space-y-8">
        {/* Airing Today Section */}
        <div className="flex flex-col space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Airing Today (8)
          </h2>
          <div className="flex flex-col space-y-4">
            {Array(8).fill(0).map((_, index) => (
              <AnimeCardSkeleton
                key={`airing-today-${index}`}
                style={AnimeCardStyle.LONG}
                forceListLayout={true}
              />
            ))}
          </div>
        </div>

        {/* Airing This Week Section */}
        <div className="flex flex-col space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Airing This Week (12)
          </h2>
          <div className="flex flex-col space-y-4">
            {Array(12).fill(0).map((_, index) => (
              <AnimeCardSkeleton
                key={`airing-week-${index}`}
                style={AnimeCardStyle.EPISODE}
                forceListLayout={true}
              />
            ))}
          </div>
        </div>

        {/* Recently Aired Section */}
        <div className="flex flex-col space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Recently Aired (6)
          </h2>
          <div className="flex flex-col space-y-4">
            {Array(6).fill(0).map((_, index) => (
              <AnimeCardSkeleton
                key={`recently-aired-${index}`}
                style={AnimeCardStyle.EPISODE}
                forceListLayout={true}
              />
            ))}
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="flex flex-col space-y-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Coming Soon (10)
          </h2>
          <div className="flex flex-col space-y-4">
            {Array(10).fill(0).map((_, index) => (
              <AnimeCardSkeleton
                key={`coming-soon-${index}`}
                style={AnimeCardStyle.EPISODE}
                forceListLayout={true}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 404 page skeleton
export function NotFoundPageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Skeleton className="h-16 w-64" />
      <Skeleton className="h-6 w-96" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

// Smart skeleton detector based on current URL
function getSkeletonForPath() {
  const path = window.location.pathname;

  if (path === '/') {
    return <HomePageSkeleton />;
  } else if (path.startsWith('/show/')) {
    return <ShowPageSkeleton />;
  } else if (path === '/profile' || path === '/profile/anime') {
    return <ProfilePageSkeleton />;
  } else if (path === '/airing' || path === '/airing/calendar') {
    return <CurrentlyAiringPageSkeleton />;
  } else {
    return <NotFoundPageSkeleton />;
  }
}

// Smart skeleton wrapper that detects layout type
function getLayoutWrapperForPath(skeleton: React.ReactNode) {
  const path = window.location.pathname;

  // Show pages use FullWidthLayout (no padding wrapper)
  if (path.startsWith('/show/')) {
    return skeleton;
  }

  // All other pages use DefaultLayout (with padding wrapper)
  return (
    <div className={"w-full py-8 px-4 lg:px-16 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors duration-300"}>
      {skeleton}
    </div>
  );
}

// Main App skeleton for bootstrap loading - detects page and shows correct skeleton
export function AppLoadingSkeleton() {
  const pageSkeleton = getSkeletonForPath();
  const wrappedSkeleton = getLayoutWrapperForPath(pageSkeleton);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Main content with page-specific skeleton and correct layout */}
      <main className="flex-1">
        {wrappedSkeleton}
      </main>
    </div>
  );
}
