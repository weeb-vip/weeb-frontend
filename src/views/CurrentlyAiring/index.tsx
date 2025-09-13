import React, { useMemo, useState } from "react";
import { useCurrentlyAiringWithDates } from "../../hooks/useCurrentlyAiringWithDates";
import { useAddAnime } from "../../hooks/useAddAnime";
import {CurrentlyAiringQuery, CurrentlyAiringWithDateQuery, Status} from "../../gql/graphql";
import Loader from "../../components/Loader";
import AnimeCard, { AnimeCardStyle } from "../../components/AnimeCard";
import Button, { ButtonColor } from "../../components/Button";
import { StatusType } from "../../components/Button/Button";
import { format } from "date-fns";
import { utc } from "@date-fns/utc/utc";
import { useNavigate } from "react-router-dom";
import {GetImageFromAnime} from "../../services/utils";
import debug from "../../utils/debug";
import { getAirTimeDisplay, parseAirTime, findNextEpisode } from "../../services/airTimeUtils";
import { useAnimeCountdowns } from "../../hooks/useAnimeCountdowns";
import HeroBanner from "../../components/HeroBanner";
import {HeroBannerSkeleton} from "../../components/HeroBanner/HeroBanner";

type AiringList = NonNullable<CurrentlyAiringQuery['currentlyAiring']>;
type AiringItem = AiringList[number];

export default function CurrentlyAiringPage() {
  const { data, isLoading } = useCurrentlyAiringWithDates(
    new Date(Date.now() - 24 * 60 * 60 * 1000), // past day
    null, // no end date
    7 // next 7 days
  );
  const { getCountdown } = useAnimeCountdowns();
  const navigate = useNavigate();

  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});
  const mutateAddAnime = useAddAnime();

  const addAnime = async (id: string) => {
    setAnimeStatuses((prev) => ({ ...prev, [id]: "loading" }));
    try {
      await mutateAddAnime.mutateAsync({
        input: {
          animeID: id,
          status: Status.Plantowatch,
        },
      });
      setAnimeStatuses((prev) => ({ ...prev, [id]: "success" }));
    } catch {
      setAnimeStatuses((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  const { categorizedAnime, heroAnime } = useMemo(() => {
    if (!data?.currentlyAiring) return {
      categorizedAnime: {
        airingToday: [],
        airingThisWeek: [],
        comingSoon: [],
        recentlyAired: []
      },
      heroAnime: null
    };

    const now = new Date();
    const sorted = [...data.currentlyAiring].sort((a, b) => {
      // Use findNextEpisode to get proper episode timing
      const aNextEpisode = findNextEpisode(a.episodes, a.broadcast);
      const bNextEpisode = findNextEpisode(b.episodes, b.broadcast);

      // Handle cases where no next episode is found
      if (!aNextEpisode && !bNextEpisode) return 0;
      if (!aNextEpisode) return 1; // Put anime without episodes at end
      if (!bNextEpisode) return -1;

      return aNextEpisode.airTime.getTime() - bNextEpisode.airTime.getTime();
    });

    // Find best hero anime (airing soon with good info)
    const heroCandidate = sorted.find(anime => {
      const nextEpisode = findNextEpisode(anime.episodes, anime.broadcast);
      if (!nextEpisode) return false;
      const diffMs = nextEpisode.airTime.getTime() - now.getTime();
      return diffMs > 0 && diffMs <= (24 * 60 * 60 * 1000); // Airing within 24 hours
    }) || sorted[0];

    // Categorize anime
    const categories = {
      airingToday: [] as typeof sorted,
      airingThisWeek: [] as typeof sorted,
      comingSoon: [] as typeof sorted,
      recentlyAired: [] as typeof sorted
    };

    sorted.forEach(anime => {
      const nextEpisode = findNextEpisode(anime.episodes, anime.broadcast);
      if (!nextEpisode) {
        categories.comingSoon.push(anime);
        return;
      }

      const diffMs = nextEpisode.airTime.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffMs <= 0 && Math.abs(diffMs) <= (7 * 24 * 60 * 60 * 1000)) {
        categories.recentlyAired.push(anime);
      } else if (diffMs > 0 && diffMs <= (24 * 60 * 60 * 1000)) {
        categories.airingToday.push(anime);
      } else if (diffDays > 0 && diffDays <= 7) {
        categories.airingThisWeek.push(anime);
      } else {
        categories.comingSoon.push(anime);
      }
    });

    return { categorizedAnime: categories, heroAnime: heroCandidate };
  }, [data]);


  const clearAnimeStatus = (animeId: string) => {
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

  const renderAnimeSection = (title: string, animeList: ReadonlyArray<AiringItem>, showCount = true) => {
    if (!animeList || animeList.length === 0) return null;

    return (
      <div className="flex flex-col space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {title} {showCount && `(${animeList.length})`}
        </h2>
        <div className="flex flex-col space-y-4">
          {animeList.map((item) => {
            const nextEpisode = findNextEpisode(item.episodes, item.broadcast);
            const airTimeDisplay = nextEpisode ? getAirTimeDisplay(nextEpisode.episode.airDate, item.broadcast) : null;

            return (
              <AnimeCard
                forceListLayout
                key={item.id}
                id={item.id}
                style={AnimeCardStyle.EPISODE}
                title={item.titleEn || item.titleJp || "Unknown"}
                episodeTitle={nextEpisode?.episode.titleEn || nextEpisode?.episode.titleJp || "Unknown"}
                description=""
                episodeLength=""
                episodeNumber={nextEpisode?.episode.episodeNumber?.toString() || "Unknown"}
                className="hover:cursor-pointer"
                year=""
                image={GetImageFromAnime(item)}
                airdate={
                  nextEpisode?.episode.airDate
                    ? format(new Date(nextEpisode.episode.airDate), "EEE MMM do", { in: utc })
                    : "Unknown"
                }
                airTime={airTimeDisplay || undefined}
                onClick={() => navigate(`/show/${item.id}`)}
                episodes={0}
                options={[
                  <Button
                    key="add"
                    color={ButtonColor.blue}
                    label="Add to list"
                    showLabel
                    status={animeStatuses[item.id] || "idle"}
                    className="w-fit px-2 py-1 text-xs"
                    onClick={() => addAnime(item.id)}
                  />,
                ]}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-8 max-w-screen-2xl w-full mx-auto">
      {/* Hero Section */}
      {heroAnime ? (
        <div className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] md:w-full md:left-auto md:right-auto md:ml-0 md:mr-0 h-[600px] md:h-[600px] -mt-[2rem] -mx-2 md:mt-0 md:mx-0 md:rounded-lg md:shadow-xl bg-gray-200 dark:bg-gray-800">
          <HeroBanner
            key={`hero-${heroAnime.id}`}
            anime={heroAnime}
            onAddAnime={(animeId) => addAnime(animeId)}
            animeStatus={animeStatuses[heroAnime.id] ?? "idle"}
            onDeleteAnime={clearAnimeStatus}
          />
        </div>
      ) : (
        <HeroBannerSkeleton />
      )}

      {/* Header */}
      <div className="px-4">
        <div className="top-0 p-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-sm float-right">
          <Button
            color={ButtonColor.blue}
            label="View Calendar"
            showLabel
            status="idle"
            className="w-fit flex-shrink-0"
            onClick={() => navigate("/airing/calendar")}
          />
        </div>
      </div>

      <div className="px-4 space-y-8">
        {/* Category Sections */}
        {renderAnimeSection("Airing Next 24 Hours", categorizedAnime.airingToday)}
        {renderAnimeSection("Airing This Week", categorizedAnime.airingThisWeek)}
        {renderAnimeSection("Recently Aired", categorizedAnime.recentlyAired)}
        {renderAnimeSection("Coming Soon", categorizedAnime.comingSoon)}
      </div>
    </div>
  );
}
