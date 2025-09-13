import {useQueryClient} from "@tanstack/react-query";
import {Status} from "../gql/graphql";
import {format} from "date-fns";
import {useState, useMemo, Fragment} from "react";
import AnimeCard, {AnimeCardSkeleton, AnimeCardStyle} from "../components/AnimeCard";
import {Link, useNavigate} from "react-router-dom";
import {utc} from "@date-fns/utc/utc";
import Button, {ButtonColor} from "../components/Button";
import {mutate} from "swr";
import {StatusType} from "../components/Button/Button";
import {GetImageFromAnime} from "../services/utils";
import {AnimeStatusDropdown} from "../components/AnimeStatusDropdown/AnimeStatusDropdown";
import HeroBanner from "../components/HeroBanner";
import debug from "../utils/debug";
import {getAirTimeDisplay, findNextEpisode} from "../services/airTimeUtils";
import {useAnimeCountdownStore} from "../stores/animeCountdownStore";
import {getCurrentSeason, getSeasonDisplayName, getSeasonOptions} from "../utils/seasonUtils";
import {Menu, Transition} from "@headlessui/react";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronDown} from "@fortawesome/free-solid-svg-icons";
import {useHomePageData} from "../hooks/useHomePageData";
import {useSeasonalAnime} from "../hooks/useSeasonalAnime";
import {useCurrentlyAiring} from "../hooks/useCurrentlyAiring";
import {useAddAnime} from "../hooks/useAddAnime";


function Index() {
  const queryClient = useQueryClient();
  const { getTimingData } = useAnimeCountdownStore();
  
  // Get the current season and available season options
  const currentSeason = getCurrentSeason();
  const [selectedSeason, setSelectedSeason] = useState(currentSeason);
  const seasonOptions = getSeasonOptions(currentSeason);
  const seasonDisplayName = getSeasonDisplayName(selectedSeason);
  
  const {
    data: homeData,
    isLoading: homeDataIsLoading,
  } = useHomePageData();

  const {
    data: seasonalData,
    isLoading: seasonalDataIsLoading,
  } = useSeasonalAnime(selectedSeason);

  const {
    data: currentAiringData,
    isLoading: currentAiringIsLoading,
  } = useCurrentlyAiring();
  const navigate = useNavigate()

  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});
  const [hoveredAnime, setHoveredAnime] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);



  // Process currently airing anime with complete episode filtering logic
  const sortedCurrentlyAiring = useMemo(() => {
    if (!currentAiringData?.currentlyAiring) return [];

    const now = new Date();
    const currentlyAiringShows = currentAiringData.currentlyAiring || [];
    const processedAnime: any[] = [];

    // Process each anime and determine its next episode
    currentlyAiringShows.forEach(anime => {
      if (!anime || !(anime as any).episodes || (anime as any).episodes.length === 0) return;

      const episodes = (anime as any).episodes;

      // Use shared function to find the next episode
      const nextEpisodeResult = findNextEpisode(episodes, anime.broadcast, now);

      // If we found a next episode, add this anime to our list
      if (nextEpisodeResult) {
        const { episode: nextEpisode, airTime: nextEpisodeAirTime } = nextEpisodeResult;
        // Generate air time display info (using local timezone formatting)
        const airTimeInfo = getAirTimeDisplay(nextEpisode.airDate, anime.broadcast) || {
          show: true,
          text: nextEpisodeAirTime <= now
            ? "Recently aired"
            : `Airing ${format(nextEpisodeAirTime, "EEE")} at ${format(nextEpisodeAirTime, "h:mm a")}`,
          variant: nextEpisodeAirTime <= now ? 'aired' as const : 'scheduled' as const
        };

        const processedEntry = {
          id: `homepage-${anime.id}`,
          anime: {
            id: anime.id,
            titleEn: anime.titleEn,
            titleJp: anime.titleJp,
            description: null,
            episodeCount: null,
            duration: anime.duration,
            startDate: anime.startDate,
            imageUrl: anime.imageUrl,
            userAnime: anime.userAnime || null
          },
          status: null,
          airingInfo: {
            ...anime,
            airTimeDisplay: airTimeInfo,
            nextEpisodeDate: nextEpisodeAirTime,
            nextEpisode: {
              ...nextEpisode,
              airDate: nextEpisodeAirTime
            },
            isInWatchlist: false
          }
        };

        processedAnime.push(processedEntry);
      }
    });

    // Filter and sort anime: only recently aired (last 30 minutes) or future episodes
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Separate recently aired and future episodes
    const recentlyAired = processedAnime
      .filter(anime => {
        const airTime = anime.airingInfo.nextEpisodeDate;
        return airTime <= now && airTime >= thirtyMinutesAgo;
      })
      .sort((a, b) => b.airingInfo.nextEpisodeDate.getTime() - a.airingInfo.nextEpisodeDate.getTime()) // Most recent first
      .slice(0, 2); // Limit to 2 recently aired shows

    const futureEpisodes = processedAnime
      .filter(anime => anime.airingInfo.nextEpisodeDate > now)
      .sort((a, b) => a.airingInfo.nextEpisodeDate.getTime() - b.airingInfo.nextEpisodeDate.getTime()); // Earliest first

    // Combine: recently aired first, then future episodes
    return [...recentlyAired, ...futureEpisodes];
  }, [currentAiringData]);

  // Determine which anime to show in banner (use sorted data - get the underlying airingInfo)
  const bannerAnime = hoveredAnime || (sortedCurrentlyAiring[0]?.airingInfo);

  const mutateAddAnime = useAddAnime();

  const addAnime = async (id: string, animeId: string) => {
    setAnimeStatuses((prev) => ({...prev, [id]: "loading"}));
    try {
      await mutateAddAnime.mutateAsync({
        input: {
          animeID: animeId,
          status: Status.Plantowatch,
        }
      });
      debug.anime("Added anime", id, animeId)
      setAnimeStatuses((prev) => ({...prev, [id]: "success"}));
    } catch {
      setAnimeStatuses((prev) => ({...prev, [id]: "error"}));
    }
  };

  const clearAnimeStatus = (animeId: string) => {
    // Clear status for all keys that contain this animeId
    setAnimeStatuses((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (key.includes(animeId)) {
          delete updated[key];
        }
      });
      return updated;
    });

    // Invalidate queries to refresh banner data when anime is deleted
    queryClient.invalidateQueries(["currentlyAiring"]);
    queryClient.invalidateQueries(["homedata"]);
    queryClient.invalidateQueries(["user-animes"]);
  };

  return (
    <div className={"flex flex-col space-y-6 max-w-screen-2xl"} style={{margin: "0 auto"}}>
      {/* Hero Banner */}
      <div className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] md:w-full md:left-auto md:right-auto md:ml-0 md:mr-0 h-[500px] md:h-[600px] mb-24 md:mb-8 -mt-[2rem] -mx-2 md:mt-0 md:mx-0 md:rounded-lg md:shadow-xl bg-gray-200 dark:bg-gray-800">
        {bannerAnime && !currentAiringIsLoading ? (
          <HeroBanner
            key={`hero-${bannerAnime.id}`}
            anime={bannerAnime}
            onAddAnime={(animeId) => addAnime(`hero-${animeId}`, animeId)}
            animeStatus={animeStatuses[`hero-${bannerAnime.id}`] ?? "idle"}
            onDeleteAnime={clearAnimeStatus}
          />
        ) : (
          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse" />
        )}
      </div>

      <div className={"w-full flex flex-col"}>
        <div className="flex items-center justify-between mb-4">
          <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Currently Airing Anime</h1>
          <Link to="/airing" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors duration-200">
            See all →
          </Link>
        </div>

        {currentAiringIsLoading ? (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {Array(8).fill({id: 1}).map((anime, index) => (
              <AnimeCardSkeleton key={`currently-airing-${index}`} style={AnimeCardStyle.DETAIL} />
            ))}
          </div>
        ) : (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center"
          >
            {sortedCurrentlyAiring?.slice(0, 8).map((entry => {
              const airingInfo = entry.airingInfo;
              const anime = entry.anime;
              const id = `currently-airing-${anime.id}`;

              // Get worker timing data
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
                      : timingData.countdown ? `Airing in ${timingData.countdown}` : timingData.airDateTime,
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
                <div
                  key={anime.id}
                  onMouseEnter={() => setHoveredAnime(airingInfo)}
                >
                  <AnimeCard style={AnimeCardStyle.EPISODE}
                             id={anime.id}
                             title={anime.titleEn || anime.titleJp || "Unknown"}
                             episodeTitle={episodeTitle}
                             description={""}
                             episodeLength={""}
                             episodeNumber={episodeNumber}
                             className={"hover:cursor-pointer"}
                             year={""}
                             image={GetImageFromAnime(airingInfo) || GetImageFromAnime(anime)}
                             airdate={airingInfo.nextEpisode?.airDate ? format(airingInfo.nextEpisode.airDate, "EEE MMM do") : "Unknown"}
                             // Add air time display - will override the default airdate display
                             airTime={airTimeDisplay}
                             onClick={function (): void {
                               navigate(`/show/${anime.id}`)
                             }} episodes={0}
                             entry={airingInfo.userAnime}
                             options={
                    !airingInfo.userAnime ?
                    [(
                               <Button
                                 color={ButtonColor.blue}
                                 label={'Add to list'}
                                 showLabel={true}
                                 status={animeStatuses[id] ?? "idle"}
                                 className="w-fit px-2 py-1 text-xs"
                                 onClick={() => {
                                   addAnime(id, anime.id)
                                 }}
                               />
                             )] : [<>
                        {/* @ts-ignore */}
                      <AnimeStatusDropdown entry={{...airingInfo.userAnime, anime: airingInfo}} key={`dropdown-${anime.id}`} variant="compact" onDelete={clearAnimeStatus} />
                      </>]}
                  />
                </div>
              )
            })) || (<></>)}
          </div>


        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>{seasonDisplayName} Anime</h1>
          
          {/* Desktop: Button layout */}
          <div className="hidden sm:flex gap-2">
            {seasonOptions.map((season) => (
              <button
                key={season}
                onClick={() => setSelectedSeason(season)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors duration-200 ${
                  selectedSeason === season
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {getSeasonDisplayName(season)}
              </button>
            ))}
          </div>

          {/* Mobile: Dropdown layout */}
          <div className="sm:hidden relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-gray-100 font-medium text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 text-sm"
            >
              <span className="truncate">{getSeasonDisplayName(selectedSeason)}</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`w-3 h-3 ml-2 flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsDropdownOpen(false)}
                />

                {/* Dropdown menu */}
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1">
                  {seasonOptions.map((season) => (
                    <button
                      key={season}
                      onClick={() => {
                        setSelectedSeason(season);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 ${
                        selectedSeason === season 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {getSeasonDisplayName(season)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        {seasonalDataIsLoading ? (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {Array(8).fill({id: 1}).map((anime, index) => (
              <AnimeCardSkeleton key={`seasonal-anime-${index}`} style={AnimeCardStyle.DETAIL} />
            ))}
          </div>
        ) : (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {seasonalData?.animeBySeasons?.sort((a, b) => {
              const getRating = (rating: string | null | undefined) => {
                if (!rating || rating === 'N/A') return 0;
                const parsed = parseFloat(rating);
                return isNaN(parsed) ? 0 : parsed;
              };
              const ratingA = getRating(a.rating);
              const ratingB = getRating(b.rating);
              return ratingB - ratingA;
            }).slice(0, 8).map(item => {
              const id = `${selectedSeason.toLowerCase()}-${item.id}`;
              return (
                <AnimeCard style={AnimeCardStyle.DETAIL}
                           id={item.id}
                           title={item.titleEn || "Unknown"}
                           description={""}
                           episodes={Math.max(item.episodeCount || 0, (item as any).episodes?.length || 0)}
                           episodeLength={item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?"}
                           year={item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?"}
                           className={"hover:cursor-pointer"}
                           image={GetImageFromAnime(item)}
                           onClick={function (): void {
                             navigate(`/show/${item.id}`)
                           }}
                           entry={item.userAnime}
                           options={
                             !item.userAnime ?
                               [(
                                 <Button
                                   color={ButtonColor.blue}
                                   label={'Add to list'}
                                   showLabel={true}
                                   status={animeStatuses[id] ?? "idle"}
                                   className="w-fit px-2 py-1 text-xs"
                                   onClick={() => {
                                     addAnime(id, item.id)
                                   }}
                                 />
                               )] : [<>
                                 {/* @ts-ignore */}
                                 <AnimeStatusDropdown entry={{...item.userAnime, anime: item}} key={`dropdown-${item.id}`} variant="compact" onDelete={clearAnimeStatus} />
                               </>]}
                />
              )
            }) || (<></>)}
          </div>


        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Top Rated Anime</h1>
        {homeDataIsLoading ? (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {Array(8).fill({id: 1}).map((anime, index) => (
              <AnimeCardSkeleton key={`top-rated-${index}`} style={AnimeCardStyle.DETAIL} />
            ))}
          </div>
        ) : (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {homeData?.topRatedAnime?.slice(0, 8).map(item => {
              const id = `top-rated-${item.id}`;
              return (
                <AnimeCard style={AnimeCardStyle.DETAIL}
                           id={item.id}
                           title={item.titleEn || "Unknown"}
                           description={""}
                           episodes={item.episodeCount ? item.episodeCount : 0}
                           episodeLength={item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?"}
                           year={item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?"}
                           image={GetImageFromAnime(item)}
                           className={"hover:cursor-pointer"}
                           onClick={function (): void {
                             navigate(`/show/${item.id}`)
                           }}
                           entry={item.userAnime}
                           options={[(
                             <Button
                               color={ButtonColor.blue}
                               label={'Add to list'}
                               showLabel={true}
                               status={animeStatuses[id] ?? "idle"}
                               className="w-fit px-2 py-1 text-xs"
                               onClick={() => {
                                 addAnime(id, item.id)
                               }}
                             />
                           )]}
                />
              )
            }) || (<></>)}
          </div>
        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Newest Anime</h1>
        { /* ignore movies */}
        {homeDataIsLoading ? (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {Array(8).fill({id: 1}).map((anime, index) => (
              <AnimeCardSkeleton key={`newest-anime-${index}`} style={AnimeCardStyle.DETAIL} />
            ))}
          </div>
        ) : (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {homeData?.newestAnime?.slice(0, 8).map(item => {
              const id = `newest-anime-${item.id}`;
              return (
                <AnimeCard style={AnimeCardStyle.DETAIL}
                           id={item.id}
                           title={item.titleEn || "Unknown"}
                           description={""}
                           episodes={item.episodeCount ? item.episodeCount : 0}
                           episodeLength={item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?"}
                           year={item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?"}
                           image={GetImageFromAnime(item)}
                           className={"hover:cursor-pointer"}
                           onClick={function (): void {
                             navigate(`/show/${item.id}`)
                           }}
                           entry={item.userAnime}
                           options={[(
                             <Button
                               color={ButtonColor.blue}
                               label={'Add to list'}
                               showLabel={true}
                               status={animeStatuses[id] ?? "idle"}
                               className="w-fit px-2 py-1 text-xs"
                               onClick={() => {
                                 addAnime(id, item.id)
                               }}
                             />
                           )]}
                />
              )
            }) || (<></>)}
          </div>

        )}
      </div>
    </div>
  );
}

export default Index;
