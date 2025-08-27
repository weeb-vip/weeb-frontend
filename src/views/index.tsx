import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import Loader from "../components/Loader";
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


function Index() {
  const queryClient = useQueryClient();
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

  // Parse broadcast time and create accurate air time (same logic as HeroBanner)
  const parseAirTime = (anime: any) => {
    if (!anime.nextEpisode?.airDate || !anime.broadcast) return null;

    const airDate = new Date(anime.nextEpisode.airDate);

    // Parse broadcast time (e.g., "Wednesdays at 01:29 (JST)")
    const timeMatch = anime.broadcast.match(/(\d{1,2}):(\d{2})/);
    const timezoneMatch = anime.broadcast.match(/\(([A-Z]{3,4})\)/);

    if (!timeMatch) return airDate;

    const [, hours, minutes] = timeMatch;
    const timezone = timezoneMatch ? timezoneMatch[1] : 'JST';

    // Create a new date with the broadcast time in JST, then convert to UTC
    const broadcastDate = new Date(airDate);
    
    if (timezone === 'JST') {
      // JST is UTC+9, so to convert JST time to UTC, we subtract 9 hours
      broadcastDate.setUTCHours(parseInt(hours) - 9, parseInt(minutes), 0, 0);
      
      // Handle negative hours (previous day)
      if (parseInt(hours) - 9 < 0) {
        broadcastDate.setUTCDate(broadcastDate.getUTCDate() - 1);
        broadcastDate.setUTCHours(parseInt(hours) - 9 + 24, parseInt(minutes), 0, 0);
      }
    } else {
      broadcastDate.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    return broadcastDate;
  };

  // Sort currently airing anime by next air time
  const sortedCurrentlyAiring = useMemo(() => {
    if (!currentAiringData?.currentlyAiring) return [];
    
    const now = new Date();
    return [...currentAiringData.currentlyAiring].sort((a, b) => {
      const aAirTime = parseAirTime(a);
      const bAirTime = parseAirTime(b);
      
      if (!aAirTime && !bAirTime) return 0;
      if (!aAirTime) return 1; // Put anime without air time at end
      if (!bAirTime) return -1;
      
      const aTimeDiff = aAirTime.getTime() - now.getTime();
      const bTimeDiff = bAirTime.getTime() - now.getTime();
      
      // If both are in the past, sort by most recent first (already aired shows at front)
      if (aTimeDiff <= 0 && bTimeDiff <= 0) {
        return bTimeDiff - aTimeDiff;
      }
      
      // If both are in the future, sort by closest first
      if (aTimeDiff > 0 && bTimeDiff > 0) {
        return aTimeDiff - bTimeDiff;
      }
      
      // Past episodes come before future episodes
      if (aTimeDiff <= 0) return -1;
      if (bTimeDiff <= 0) return 1;
      
      return 0;
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
  };

  return (
    <div className={"flex flex-col space-y-6 max-w-screen-2xl"} style={{margin: "0 auto"}}>
      {/* Hero Banner */}
      <div className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] md:w-full md:left-auto md:right-auto md:ml-0 md:mr-0 h-[500px] md:h-[600px]  mb-8 -mt-[2rem] -mx-2 md:mt-0 md:mx-0 md:rounded-lg md:shadow-xl bg-gray-200 dark:bg-gray-800">
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
        { /* ignore movies */}
        {/*<div className="flex gap-2 py-4">*/}
        {/*  {["Airing", "Season", "Newest"].map(label => (*/}
        {/*    <button*/}
        {/*      key={label}*/}
        {/*      className={`px-4 py-2 rounded-full ${*/}
        {/*        selectedFilter === label ? "bg-blue-600 text-white" : "bg-gray-200"*/}
        {/*      }`}*/}
        {/*      onClick={() => setSelectedFilter(label)}*/}
        {/*    >*/}
        {/*      {label}*/}
        {/*    </button>*/}
        {/*  ))}*/}
        {/*</div>*/}
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
