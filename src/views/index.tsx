import {useQuery} from "@tanstack/react-query";
import Loader from "../components/Loader";

import {graphql} from '../gql'
import request from "graphql-request";
import {GetHomePageDataQuery} from "../gql/graphql";
import {format} from "date-fns";
import Carousel from "./components/carousel/carousel";
import config, {getConfig} from "../config";
import {getHomePageData} from "../services/api/graphql/queries";
import {fetchHomePageData} from "../services/queries";



function Index() {
  const {
    data: homeData,
    isLoading: homeDataIsLoading,
  } = useQuery<GetHomePageDataQuery>(fetchHomePageData())


  return (
    <div className={"flex flex-col w-full"}>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Most Popular New Anime</h1>
        { /* ignore movies */}
        {homeDataIsLoading && !homeData ? <Loader/> : (
          <Carousel data={homeData?.newestAnime?.filter((item) => item.episodeCount && item.anidbid ).sort((a, b) => {
            // sort by rank
            if (a.ranking && b.ranking) {
              return a.ranking - b.ranking
            }
            return 0
          })?.map(item => ({
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

        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Most Popular Anime</h1>
        {homeDataIsLoading && !homeData ? <Loader/> : (
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

        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Top Rated Anime</h1>
        {homeDataIsLoading && !homeData ? <Loader/> : (
          <Carousel data={homeData?.topRatedAnime?.map(item => ({
            title: item.titleEn || "Unknown",
            description: "",
            episodes: item.episodeCount ? item.episodeCount : 0,
            episodeLength: item.duration ? item.duration?.replace(/per.+?$|per/gm, '') : "?",
            year: item.startDate ? format(new Date(item.startDate?.toString()), "yyyy") : "?",
              image: `https://cdn.weeb.vip/weeb/${item.id}`,
            //image: `${(global as any).config.api_host}/show/anime/anidb/${item.episodeCount == 1 ? 'movie' : 'series'}/${item.anidbid?.replace(/[^0-9.]/gm, '')}/poster`,
            //navigate: item.anidbid ? `/show/${item.episodeCount == 1 ? 'movie' : 'series'}/${item.anidbid}` : `/show/${item.episodeCount == 1 ? 'movie' : 'series'}/${item.id ? encodeURIComponent(item.id) : ''}/custom`,
              navigate: `/show/${item.id}`,
          })) || []}
          />
        )}
      </div>
      <div className={"w-full flex flex-col"}>
        <h1 className={"text-4xl font-bold"}>Newest Anime</h1>
        { /* ignore movies */}
        {homeDataIsLoading && !homeData ? <Loader/> : (
          <Carousel data={homeData?.newestAnime?.filter(item => item.episodeCount)?.map(item => ({
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

        )}
      </div>
    </div>
  );
}

export default Index;
