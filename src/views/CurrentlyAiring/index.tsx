import React, { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchCurrentlyAiring, upsertAnime } from "../../services/queries";
import { CurrentlyAiringQuery, Status } from "../../gql/graphql";
import Loader from "../../components/Loader";
import AnimeCard, { AnimeCardStyle } from "../../components/AnimeCard";
import Button, { ButtonColor } from "../../components/Button";
import { StatusType } from "../../components/Button/Button";
import { format } from "date-fns";
import { utc } from "@date-fns/utc/utc";
import { useNavigate } from "react-router-dom";
import {GetImageFromAnime} from "../../services/utils";
import debug from "../../utils/debug";
import { getAirTimeDisplay, parseAirTime } from "../../services/airTimeUtils";

export default function CurrentlyAiringPage() {
  const { data, isLoading } = useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiring());
  const navigate = useNavigate();

  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});

  const mutateAddAnime = useMutation({
    ...upsertAnime(),
    onSuccess: (data) => {
      debug.anime("Added anime", data);
    },
    onError: (error) => {
      debug.error("Error adding anime", error);
    },
  });

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

  const sorted = useMemo(() => {
    if (!data?.currentlyAiring) return [];
    return [...data.currentlyAiring].sort((a, b) => {
      // Use parseAirTime to properly handle JST broadcast times
      const aAirTime = parseAirTime(a.nextEpisode?.airDate, a.broadcast);
      const bAirTime = parseAirTime(b.nextEpisode?.airDate, b.broadcast);
      
      // Handle cases where parsing fails or dates are missing
      if (!aAirTime && !bAirTime) return 0;
      if (!aAirTime) return 1; // Put anime without proper air time at end
      if (!bAirTime) return -1;
      
      return aAirTime.getTime() - bAirTime.getTime();
    });
  }, [data]);

  if (isLoading || !data) return <Loader />;

  return (
    <div className="flex flex-col space-y-6 max-w-screen-2xl w-full px-4 mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Currently Airing Anime</h1>
        <Button
          color={ButtonColor.blue}
          label="View Calendar"
          showLabel
          status="idle"
          className="w-fit"
          onClick={() => navigate("/airing/calendar")}
        />
      </div>
      <div className="flex flex-col space-y-4">
        {sorted.map((item) => {
          // Calculate air time display for each anime
          const airTimeDisplay = getAirTimeDisplay(item.nextEpisode?.airDate, item.broadcast);
          
          return (
            <AnimeCard
              forceListLayout
              key={item.id}
              id={item.id}
              style={AnimeCardStyle.EPISODE}
              title={item.titleEn || item.titleJp || "Unknown"}
              episodeTitle={item.nextEpisode?.titleEn || item.nextEpisode?.titleJp || "Unknown"}
              description=""
              episodeLength=""
              episodeNumber={item.nextEpisode?.episodeNumber?.toString() || "Unknown"}
              className="hover:cursor-pointer"
              year=""
              image={GetImageFromAnime(item)}
              airdate={
                item.nextEpisode?.airDate
                  ? format(new Date(item.nextEpisode.airDate), "EEE MMM do", { in: utc })
                  : "Unknown"
              }
              // Add air time display - will override the default airdate display
              airTime={airTimeDisplay}
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
}
