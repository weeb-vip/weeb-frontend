import {useMutation, useQuery} from "@tanstack/react-query";
import {fetchCurrentlyAiring, upsertAnime} from "../../services/queries";
import {CurrentlyAiringQuery, Status} from "../../gql/graphql";
import Loader from "../../components/Loader";
import AnimeCard, {AnimeCardStyle} from "../../components/AnimeCard";
import {format} from "date-fns";
import {useNavigate} from "react-router-dom";
import {utc} from "@date-fns/utc/utc";
import Button, {ButtonColor} from "../../components/Button";

export default function CurrentlyAiringPage() {
  const { data, isLoading } = useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiring());
  const navigate = useNavigate();

  if (isLoading || !data) return <Loader />;

  // @ts-ignore
  const sorted = [...data.currentlyAiring].sort((a, b) => {
    const aDate = new Date(a.nextEpisode?.airDate || "");
    const bDate = new Date(b.nextEpisode?.airDate || "");
    return aDate.getTime() - bDate.getTime();
  });
  const {
    mutate: mutateAddAnime
  } = useMutation({
    ...upsertAnime(),
    onSuccess: (data) => {
      console.log("Added anime", data)
    },
    onError: (error) => {
      console.log("Error adding anime", error)
    }
  })

  const addAnime = (id: string) => {
    mutateAddAnime({
      input: {
        animeID: id,
        status: Status.Plantowatch,
      }
    })
  }
  return (
    <div className="flex flex-col space-y-6 max-w-screen-2xl w-full px-4 mx-auto">

      <h1 className="text-2xl font-bold">All Currently Airing Anime</h1>
      <div className="flex flex-col space-y-4">
        {sorted.map((item) => (
          <AnimeCard
            forceListLayout={true}
            key={item.id}
            style={AnimeCardStyle.EPISODE}
            title={item.titleEn || item.titleJp || "Unknown"}
            episodeTitle={item.nextEpisode?.titleEn || item.nextEpisode?.titleJp || "Unknown"}
            description={""}
            episodeLength={""}
            episodeNumber={item.nextEpisode?.episodeNumber?.toString() || "Unknown"}
            className="hover:cursor-pointer"
            year={""}
            image={`https://cdn.weeb.vip/weeb/${item.id}`}
            airdate={
              item.nextEpisode?.airDate
                ? format(new Date(item.nextEpisode.airDate), "EEE MMM do", { in: utc})
                : "Unknown"
            }
            onClick={() => navigate(`/show/${item.id}`)}
            episodes={0}
            options={[(
              <Button
                color={ButtonColor.blue}
                label={'Add to list'}
                showLabel={true}
                className="w-fit"
                onClick={() => {
                  addAnime(item.id)
                }}
              />
            )]}
          />
        ))}
      </div>
    </div>
  );
}

