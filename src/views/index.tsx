import {useQuery} from "@tanstack/react-query";
import Loader from "../components/Loader";
import { CurrentlyAiringQuery, GetHomePageDataQuery} from "../gql/graphql";
import {format} from "date-fns";
import {fetchCurrentlyAiring, fetchHomePageData} from "../services/queries";
import {useState} from "react";
import AnimeCard, {AnimeCardSkeleton, AnimeCardStyle} from "../components/AnimeCard";
import {Link, useNavigate} from "react-router-dom";


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
            {currentAiringData?.currentlyAiring?.sort((a, b) => {
              // sort by rank
              if (a.nextEpisode?.airDate && b.nextEpisode?.airDate) {
                // convert airDate to date
                const aDate = new Date(a.nextEpisode?.airDate);
                const bDate = new Date(b.nextEpisode?.airDate);
                return aDate.getTime() - bDate.getTime();
              }
              return 0
            })?.slice(0, 8).map((item => (
              <AnimeCard style={AnimeCardStyle.EPISODE}
                         title={item.titleEn || item.titleJp || "Unknown"}
                         episodeTitle={item.nextEpisode?.titleEn || item.nextEpisode?.titleJp || "Unknown"}
                         description={""}
                         episodeLength={""}
                         episodeNumber={item.nextEpisode?.episodeNumber?.toString() || "Unknown"}
                         className={"hover:cursor-pointer"}
                         year={""}
                         image={`https://cdn.weeb.vip/weeb/${item.id}`}
                         airdate={item.nextEpisode?.airDate ? format(new Date(item.nextEpisode?.airDate?.toString()), "EEE MMM do") : "Unknown"}
                         onClick={function (): void {
                           navigate(`/show/${item.id}`)
                         }} episodes={0}/>
            ))) || (<></>)}
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
            {homeData?.mostPopularAnime?.slice(0, 8).map(item => (
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
              />
            )) || (<></>)}
          </div>


        )}
        {/*
            <Carousel data={homeData?.mostPopularAnime?.map(item => ({
            title: item.titleEn || "Unknown",
            description: "",
            episodes: item.episodeCount ? item.episodeCount : 0,
            episodeLength: item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?",
            year: item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?",
              image: `https://cdn.weeb.vip/weeb/${item.id}`,
            //image: `${(global as any).config.api_host}/show/anime/anidb/${item.episodeCount == 1 ? 'movie' : 'series'}/${item.anidbid?.replace(/[^0-9.]/gm, '')}/poster`,
            // navigate: item.anidbid ? `/show/${item.episodeCount == 1 ? 'movie' : 'series'}/${item.anidbid}` : `/show/${item.episodeCount == 1 ? 'movie' : 'series'}/${item.id ? encodeURIComponent(item.id) : ''}/custom`,
              navigate: `/show/${item.id}`,
          })) || []}
          />
          */}
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
            {homeData?.topRatedAnime?.slice(0, 8).map(item => (
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
                         }}/>
            )) || (<></>)}
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
            {homeData?.newestAnime?.slice(0, 8).map(item => (
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
                         }}/>
            )) || (<></>)}
          </div>

        )}
      </div>
    </div>
  );
}

export default Index;
