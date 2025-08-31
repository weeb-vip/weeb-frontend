import { useQuery } from "@tanstack/react-query";
import { fetchUserAnimes, fetchCurrentlyAiringWithDates } from "../../services/queries";
import { Status } from "../../gql/graphql";
import AnimeCard, { AnimeCardStyle } from "../AnimeCard";
import { GetImageFromAnime } from "../../services/utils";
import { AnimeStatusDropdown } from "../AnimeStatusDropdown/AnimeStatusDropdown";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { getAirTimeDisplay, findNextEpisode, parseAirTime, getCurrentTime } from "../../services/airTimeUtils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faPlay, faCalendarDays, faBookmark } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import Loader from "../Loader";
import { useAnimeCountdownStore } from "../../stores/animeCountdownStore";

interface ProfileDashboardProps {
  className?: string;
}

export default function ProfileDashboard({ className }: ProfileDashboardProps) {
  const navigate = useNavigate();
  const { getTimingData } = useAnimeCountdownStore();

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
    const now = getCurrentTime();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Create set of watchlist anime IDs for quick lookup
    const watchlistIds = new Set(allWatchlistShows.map(entry => entry.anime?.id).filter(Boolean));

    // Process all currently airing shows for "Airing This Week" section using main page logic
    currentlyAiringShows.forEach(airingInfo => {
      if (!airingInfo || !(airingInfo as any).episodes || (airingInfo as any).episodes.length === 0) return;
      if (!airingInfo.userAnime) return; // Skip if not in user's watchlist

      const episodes = (airingInfo as any).episodes;

      // Use shared function to find the next episode (same as main page)
      const nextEpisodeResult = findNextEpisode(episodes, airingInfo.broadcast, now);

      // If we found a next episode, add this anime to our list
      if (nextEpisodeResult) {
        const { episode: nextEpisode, airTime: nextEpisodeAirTime } = nextEpisodeResult;

        // Only include if episode is within the next 7 days or recently aired (within episode duration)
        const episodeDurationMs = airingInfo.duration ? parseInt(airingInfo.duration) * 60 * 1000 : 30 * 60 * 1000; // Default to 30 min
        const nowMinusEpisodeDuration = new Date(now.getTime() - episodeDurationMs);
        if (nextEpisodeAirTime <= sevenDaysFromNow && nextEpisodeAirTime >= nowMinusEpisodeDuration) {
          // Generate air time display info (same as main page)
          const airTimeInfo = getAirTimeDisplay(nextEpisode.airDate, airingInfo.broadcast) || {
            show: true,
            text: nextEpisodeAirTime <= now
              ? "Recently aired"
              : `Airing ${format(nextEpisodeAirTime, "EEE")} at ${format(nextEpisodeAirTime, "h:mm a")}`,
            variant: nextEpisodeAirTime <= now ? 'aired' as const : 'scheduled' as const
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
              nextEpisodeDate: nextEpisodeAirTime,
              nextEpisode: {
                ...nextEpisode,
                airDate: nextEpisodeAirTime
              },
              isInWatchlist
            }
          };

          airingSoon.push(enhancedEntry);
        }
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
            .map((ep: any) => {
              // Use parseAirTime to get the correct air time with timezone conversion
              const parsedAirTime = parseAirTime(ep.airDate, airingInfo.broadcast);
              return parsedAirTime ? { ...ep, airDate: parsedAirTime } : null;
            })
            .filter((ep: any) => ep !== null)
            .filter((ep: any) => {
              // Only include episodes that have actually aired (in the past) and within the last 2 weeks
              const epTime = ep.airDate.getTime();
              const nowTime = now.getTime();
              return epTime < nowTime && epTime >= twoWeeksAgo.getTime();
            })
            .sort((a: any, b: any) => b.airDate.getTime() - a.airDate.getTime()); // Most recent first

          if (recentEpisodes.length > 0) {
            const mostRecentEpisode = recentEpisodes[0];

            // For now, include all shows with recent episodes (until we can properly determine finished status)
            // TODO: Add better logic to filter only finished shows
            if (true) {
              // Use proper date comparison to avoid timezone issues
              const airDate = mostRecentEpisode.airDate;
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
              const episodeDate = new Date(airDate.getFullYear(), airDate.getMonth(), airDate.getDate());

              let daysSinceAiredText;
              if (episodeDate.getTime() === today.getTime()) {
                daysSinceAiredText = 'Today';
              } else if (episodeDate.getTime() === yesterday.getTime()) {
                daysSinceAiredText = 'Yesterday';
              } else {
                const daysDiff = Math.floor((today.getTime() - episodeDate.getTime()) / (1000 * 60 * 60 * 24));
                daysSinceAiredText = `${daysDiff} days ago`;
              }

              const airTimeText = format(mostRecentEpisode.airDate, 'h:mm a');
              const airDayText = format(mostRecentEpisode.airDate, 'EEE');

              const recentAirTimeInfo = {
                show: true,
                text: `Aired ${daysSinceAiredText} (${airDayText} at ${airTimeText})`,
                variant: 'aired' as const
              };

              const enhancedEntry = {
                ...entry,
                airingInfo: {
                  ...airingInfo,
                  airTimeDisplay: recentAirTimeInfo,
                  recentEpisode: mostRecentEpisode,
                  daysSinceAired: Math.floor((today.getTime() - episodeDate.getTime()) / (1000 * 60 * 60 * 24))
                }
              };

              recentlyAired.push(enhancedEntry);
            }
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
      // Sort by actual air time (most recent first) using parseAirTime for proper timezone conversion
        const aEpisode = a.airingInfo?.recentEpisode;
        const bEpisode = b.airingInfo?.recentEpisode;
        const aBroadcast = a.airingInfo?.broadcast;
        const bBroadcast = b.airingInfo?.broadcast;

        const aAirTime = (aEpisode?.airDate && aBroadcast) ? parseAirTime(aEpisode.airDate, aBroadcast)?.getTime() || 0 : 0;
        const bAirTime = (bEpisode?.airDate && bBroadcast) ? parseAirTime(bEpisode.airDate, bBroadcast)?.getTime() || 0 : 0;
        return bAirTime - aAirTime; // Most recent first (descending order)

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

  const { airingSoon, recentlyAired, currentlyWatching, allWatchlistShows } = watchlistAnalysis;

  // Create airingMap for Currently Watching section
  const currentlyAiringShows = currentlyAiringData?.currentlyAiring || [];
  const airingMap = new Map();
  currentlyAiringShows.forEach(anime => {
    if (anime) {
      airingMap.set(anime.id, anime);
    }
  });

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
            {airingSoon.map((entry: any) => {
              const airingInfo = entry.airingInfo;
              const anime = entry.anime;

              // Get worker timing data (same as main page)
              const timingData = getTimingData(anime.id);

              // Use worker timing data if available, otherwise use the calculated air time display
              let airTimeDisplay: any;
              let episodeTitle: string;
              let episodeNumber: string;

              if (timingData) {
                // Use worker timing data for more accurate information
                airTimeDisplay = {
                  show: true,
                  text: timingData.isCurrentlyAiring
                    ? "Currently airing"
                    : timingData.hasAlreadyAired
                      ? "Recently aired"
                      : timingData.countdown
                        ? (timingData.countdown === "JUST AIRED" ? timingData.countdown : `Airing in ${timingData.countdown}`)
                        : timingData.airDateTime,
                  variant: timingData.isCurrentlyAiring
                    ? 'airing' as const
                    : timingData.hasAlreadyAired
                      ? 'aired' as const
                      : 'countdown' as const,
                };

                // Use episode data from worker
                episodeTitle = timingData.episode?.titleEn || timingData.episode?.titleJp || airingInfo.nextEpisode?.titleEn || airingInfo.nextEpisode?.titleJp || "Unknown";
                episodeNumber = timingData.episode?.episodeNumber?.toString() || "Unknown";
              } else {
                // Use the air time display from ProfileDashboard logic
                airTimeDisplay = airingInfo.airTimeDisplay || undefined;
                episodeTitle = airingInfo.nextEpisode?.titleEn || airingInfo.nextEpisode?.titleJp || "Unknown";
                episodeNumber = airingInfo.nextEpisode?.episodeNumber?.toString() || "Unknown";
              }

              return (
                <div key={`airing-${entry.id}`} className="relative">
                  <AnimeCard
                    style={AnimeCardStyle.DETAIL}
                    forceListLayout={true}
                    id={anime.id}
                    title={anime.titleEn || anime.titleJp || "Unknown"}
                    description={anime.description || ""}
                    episodes={airingInfo.episodeCount || anime.episodeCount || 0}
                    episodeLength={airingInfo.duration?.replace(/per.+?$|per/gm, '') || anime.duration?.replace(/per.+?$|per/gm, '') || "?"}
                    image={GetImageFromAnime(airingInfo) || GetImageFromAnime(anime)}
                    onClick={() => navigate(`/show/${anime.id}`)}
                    year={airingInfo.startDate ? new Date(airingInfo.startDate).getFullYear().toString() :
                          anime.startDate ? new Date(anime.startDate).getFullYear().toString() : "Unknown"}
                    airTime={airTimeDisplay}
                    nextEpisode={airingInfo.nextEpisode}
                    broadcast={airingInfo.broadcast}
                    options={[
                      airingInfo.isInWatchlist ? (
                        <AnimeStatusDropdown key={`dropdown-${entry.id}`} entry={entry as any} variant="compact" />
                      ) : (
                        <button
                          key={`add-${entry.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Add to watchlist logic would go here
                            navigate(`/show/${anime.id}`);
                          }}
                          className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                        >
                          Add to List
                        </button>
                      )
                    ]}
                  />
                </div>
              );
            })}
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
            {recentlyAired.map((entry: any) => {
              const anime = entry.anime;
              const airingInfo = entry.airingInfo;

              // Get worker timing data (same as main page)
              const timingData = getTimingData(anime.id);

              // Use worker timing data if available, otherwise use the calculated air time display
              let airTimeDisplay: any;
              let episodeData: any;

              if (timingData) {
                // Use worker timing data for more accurate information
                let displayText = timingData.airDateTime;

                if (timingData.isCurrentlyAiring) {
                  displayText = "Currently airing";
                } else if (timingData.hasAlreadyAired && timingData.episode?.airDate) {
                  // Create detailed air time display for recently aired episodes using parseAirTime for timezone conversion
                  const parsedAirTime = parseAirTime(timingData.episode.airDate, airingInfo.broadcast);
                  if (parsedAirTime) {
                    const currentTime = getCurrentTime();
                    const daysSinceAired = (currentTime.getTime() - parsedAirTime.getTime()) / (1000 * 60 * 60 * 24);

                    const daysSinceAiredText = daysSinceAired < 1
                      ? 'Today'
                      : daysSinceAired < 2
                        ? 'Yesterday'
                        : `${Math.floor(daysSinceAired)} days ago`;

                    const airTimeText = format(parsedAirTime, 'h:mm a');
                    const airDayText = format(parsedAirTime, 'EEE');

                    displayText = `Aired ${daysSinceAiredText} (${airDayText} at ${airTimeText})`;
                  } else {
                    displayText = "Recently aired";
                  }
                } else if (timingData.countdown) {
                  // Handle special cases like "JUST AIRED" without "Airing in" prefix
                  if (timingData.countdown === "JUST AIRED") {
                    if (airingInfo.recentEpisode?.airDate) {
                      const parsedAirTime = parseAirTime(airingInfo.recentEpisode.airDate, airingInfo.broadcast);
                      if (parsedAirTime) {
                        const currentTime = getCurrentTime();
                        const daysSinceAired = (currentTime.getTime() - parsedAirTime.getTime()) / (1000 * 60 * 60 * 24);

                        const daysSinceAiredText = daysSinceAired < 1
                          ? 'Today'
                          : daysSinceAired < 2
                            ? 'Yesterday'
                            : `${Math.floor(daysSinceAired)} days ago`;

                        const airTimeText = format(parsedAirTime, 'h:mm a');
                        const airDayText = format(parsedAirTime, 'EEE');
                        displayText = `${airDayText} at ${airTimeText} (${daysSinceAiredText})`;
                      } else {
                        displayText = "Just aired";
                      }
                    } else {
                      displayText = "Just aired";
                    }
                  } else {
                    displayText = `Airing in ${timingData.countdown}`;
                  }
                }

                airTimeDisplay = {
                  show: true,
                  text: displayText,
                  variant: timingData.isCurrentlyAiring
                    ? 'airing' as const
                    : timingData.hasAlreadyAired
                      ? 'aired' as const
                      : 'countdown' as const,
                };

                // Use episode data from worker
                episodeData = timingData.episode;
              } else {
                // Create custom aired time display for recently aired section using parseAirTime
                if (airingInfo.recentEpisode && airingInfo.recentEpisode.airDate) {
                  const parsedAirTime = parseAirTime(airingInfo.recentEpisode.airDate, airingInfo.broadcast);
                  if (parsedAirTime) {
                    const currentTime = getCurrentTime();
                    const daysSinceAired = (currentTime.getTime() - parsedAirTime.getTime()) / (1000 * 60 * 60 * 24);

                    const daysSinceAiredText = daysSinceAired < 1
                      ? 'Today'
                      : daysSinceAired < 2
                        ? 'Yesterday'
                        : `${Math.floor(daysSinceAired)} days ago`;

                    const airTimeText = format(parsedAirTime, 'h:mm a');
                    const airDayText = format(parsedAirTime, 'EEE');

                    airTimeDisplay = {
                      show: true,
                      text: `Aired ${daysSinceAiredText} (${airDayText} at ${airTimeText})`,
                      variant: 'aired' as const
                    };
                  } else {
                    airTimeDisplay = { show: true, text: "Recently aired", variant: 'aired' as const };
                  }
                } else {
                  airTimeDisplay = { show: true, text: "Recently aired", variant: 'aired' as const };
                }
                episodeData = airingInfo.recentEpisode;
              }

              return (
                <div key={`aired-${entry.id}`} className="relative">
                  <AnimeCard
                    style={AnimeCardStyle.DETAIL}
                    forceListLayout={true}
                    id={anime?.id}
                    title={anime?.titleEn || anime?.titleJp || "Unknown"}
                    description={anime?.description || ""}
                    episodes={airingInfo?.episodeCount || anime?.episodeCount || 0}
                    episodeLength={airingInfo?.duration?.replace(/per.+?$|per/gm, '') || anime?.duration?.replace(/per.+?$|per/gm, '') || "?"}
                    image={GetImageFromAnime(airingInfo) || GetImageFromAnime(anime)}
                    onClick={() => navigate(`/show/${anime?.id}`)}
                    year={airingInfo?.startDate ? new Date(airingInfo.startDate).getFullYear().toString() :
                          anime?.startDate ? new Date(anime.startDate).getFullYear().toString() : "Unknown"}
                    airTime={airTimeDisplay}
                    nextEpisode={episodeData}
                    broadcast={airingInfo?.broadcast}
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
              );
            })}
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
            {currentlyWatching.map((entry) => {
              const anime = entry.anime;
              if (!anime) return null;

              // Use episode data directly from the anime object (from updated query)
              let airTimeDisplay: any = undefined;
              let nextEpisode: any = null;

              if (anime.episodes && anime.episodes.length > 0) {
                // Calculate timing info using episodes from the watchlist query
                const episodes = anime.episodes;
                const now = getCurrentTime();

                // Find next episode
                const nextEpisodeResult = findNextEpisode(episodes, anime.broadcast, now);

                if (nextEpisodeResult) {
                  const { episode, airTime } = nextEpisodeResult;
                  nextEpisode = episode;

                  const daysDiff = Math.ceil((airTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                  if (airTime <= now) {
                    airTimeDisplay = {
                      show: true,
                      text: "Recently aired",
                      variant: 'aired' as const
                    };
                  } else if (daysDiff <= 7) {
                    airTimeDisplay = {
                      show: true,
                      text: `Next episode ${format(airTime, "EEE")} at ${format(airTime, "h:mm a")}`,
                      variant: 'scheduled' as const
                    };
                  } else {
                    airTimeDisplay = {
                      show: true,
                      text: `Next episode in ${daysDiff} days`,
                      variant: 'scheduled' as const
                    };
                  }
                } else {
                  // No future episodes, find the last episode
                  const pastEpisodes = episodes
                    .filter((ep: any) => ep.airDate)
                    .map((ep: any) => {
                      const parsedAirTime = parseAirTime(ep.airDate, anime.broadcast);
                      return parsedAirTime ? { ...ep, airDate: parsedAirTime } : null;
                    })
                    .filter((ep: any) => ep !== null && ep.airDate.getTime() < now.getTime())
                    .sort((a: any, b: any) => b.airDate.getTime() - a.airDate.getTime());

                  if (pastEpisodes.length > 0) {
                    const lastEpisode = pastEpisodes[0];
                    const daysSinceFinished = Math.floor((now.getTime() - lastEpisode.airDate.getTime()) / (1000 * 60 * 60 * 24));

                    // Format the finish date
                    const finishDateText = daysSinceFinished < 1
                      ? "Finished today"
                      : daysSinceFinished < 2
                        ? "Finished yesterday"
                        : `Finished ${format(lastEpisode.airDate, "MMM d, yyyy")}`;

                    airTimeDisplay = {
                      show: true,
                      text: finishDateText,
                      variant: 'aired' as const
                    };
                  }
                }
              }

              return (
                <AnimeCard
                  key={`watching-${entry.id}`}
                  style={AnimeCardStyle.DETAIL}
                  forceListLayout={true}
                  id={anime.id}
                  title={anime.titleEn || anime.titleJp || "Unknown"}
                  description={anime.description || ""}
                  episodes={anime.episodeCount || 0}
                  episodeLength={anime.duration?.replace(/per.+?$|per/gm, '') || "?"}
                  image={GetImageFromAnime(anime)}
                  onClick={() => navigate(`/show/${anime.id}`)}
                  year={anime.startDate ? new Date(anime.startDate).getFullYear().toString() : "Unknown"}
                  airTime={airTimeDisplay}
                  nextEpisode={nextEpisode}
                  broadcast={anime.broadcast}
                  options={[
                    <AnimeStatusDropdown key={`dropdown-${entry.id}`} entry={entry as any} variant="compact" />
                  ]}
                />
              );
            })}
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
