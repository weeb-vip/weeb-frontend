import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {CurrentlyAiringQuery, GetHomePageDataQuery, Status} from "../gql/graphql";
import {format} from "date-fns";
import {fetchCurrentlyAiring, fetchHomePageData, upsertAnime} from "../services/queries";
import {useState, useMemo} from "react";
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
import {parseAirTime, getAirTimeDisplay, parseDurationToMinutes, isCurrentlyAiring} from "../services/airTimeUtils";
import {useAnimeCountdowns} from "../hooks/useAnimeCountdowns";


function Index() {
  const queryClient = useQueryClient();
  const { getCountdown } = useAnimeCountdowns();
  const {
    data: homeData,
    isLoading: homeDataIsLoading,
  } = useQuery<GetHomePageDataQuery>(fetchHomePageData())
  const {
    data: currentAiringData,
    isLoading: currentAiringIsLoading,
  } = useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiring())
  const navigate = useNavigate()

  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});
  const [hoveredAnime, setHoveredAnime] = useState<any>(null);


  // Sort currently airing anime by next air time
  const sortedCurrentlyAiring = useMemo(() => {
    if (!currentAiringData?.currentlyAiring) return [];

    const now = new Date();
    const allAnime = [...currentAiringData.currentlyAiring];

    // Filter to show future episodes and currently airing shows
    const filteredAnime = allAnime.filter((anime) => {
      const airTime = parseAirTime(anime.nextEpisode?.airDate, anime.broadcast);
      if (!airTime) return true; // Keep anime without proper air time

      const timeDiff = airTime.getTime() - now.getTime();

      // Show if it's a future episode
      if (timeDiff > 0) return true;

      // Check if currently airing using episode duration
      const durationMinutes = parseDurationToMinutes(anime.duration);
      return isCurrentlyAiring(anime.nextEpisode?.airDate, anime.broadcast, durationMinutes);
    });

    return filteredAnime.sort((a, b) => {
      const aAirTime = parseAirTime(a.nextEpisode?.airDate, a.broadcast);
      const bAirTime = parseAirTime(b.nextEpisode?.airDate, b.broadcast);

      if (!aAirTime && !bAirTime) return 0;
      if (!aAirTime) return 1; // Put anime without air time at end
      if (!bAirTime) return -1;

      const aTimeDiff = aAirTime.getTime() - now.getTime();
      const bTimeDiff = bAirTime.getTime() - now.getTime();

      // Currently airing shows come first, then future episodes by closest first
      const aIsCurrentlyAiring = aTimeDiff <= 0 && isCurrentlyAiring(a.nextEpisode?.airDate, a.broadcast, parseDurationToMinutes(a.duration));
      const bIsCurrentlyAiring = bTimeDiff <= 0 && isCurrentlyAiring(b.nextEpisode?.airDate, b.broadcast, parseDurationToMinutes(b.duration));

      // Currently airing shows first
      if (aIsCurrentlyAiring && !bIsCurrentlyAiring) return -1;
      if (!aIsCurrentlyAiring && bIsCurrentlyAiring) return 1;

      // If both are currently airing or both are future, sort by closest first
      return aTimeDiff - bTimeDiff;
    });
  }, [currentAiringData]);

  // Determine which anime to show in banner (use sorted data)
  const bannerAnime = hoveredAnime || sortedCurrentlyAiring[0];

  const mutateAddAnime = useMutation({
    ...upsertAnime(),
    onSuccess: async (data) => {
      debug.anime("Added anime", data)
      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries(["homedata"]);
      await queryClient.invalidateQueries(["currently-airing"]);
      await queryClient.invalidateQueries(["user-animes"]);
    },
    onError: (error) => {
      debug.error("Error adding anime", error)
    }
  })

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
    queryClient.invalidateQueries(["currently-airing"]);
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
              <AnimeCardSkeleton key={`currently-airing-${index}`}  {...anime} />
            ))}
          </div>
        ) : (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center"
          >
            {sortedCurrentlyAiring?.slice(0, 8).map((item => {
              const id = `currently-airing-${item.id}`;
              // Calculate air time display for each anime
              const airTimeDisplay = getAirTimeDisplay(item.nextEpisode?.airDate, item.broadcast) || undefined;

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredAnime(item)}
                >
                  <AnimeCard style={AnimeCardStyle.EPISODE}
                             id={item.id}
                             title={item.titleEn || item.titleJp || "Unknown"}
                             episodeTitle={item.nextEpisode?.titleEn || item.nextEpisode?.titleJp || "Unknown"}
                             description={""}
                             episodeLength={""}
                             episodeNumber={item.nextEpisode?.episodeNumber?.toString() || "Unknown"}
                             className={"hover:cursor-pointer"}
                             year={""}
                             image={GetImageFromAnime(item)}
                             airdate={item.nextEpisode?.airDate ? format(new Date(item.nextEpisode?.airDate?.toString()), "EEE MMM do") : "Unknown"}
                             // Add air time display - will override the default airdate display
                             airTime={airTimeDisplay}
                             onClick={function (): void {
                               navigate(`/show/${item.id}`)
                             }} episodes={0}
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
                </div>
              )
            })) || (<></>)}
          </div>


        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold text-gray-900 dark:text-gray-100"}>Most Popular Anime</h1>
        {homeDataIsLoading ? (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {Array(8).fill({id: 1}).map((anime, index) => (
              <AnimeCardSkeleton key={`currently-airing-${index}`}  {...anime} />
            ))}
          </div>
        ) : (
          <div
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {homeData?.mostPopularAnime?.slice(0, 8).map(item => {
              const id = `most-popular-${item.id}`;
              return (
                <AnimeCard style={AnimeCardStyle.DETAIL}
                           id={item.id}
                           title={item.titleEn || "Unknown"}
                           description={""}
                           episodes={item.episodeCount ? item.episodeCount : 0}
                           episodeLength={item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?"}
                           year={item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?"}
                           className={"hover:cursor-pointer"}
                           image={GetImageFromAnime(item)}
                           onClick={function (): void {
                             navigate(`/show/${item.id}`)
                           }}
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
              <AnimeCardSkeleton key={`currently-airing-${index}`}  {...anime} />
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
              <AnimeCardSkeleton key={`currently-airing-${index}`}  {...anime} />
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
