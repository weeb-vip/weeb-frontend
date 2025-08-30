import { useQuery } from "@tanstack/react-query";
import { fetchUserAnimes, fetchCurrentlyAiringWithDates } from "../../services/queries";
import { Status } from "../../gql/graphql";
import AnimeCard, { AnimeCardStyle } from "../AnimeCard";
import { GetImageFromAnime } from "../../services/utils";
import { AnimeStatusDropdown } from "../AnimeStatusDropdown/AnimeStatusDropdown";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { getAirTimeDisplay } from "../../services/airTimeUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faPlay, faCalendarDays, faBookmark } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import Loader from "../Loader";

interface ProfileDashboardProps {
  className?: string;
}

export default function ProfileDashboard({ className }: ProfileDashboardProps) {
  const navigate = useNavigate();

  // Fetch user's watchlist (Plan to Watch and Watching) - using high limit to get all items
  const { data: watchingData, isLoading: watchingLoading } = useQuery(
    fetchUserAnimes({ input: { status: Status.Watching, limit: 1000, page: 1 } })
  );

  const { data: planToWatchData, isLoading: planToWatchLoading } = useQuery(
    fetchUserAnimes({ input: { status: Status.Plantowatch, limit: 1000, page: 1 } })
  );

  // Fetch currently airing shows for a 2-week window (1 week before + 1 week after)
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
  const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
  const { data: currentlyAiringData, isLoading: airingLoading } = useQuery(
    fetchCurrentlyAiringWithDates(startDate, endDate)
  );

  // Process watchlist shows and cross-reference with currently airing data
  const watchlistAnalysis = useMemo(() => {
    const watching = watchingData?.animes || [];
    const planToWatch = planToWatchData?.animes || [];
    const currentlyAiringShows = currentlyAiringData?.currentlyAiring || [];

    // Create lookup map of currently airing shows by ID
    const airingMap = new Map();
    currentlyAiringShows.forEach(anime => {
      if (anime) {
        airingMap.set(anime.id, anime);
      }
    });

    const allWatchlistShows = [...watching, ...planToWatch];
    const airingSoon: any[] = [];
    const recentlyAired: any[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Create set of watchlist anime IDs for quick lookup
    const watchlistIds = new Set(allWatchlistShows.map(entry => entry.anime?.id).filter(Boolean));

    // Process all currently airing shows for "Airing This Week" section
    currentlyAiringShows.forEach(airingInfo => {
      if (!airingInfo || !(airingInfo as any).episodes || (airingInfo as any).episodes.length === 0) return;

      // Find the next unaired episode (first episode with airDate >= now)
      const upcomingEpisodes = (airingInfo as any).episodes
        .filter((ep: any) => ep.airDate)
        .map((ep: any) => ({ ...ep, airDate: new Date(ep.airDate!) }))
        .filter((ep: any) => ep.airDate >= now)
        .sort((a: any, b: any) => a.airDate.getTime() - b.airDate.getTime());

      if (upcomingEpisodes.length === 0) return; // No upcoming episodes

      const nextEpisode = upcomingEpisodes[0];
      const nextEpisodeDate = nextEpisode.airDate;

      // If next episode is within the next 7 days (from today forward)
      if (nextEpisodeDate <= sevenDaysFromNow && nextEpisodeDate >= now) {
        const airTimeInfo = getAirTimeDisplay(nextEpisodeDate.toISOString(), airingInfo.broadcast) || {
          show: true,
          text: `Airing ${format(nextEpisodeDate, "EEE")} at ${format(nextEpisodeDate, "h:mm a")}`,
          variant: 'scheduled' as const
        };

        // Check if this anime is in user's watchlist
        const watchlistEntry = allWatchlistShows.find(entry => entry.anime?.id === airingInfo.id);
        const isInWatchlist = watchlistIds.has(airingInfo.id);

        const enhancedEntry = {
          // If it's in watchlist, use the watchlist entry structure, otherwise create a minimal structure
          ...(watchlistEntry || {
            id: `non-watchlist-${airingInfo.id}`,
            anime: {
              id: airingInfo.id,
              titleEn: airingInfo.titleEn,
              titleJp: airingInfo.titleJp,
              description: null,
              episodeCount: null,
              duration: airingInfo.duration,
              startDate: airingInfo.startDate,
              imageUrl: airingInfo.imageUrl
            },
            status: null // Not in watchlist
          }),
          airingInfo: {
            ...airingInfo,
            airTimeDisplay: airTimeInfo,
            nextEpisodeDate,
            nextEpisode, // Use our calculated next episode instead of the potentially stale one
            isInWatchlist
          }
        };

        airingSoon.push(enhancedEntry);
      }
    });

    // Cross-reference watchlist with currently airing shows for recently aired (watchlist only)
    allWatchlistShows.forEach(entry => {
      const anime = entry.anime;
      if (!anime) return;

      const airingInfo = airingMap.get(anime.id);

      if (airingInfo) {
        // Check for recently aired episodes
        if ((airingInfo as any).episodes && (airingInfo as any).episodes.length > 0) {
          // Find the most recent episode that aired in the last 2 weeks
          const recentEpisodes = (airingInfo as any).episodes
            .filter((ep: any) => ep.airDate)
            .map((ep: any) => ({ ...ep, airDate: new Date(ep.airDate!) }))
            .filter((ep: any) => ep.airDate <= now && ep.airDate >= twoWeeksAgo)
            .sort((a: any, b: any) => b.airDate.getTime() - a.airDate.getTime()); // Most recent first

          if (recentEpisodes.length > 0) {
            const mostRecentEpisode = recentEpisodes[0];
            const daysSinceAired = (now.getTime() - mostRecentEpisode.airDate.getTime()) / (1000 * 60 * 60 * 24);

            // Create air time display for recently aired episode
            const recentAirTimeInfo = airingInfo.broadcast ?
              getAirTimeDisplay(mostRecentEpisode.airDate.toISOString(), airingInfo.broadcast) :
              { show: true, text: "Recently aired", variant: 'aired' as const };

            const enhancedEntry = {
              ...entry,
              airingInfo: {
                ...airingInfo,
                airTimeDisplay: recentAirTimeInfo,
                recentEpisode: mostRecentEpisode,
                daysSinceAired: Math.floor(daysSinceAired)
              }
            };

            recentlyAired.push(enhancedEntry);
          }
        }
      }
    });

    // Sort by watchlist status first, then by air date proximity
    airingSoon.sort((a, b) => {
      // Prioritize watchlist items
      const aInWatchlist = a.airingInfo?.isInWatchlist || false;
      const bInWatchlist = b.airingInfo?.isInWatchlist || false;

      if (aInWatchlist !== bInWatchlist) {
        return bInWatchlist ? 1 : -1; // Watchlist items first
      }

      // Then sort by air date
      const aDate = a.airingInfo?.nextEpisodeDate || new Date();
      const bDate = b.airingInfo?.nextEpisodeDate || new Date();
      return aDate.getTime() - bDate.getTime();
    });

    recentlyAired.sort((a, b) => {
      return (a.airingInfo?.daysSinceAired || 0) - (b.airingInfo?.daysSinceAired || 0);
    });

    const currentlyWatching = watching.slice(0, 6);

    return {
      airingSoon: airingSoon.slice(0, 12), // Increased to show more discovery content
      recentlyAired: recentlyAired.slice(0, 6),
      currentlyWatching,
      allWatchlistShows
    };
  }, [watchingData, planToWatchData, currentlyAiringData]);

  if (watchingLoading || planToWatchLoading || airingLoading) {
    return <Loader />;
  }

  const { airingSoon, recentlyAired, currentlyWatching } = watchlistAnalysis;

  return (
    <div className={`space-y-8 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <Link
          to="/profile/anime"
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          <FontAwesomeIcon icon={faBookmark} />
          View All Lists
          <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
        </Link>
      </div>

      {/* Airing Soon Section */}
      {airingSoon.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faPlay} className="text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Airing This Week
              </h2>
              <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-sm font-medium px-2 py-1 rounded-full">
                {airingSoon.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {airingSoon.map((entry: any) => (
              <div key={`airing-${entry.id}`} className="relative">
                <AnimeCard
                  style={AnimeCardStyle.DETAIL}
                  forceListLayout={true}
                  id={entry.anime?.id}
                  title={entry.anime?.titleEn || entry.anime?.titleJp || "Unknown"}
                  description={entry.anime?.description || ""}
                  episodes={entry.airingInfo?.episodeCount || entry.anime?.episodeCount || 0}
                  episodeLength={entry.airingInfo?.duration?.replace(/per.+?$|per/gm, '') || entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
                  image={GetImageFromAnime(entry.airingInfo) || GetImageFromAnime(entry.anime)}
                  onClick={() => navigate(`/show/${entry.anime?.id}`)}
                  year={entry.airingInfo?.startDate ? new Date(entry.airingInfo.startDate).getFullYear().toString() :
                        entry.anime?.startDate ? new Date(entry.anime.startDate).getFullYear().toString() : "Unknown"}
                  airTime={entry.airingInfo?.airTimeDisplay}
                  nextEpisode={entry.airingInfo?.nextEpisode}
                  broadcast={entry.airingInfo?.broadcast}
                  // entry={entry}
                  options={[
                    entry.airingInfo?.isInWatchlist ? (
                      <AnimeStatusDropdown key={`dropdown-${entry.id}`} entry={entry as any} variant="compact" />
                    ) : (
                      <button
                        key={`add-${entry.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add to watchlist logic would go here
                          navigate(`/show/${entry.anime?.id}`);
                        }}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                      >
                        Add to List
                      </button>
                    )
                  ]}
                />
                {/* Days until airing indicator */}
                {/*{(() => {*/}
                {/*  const daysUntilAiring = Math.ceil((entry.airingInfo?.nextEpisodeDate?.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));*/}
                {/*  const isToday = daysUntilAiring === 0;*/}
                {/*  const isTomorrow = daysUntilAiring === 1;*/}

                {/*  return (*/}
                {/*    <div className={`absolute bottom-2 right-2 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg ${*/}
                {/*      isToday ? 'bg-red-500' : isTomorrow ? 'bg-orange-500' : 'bg-blue-500'*/}
                {/*    }`}>*/}
                {/*      {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : `${daysUntilAiring}d`}*/}
                {/*    </div>*/}
                {/*  );*/}
                {/*})()}*/}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently Aired Section */}
      {recentlyAired.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faCalendarDays} className="text-green-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Recently Aired Episodes
              </h2>
              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-medium px-2 py-1 rounded-full">
                {recentlyAired.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentlyAired.map((entry: any) => (
              <div key={`aired-${entry.id}`} className="relative">
                <AnimeCard
                  style={AnimeCardStyle.DETAIL}
                  forceListLayout={true}
                  id={entry.anime?.id}
                  title={entry.anime?.titleEn || entry.anime?.titleJp || "Unknown"}
                  description={entry.anime?.description || ""}
                  episodes={entry.airingInfo?.episodeCount || entry.anime?.episodeCount || 0}
                  episodeLength={entry.airingInfo?.duration?.replace(/per.+?$|per/gm, '') || entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
                  image={GetImageFromAnime(entry.airingInfo) || GetImageFromAnime(entry.anime)}
                  onClick={() => navigate(`/show/${entry.anime?.id}`)}
                  year={entry.airingInfo?.startDate ? new Date(entry.airingInfo.startDate).getFullYear().toString() :
                        entry.anime?.startDate ? new Date(entry.anime.startDate).getFullYear().toString() : "Unknown"}
                  airTime={{
                    show: true,
                    text: `Episode ${entry.airingInfo?.recentEpisode?.episodeNumber || '?'} • ${entry.airingInfo?.daysSinceAired === 0 ? 'Today' : entry.airingInfo?.daysSinceAired === 1 ? 'Yesterday' : `${entry.airingInfo?.daysSinceAired} days ago`}`,
                    variant: 'aired' as const
                  }}
                  // entry={{ airingInfo: { isInWatchlist: true } }}
                  options={[
                    <AnimeStatusDropdown key={`dropdown-${entry.id}`} entry={entry as any} variant="compact" />
                  ]}
                />
                {/*/!* Episode indicator *!/*/}
                {/*<div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">*/}
                {/*  New Episode*/}
                {/*</div>*/}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Currently Watching Section */}
      {currentlyWatching.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faPlay} className="text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Currently Watching
              </h2>
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium px-2 py-1 rounded-full">
                {currentlyWatching.length}
              </span>
            </div>
            <Link
              to="/profile/anime"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-sm flex items-center gap-1"
            >
              View All
              <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {currentlyWatching.map((entry) => (
              <AnimeCard
                key={`watching-${entry.id}`}
                style={AnimeCardStyle.DETAIL}
                forceListLayout={true}
                id={entry.anime?.id}
                title={entry.anime?.titleEn || entry.anime?.titleJp || "Unknown"}
                description={entry.anime?.description || ""}
                episodes={entry.anime?.episodeCount || 0}
                episodeLength={entry.anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
                image={GetImageFromAnime(entry.anime)}
                onClick={() => navigate(`/show/${entry.anime?.id}`)}
                year={entry.anime?.startDate ? new Date(entry.anime.startDate).getFullYear().toString() : "Unknown"}
                // entry={{ airingInfo: { isInWatchlist: true } }}
                options={[
                  <AnimeStatusDropdown key={`dropdown-${entry.id}`} entry={entry as any} variant="compact" />
                ]}
              />
            ))}
          </div>
        </section>
      )}

      {/* Quick Stats */}
      <section className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm transition-colors duration-300">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {watchingData?.total || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Watching</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {planToWatchData?.total || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Plan to Watch</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {airingSoon.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">This Week</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {recentlyAired.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Recent Episodes</div>
          </div>
        </div>
      </section>

      {/* Empty State */}
      {airingSoon.length === 0 && recentlyAired.length === 0 && currentlyWatching.length === 0 && (
        <div className="text-center py-12">
          <FontAwesomeIcon icon={faBookmark} className="text-6xl text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Your watchlist is empty
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start adding anime to your watchlist to see personalized recommendations and airing schedules.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Explore Anime
            <FontAwesomeIcon icon={faChevronRight} />
          </Link>
        </div>
      )}
    </div>
  );
}
