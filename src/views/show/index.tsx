import {useNavigate, useParams} from "react-router-dom";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {fetchDetails, upsertAnime} from "../../services/queries";
import Loader from "../../components/Loader";
import {format} from "date-fns";
import Tabs from "../../components/Tabs";
import {useEffect, useState} from "react";
import Button, {ButtonColor} from "../../components/Button";
import {StatusType} from "../../components/Button/Button";
import {GetAnimeDetailsByIdQuery, Status} from "../../gql/graphql";
import {GetImageFromAnime} from "../../services/utils";
import {SafeImage} from "../../components/SafeImage/SafeImage";
import Tag from "./components/tag";
import Tables from "./components/Episodes";
import CharactersWithStaff from "./components/Characters";
import {AnimeStatusDropdown} from "../../components/AnimeStatusDropdown/AnimeStatusDropdown";
import {utc} from "@date-fns/utc/utc";

const renderField = (label: string, value: string | string[] | null | undefined) => {
  if (!value) return null;
  // if its an array, join it, show like a list
  if (Array.isArray(value)) {
    return (
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</h3>
        <ul className="list-disc pl-5">
          {value.map((item, idx) => (
            <li key={idx} className="text-gray-700 dark:text-gray-300">{item}</li>
          ))}
        </ul>
      </div>
    );
  } else {
    return (
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</h3>
        <p className="text-gray-700 dark:text-gray-300">{value}</p>
      </div>
    );
  }
};


export default function Index() {
  const queryClient = useQueryClient();
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);


  const {id} = useParams();
  const navigate = useNavigate();
  const {data: show, isLoading} = useQuery<GetAnimeDetailsByIdQuery>({
    ...fetchDetails(id || ""),
    enabled: !!id,
  });
  useEffect(() => {


    const url = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${show?.anime.anidbid}/fanart`;
    setBgLoaded(false); // reset until it loads
    setBgUrl(url);

  }, [show?.anime?.anidbid]);

  useEffect(() => {
    if (!show && !isLoading) navigate("/404", {replace: true});
  }, [show, isLoading, navigate]);

  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});
  const mutateAddAnime = useMutation({
    ...upsertAnime(),
    onSuccess: () => {
      queryClient.invalidateQueries(["homedata"]);
      queryClient.invalidateQueries(["currently-airing"]);
      queryClient.invalidateQueries(["anime-details", id || ""]);
    },
    onError: () => {
    },
  });

  const addAnime = async (animeId: string) => {
    setAnimeStatuses((prev) => ({...prev, [animeId]: "loading"}));
    try {
      await mutateAddAnime.mutateAsync({
        input: {animeID: animeId, status: Status.Plantowatch},
      });
      setAnimeStatuses((prev) => ({...prev, [animeId]: "success"}));
    } catch {
      setAnimeStatuses((prev) => ({...prev, [animeId]: "error"}));
    }

  };

  if (isLoading || !show) return <Loader/>;

  const anime = show.anime;

  const nextEpisode = anime?.episodes?.find((ep) => {
    if (!ep.airDate) return false;
    const airDate = new Date(ep.airDate);
    return airDate > new Date();
  });


  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 relative transition-colors duration-300">
      <div
        className="relative bg-cover bg-center bg-white dark:bg-gray-900 h-[420px] transition-all duration-300"
        style={{
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,

        }}
      >
        <div className={`absolute block inset-0 bg-white dark:bg-gray-900 w-full h-full transition-colors duration-300`}/>

        {bgUrl && (
          <img
            src={bgUrl}
            alt="bg preload"
            style={{opacity: bgLoaded ? 1 : 0,}}
            className="absolute inset-0 w-full h-full object-cover bg-white dark:bg-gray-900 transition-all duration-300"
            onLoad={() => setBgLoaded(true)}
            onError={() => {
              setBgUrl("/assets/not found.jpg");
              setBgLoaded(true);
            }}
          />
        )}


      </div>

      <div className="bg-gray-100 dark:bg-gray-900 -mt-[350px] lg:-mt-[200px] transition-colors duration-300">
        <div className="relative z-10 flex justify-center pt-6">
          <div
            className="flex flex-col lg:flex-row items-start max-w-screen-2xl w-full mx-4 lg:mx-auto p-6 text-white backdrop-blur-lg bg-black/50 rounded-md shadow-md">
            <SafeImage
              src={GetImageFromAnime(anime)}
              alt={anime?.titleEn || ""}
              className="h-48 w-32 lg:h-64 lg:w-48 object-cover rounded-md"
              onError={({currentTarget}) => {
                currentTarget.onerror = null;
                currentTarget.src = "/assets/not found.jpg";
              }}
            />
            <div className="lg:ml-10 mt-4 lg:mt-0 space-y-4 w-full">
              <h1 className="text-3xl font-bold">{anime?.titleEn}</h1>
              <p className="text-sm leading-relaxed text-neutral-200">{anime?.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-neutral-300">
                <span>{anime?.startDate ? format(anime.startDate, "yyyy") : ""}</span>
                <span>{anime?.broadcast || "unknown"}</span>
                <span>{anime?.endDate ? "Finished" : "Ongoing"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {anime?.tags?.map((tag, idx) => (
                  <Tag key={idx} tag={tag}/>
                ))}
              </div>
              <div data-type="options" className={"flex flex-wrap gap-2 mt-4"}>
              {!anime.userAnime ? (
                <Button
                  color={ButtonColor.blue}
                  label={"Add to list"}
                  status={animeStatuses[anime.id] ?? "idle"}
                  onClick={() => addAnime(anime.id)}
                />
              ) : (
                <>
                  {/* @ts-ignore */}
                  <AnimeStatusDropdown entry={{...anime.userAnime, anime: anime}}/>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-8 lg:px-16 transition-colors duration-300">
          <div className="max-w-screen-2xl mx-auto flex flex-col gap-8">
            {nextEpisode && (
              <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded shadow text-sm transition-colors duration-300">
                <h3 className="font-semibold mb-1 text-gray-800 dark:text-gray-200">Next Episode</h3>
                <p className="text-gray-900 dark:text-gray-100"><strong>Episode {nextEpisode.episodeNumber}:</strong> {nextEpisode.titleEn || "TBA"}</p>
                <p className="text-gray-600 dark:text-gray-400">Airing on {format(new Date(nextEpisode.airDate), "dd MMM yyyy", { in: utc })}</p>
              </div>
            )}
            <div className=" flex flex-col lg:flex-row gap-8">
              {/* Details Panel */}
              <div className="bg-white dark:bg-gray-800 p-4 rounded-md shadow-md text-sm text-gray-800 dark:text-gray-200 space-y-6 w-full lg:max-w-xs transition-colors duration-300">
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Titles</h2>
                  {renderField("Japanese", anime?.titleJp)}
                  {renderField("Romaji", anime?.titleRomaji)}
                  {renderField("Kanji", anime?.titleKanji)}
                  {(anime?.titleSynonyms ? anime.titleSynonyms : []).length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Synonyms</h3>
                      <p className="text-gray-700 dark:text-gray-300">{(anime?.titleSynonyms || []).join(", ")}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Production</h2>
                  {renderField("Studios", anime?.studios)}
                  {renderField("Source", anime?.source)}
                  {renderField("Licensors", anime?.licensors)}
                </div>
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Other Info</h2>
                  {renderField("Rating", anime?.rating)}
                  {renderField("Ranking", anime?.ranking?.toString())}
                </div>
                {/* show aired dates, startDate, endDate */}
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Aired</h2>
                  {renderField("Start Date", anime?.startDate ? format(anime.startDate, "dd MMM yyyy") : "Unknown")}
                  {renderField("End Date", anime?.endDate ? format(anime.endDate, "dd MMM yyyy") : "Ongoing")}
                </div>
              </div>

              {/* Tabs Section */}
              <div className=" w-full">
                <Tabs tabs={["Episodes", "Characters", "Trailers", "Artworks"]} defaultTab="Episodes">
                  <div>

                    {anime?.episodes && <Tables episodes={anime.episodes}/>}
                  </div>
                  <div>
                    <CharactersWithStaff animeId={anime.id}/>
                  </div>
                  <div></div>
                  <div></div>
                </Tabs>
              </div>
            </div>
            {/* make a small footer with the last updated date, make it right aligned*/}
            <div className="flex justify-end mt-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last updated: {anime?.updatedAt ? format(new Date(anime.updatedAt), "dd MMM yyyy") : "Unknown"}
              </p>
            </div>
          </div>


        </div>


      </div>
    </div>
  );
}
