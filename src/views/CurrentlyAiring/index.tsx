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

export default function CurrentlyAiringPage() {
  const { data, isLoading } = useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiring());
  const navigate = useNavigate();

  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});

  const mutateAddAnime = useMutation({
    ...upsertAnime(),
    onSuccess: (data) => {
      console.log("Added anime", data);
    },
    onError: (error) => {
      console.log("Error adding anime", error);
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
      const aDate = new Date(a.nextEpisode?.airDate || "");
      const bDate = new Date(b.nextEpisode?.airDate || "");
      return aDate.getTime() - bDate.getTime();
    });
  }, [data]);

  if (isLoading || !data) return <Loader />;

  return (
    <div className="flex flex-col space-y-6 max-w-screen-2xl w-full px-4 mx-auto">
      <h1 className="text-2xl font-bold">All Currently Airing Anime</h1>
      <div className="flex flex-col space-y-4">
        {sorted.map((item) => (
          <AnimeCard
            forceListLayout
            key={item.id}
            style={AnimeCardStyle.EPISODE}
            title={item.titleEn || item.titleJp || "Unknown"}
            episodeTitle={item.nextEpisode?.titleEn || item.nextEpisode?.titleJp || "Unknown"}
            description=""
            episodeLength=""
            episodeNumber={item.nextEpisode?.episodeNumber?.toString() || "Unknown"}
            className="hover:cursor-pointer"
            year=""
            image={`https://cdn.weeb.vip/weeb/${item.id}`}
            airdate={
              item.nextEpisode?.airDate
                ? format(new Date(item.nextEpisode.airDate), "EEE MMM do", { in: utc })
                : "Unknown"
            }
            onClick={() => navigate(`/show/${item.id}`)}
            episodes={0}
            options={[
              <Button
                key="add"
                color={ButtonColor.blue}
                label="Add to list"
                showLabel
                status={animeStatuses[item.id] || "idle"}
                className="w-fit"
                onClick={() => addAnime(item.id)}
              />,
            ]}
          />
        ))}
      </div>
    </div>
  );
}
