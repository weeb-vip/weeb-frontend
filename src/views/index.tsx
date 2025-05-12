import {useMutation, useQuery} from "@tanstack/react-query";
import Loader from "../components/Loader";
import {CurrentlyAiringQuery, GetHomePageDataQuery, Status} from "../gql/graphql";
import {format} from "date-fns";
import {fetchCurrentlyAiring, fetchHomePageData, upsertAnime} from "../services/queries";
import {useState} from "react";
import AnimeCard, {AnimeCardSkeleton, AnimeCardStyle} from "../components/AnimeCard";
import {Link, useNavigate} from "react-router-dom";
import {utc} from "@date-fns/utc/utc";
import Button, {ButtonColor} from "../components/Button";
import {mutate} from "swr";
import {StatusType} from "../components/Button/Button";


function Index() {
  const {
    data: homeData,
    isLoading: homeDataIsLoading,
  } = useQuery<GetHomePageDataQuery>(fetchHomePageData())
  const {
    data: currentAiringData,
    isLoading: currentAiringIsLoading,
  } = useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiring())
  const navigate = useNavigate()

  const [selectedFilter, setSelectedFilter] = useState("Airing");
  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});

  const mutateAddAnime = useMutation({
    ...upsertAnime(),
    onSuccess: (data) => {
      console.log("Added anime", data)
    },
    onError: (error) => {
      console.log("Error adding anime", error)
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
      console.log("Added anime", id, animeId)
      setAnimeStatuses((prev) => ({...prev, [id]: "success"}));
    } catch {
      setAnimeStatuses((prev) => ({...prev, [id]: "error"}));
    }
  };

  return (
    <div className={"flex flex-col  space-y-5 max-w-screen-2xl"} style={{margin: "0 auto"}}>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold"}>Currently Airing Anime</h1>
        { /* ignore movies */}
        <div className="flex gap-2 py-4">
          {["Airing", "Season", "Newest"].map(label => (
            <button
              key={label}
              className={`px-4 py-2 rounded-full ${
                selectedFilter === label ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
              onClick={() => setSelectedFilter(label)}
            >
              {label}
            </button>
          ))}
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
            className="w-full lg:w-fit grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 py-4 justify-center">
            {currentAiringData?.currentlyAiring?.slice(0, 8).map((item => {
              const id = `currently-airing-${item.id}`;
              return (
                <AnimeCard style={AnimeCardStyle.EPISODE}
                           title={item.titleEn || item.titleJp || "Unknown"}
                           episodeTitle={item.nextEpisode?.titleEn || item.nextEpisode?.titleJp || "Unknown"}
                           description={""}
                           episodeLength={""}
                           episodeNumber={item.nextEpisode?.episodeNumber?.toString() || "Unknown"}
                           className={"hover:cursor-pointer"}
                           year={""}
                           image={`https://cdn.weeb.vip/weeb/${item.id}`}
                           airdate={item.nextEpisode?.airDate ? format(new Date(item.nextEpisode?.airDate?.toString()), "EEE MMM do", {in: utc}) : "Unknown"}
                           onClick={function (): void {
                             navigate(`/show/${item.id}`)
                           }} episodes={0}
                           options={[(
                             <Button
                               color={ButtonColor.blue}
                               label={'Add to list'}
                               showLabel={true}
                               status={animeStatuses[id] ?? "idle"}
                               className="w-fit"
                               onClick={() => {
                                 addAnime(id, item.id)
                               }}
                             />
                           )]}
                />
              )
            })) || (<></>)}
          </div>


        )}
        <div className="w-full flex justify-end pt-2">
          <Link to="/airing" className="text-blue-600 hover:underline">
            See all currently airing anime
          </Link>
        </div>
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-2xl font-bold"}>Most Popular Anime</h1>
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
                           title={item.titleEn || "Unknown"}
                           description={""}
                           episodes={item.episodeCount ? item.episodeCount : 0}
                           episodeLength={item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?"}
                           year={item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?"}
                           className={"hover:cursor-pointer"}
                           image={`https://cdn.weeb.vip/weeb/${item.id}`}
                           onClick={function (): void {
                             navigate(`/show/${item.id}`)
                           }}
                           options={[(
                             <Button
                               color={ButtonColor.blue}
                               label={'Add to list'}
                               showLabel={true}
                               status={animeStatuses[id] ?? "idle"}
                               className="w-fit"
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
        <h1 className={"text-2xl font-bold"}>Top Rated Anime</h1>
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
                           title={item.titleEn || "Unknown"}
                           description={""}
                           episodes={item.episodeCount ? item.episodeCount : 0}
                           episodeLength={item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?"}
                           year={item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?"}
                           image={`https://cdn.weeb.vip/weeb/${item.id}`}
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
                               className="w-fit"
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
        <h1 className={"text-2xl font-bold"}>Newest Anime</h1>
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
                           title={item.titleEn || "Unknown"}
                           description={""}
                           episodes={item.episodeCount ? item.episodeCount : 0}
                           episodeLength={item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?"}
                           year={item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?"}
                           image={`https://cdn.weeb.vip/weeb/${item.id}`}
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
                               className="w-fit"
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
