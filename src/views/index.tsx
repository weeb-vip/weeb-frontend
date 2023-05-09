import {useQuery} from "@tanstack/react-query";
import Loader from "../components/Loader";

import {graphql} from '../gql'
import request from "graphql-request";
import {GetHomePageDataQuery} from "../gql/graphql";
import {format} from "date-fns";
import Carousel from "./components/carousel/carousel";

const getHomePageData = graphql(/* GraphQL */`
    query getHomePageData($limit: Int) {
        topRatedAnime(limit: $limit) {
            anidbid
            titleEn
            imageUrl
            duration
            tags
            episodes
            animeStatus
            imageUrl
            rating
            startDate
        }
        mostPopularAnime(limit: $limit) {
            anidbid
            titleEn
            imageUrl
            duration
            tags
            episodes
            animeStatus
            imageUrl
            rating
            startDate
        }
        newestAnime(limit:100) {
            anidbid
            titleEn
            imageUrl
            duration
            tags
            episodes
            animeStatus
            imageUrl
            rating
            startDate
        }
    }
`)


function Index() {
  const {
    data: homeData,
    isLoading: homeDataIsLoading,
  } = useQuery<GetHomePageDataQuery>({
      queryKey: ['homedata', {limit: 20}],
      queryFn: async () =>
        // @ts-ignore
        request<GetHomePageDataQuery>(global.config.graphql_host, getHomePageData, {
          limit: 20 // variables are typed too!
        }),
    }
  )

  return (
    <div className={"flex flex-col w-full"}>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Newest Anime</h1>
        { /* ignore movies */}
        {homeDataIsLoading && !homeData ? <Loader/> : (
          <Carousel data={homeData?.newestAnime?.filter(item => item.episodes && item.episodes > 3)?.map(item => ({
            title: item.titleEn || "Unknown",
            description: "",
            episodes: item.episodes ? item.episodes : 0,
            episodeLength: item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?",
            year: item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?",
            image: `${(global as any).config.api_host}/show/anime/anidb/${item.episodes == 1 ? 'movie' : 'series'}/${item.anidbid?.replace(/[^0-9.]/gm, '')}/poster`,
            navigate: `/show/${item.episodes == 1 ? 'movie' : 'series'}/${item.anidbid}`,
          })) || []}
          />

        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Most Popular Anime</h1>
        {homeDataIsLoading && !homeData ? <Loader/> : (
          <Carousel data={homeData?.mostPopularAnime?.map(item => ({
            title: item.titleEn || "Unknown",
            description: "",
            episodes: item.episodes ? item.episodes : 0,
            episodeLength: item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?",
            year: item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?",
            image: `${(global as any).config.api_host}/show/anime/anidb/${item.episodes == 1 ? 'movie' : 'series'}/${item.anidbid?.replace(/[^0-9.]/gm, '')}/poster`,
            navigate: `/show/${item.episodes == 1 ? 'movie' : 'series'}/${item.anidbid}`,
          })) || []}
          />

        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Top Rated Anime</h1>
        {homeDataIsLoading && !homeData ? <Loader/> : (
          <Carousel data={homeData?.topRatedAnime?.map(item => ({
            title: item.titleEn || "Unknown",
            description: "",
            episodes: item.episodes ? item.episodes : 0,
            episodeLength: item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?",
            year: item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?",
            image: `${(global as any).config.api_host}/show/anime/anidb/${item.episodes == 1 ? 'movie' : 'series'}/${item.anidbid?.replace(/[^0-9.]/gm, '')}/poster`,
            navigate: `/show/${item.episodes == 1 ? 'movie' : 'series'}/${item.anidbid}`,
          })) || []}
          />

        )}
      </div>
    </div>
  );
}

export default Index;