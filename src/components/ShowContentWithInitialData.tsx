import React, { useEffect, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "../utils/navigation";
import { format } from "date-fns";
import Tabs from "./Tabs";
import Button, { ButtonColor } from "./Button";
import { type StatusType } from "./Button/Button";
import { Status } from "../gql/graphql";
import { GetImageFromAnime } from "../services/utils";
import { SafeImage } from "./SafeImage/SafeImage";
import Tag from "../views/show/components/tag";
import Tables from "../views/show/components/Episodes";
import CharactersWithStaff from "../views/show/components/Characters";
import { AnimeStatusDropdown } from "./AnimeStatusDropdown/AnimeStatusDropdown";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faCalendar, faClapperboard, faClock } from "@fortawesome/free-solid-svg-icons";
import { parseAirTime, getAirTimeDisplay, parseDurationToMinutes, isCurrentlyAiring, findNextEpisode, getCurrentTime } from "../services/airTimeUtils";
import { fetchDetails } from "../services/queries";
import { useAddAnime } from "../hooks/useAddAnime";
import debug from "../utils/debug";

const renderField = (label: string, value: string | string[] | null | undefined) => {
  if (!value) return null;
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

interface ShowContentProps {
  animeId: string;
  initialData?: any;
  onLoaded?: () => void;
}

export default function ShowContentWithInitialData({ animeId, initialData, onLoaded }: ShowContentProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [animeStatuses, setAnimeStatuses] = useState<Record<string, StatusType>>({});

  const navigate = useNavigate();
  const mutateAddAnime = useAddAnime();

  // Use React Query with initialData from server-side fetch
  const { data: show, isLoading, isError } = useQuery({
    ...fetchDetails(animeId),
    initialData: initialData,
    enabled: !!animeId,
    staleTime: initialData ? 60 * 1000 : 0, // If we have initial data, consider it fresh for 1 minute
  });

  debug.info(`ShowContentWithInitialData - ID: ${animeId}, loading: ${isLoading}, hasData: ${!!show}, hasInitialData: ${!!initialData}, error: ${isError}`);

  useEffect(() => {
    setUseFallback(false);
    setBgLoaded(false);

    if (show?.anime?.thetvdbid) {
      const fanartUrl = `https://weeb-api.staging.weeb.vip/show/anime/series/${show.anime.thetvdbid}/fanart`;
      setBgUrl(fanartUrl);
    } else if (show?.anime?.anidbid) {
      const fanartUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${show.anime.anidbid}/fanart`;
      setBgUrl(fanartUrl);
    } else {
      setBgUrl("/assets/not found.jpg");
      setBgLoaded(true);
    }
  }, [show?.anime?.anidbid]);

  useEffect(() => {
    // Only redirect to 404 if we have an error or if we're done loading and still have no data
    // Don't redirect if we have initial data (even if it's null/empty)
    const timer = setTimeout(() => {
      if (!initialData && (isError || (!show && !isLoading))) {
        debug.error('ShowContentWithInitialData - Redirecting to 404', { isError, hasShow: !!show, isLoading, hasInitialData: !!initialData });
        navigate("/404", { replace: true });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [show, isLoading, isError, navigate, initialData]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 400;
      setShowStickyHeader(window.scrollY > scrollThreshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Signal when content is loaded - call immediately if we have initial data
  useEffect(() => {
    if (show && !isLoading && onLoaded) {
      debug.info('ShowContentWithInitialData loaded, calling onLoaded callback');
      onLoaded();
    }
  }, [show, isLoading, onLoaded]);

  const addAnime = async (animeId: string) => {
    setAnimeStatuses((prev) => ({ ...prev, [animeId]: "loading" }));
    try {
      await mutateAddAnime.mutateAsync({
        input: { animeID: animeId, status: Status.Plantowatch },
      });
      setAnimeStatuses((prev) => ({ ...prev, [animeId]: "success" }));
    } catch {
      setAnimeStatuses((prev) => ({ ...prev, [animeId]: "error" }));
    }
  };

  // Return null while loading - don't render anything
  if (isLoading || !show) {
    debug.info('ShowContentWithInitialData still loading, returning null');
    return null;
  }

  const anime = show.anime;

  const now = getCurrentTime();
  const nextEpisodeResult = anime?.episodes && anime.broadcast
    ? findNextEpisode(anime.episodes, anime.broadcast, now)
    : null;
  const nextEpisode = nextEpisodeResult?.episode;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 relative transition-colors duration-300">
      {/* Sticky Header */}
      <div className={`fixed top-22 left-0 right-0 z-30 transition-all duration-300 ${
        showStickyHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}>
        <div className="relative overflow-hidden border-b border-gray-200 dark:border-gray-700 px-4 py-4 shadow-md">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
              filter: 'blur(8px)',
              transform: 'scale(1.1)',
            }}
          />
          <div className="absolute inset-0 bg-white/90 dark:bg-black/60 backdrop-blur-sm" />
          <div className="max-w-screen-2xl mx-auto relative z-10">
            <div className="flex items-center gap-4">
              <SafeImage
                src={GetImageFromAnime(anime)}
                alt={anime?.titleEn || ""}
                className="w-8 h-12 object-cover rounded flex-shrink-0"
                onError={({ currentTarget }) => {
                  currentTarget.onerror = null;
                  currentTarget.src = "/assets/not found.jpg";
                }}
              />
              <div className="min-w-0 flex-1 pr-16">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {anime?.titleEn}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-200 truncate">
                  {anime?.startDate ? format(anime.startDate, "yyyy") : ""} • {anime?.endDate ? "Finished" : "Ongoing"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-1/2 -translate-y-1/2 right-4 items-center z-20">
          {!anime.userAnime ? (
            <Button
              color={ButtonColor.blue}
              icon={<FontAwesomeIcon icon={faPlus} className="w-3 h-3" />}
              showLabel={false}
              status={animeStatuses[anime.id] ?? "idle"}
              onClick={() => addAnime(anime.id)}
              className="w-8 h-8 rounded-full flex items-center justify-center p-0"
            />
          ) : (
            <AnimeStatusDropdown
              entry={{
                id: anime.userAnime?.id || '',
                anime: anime as any,
                status: anime.userAnime?.status || undefined
              }}
              variant="icon-only"
            />
          )}
        </div>
      </div>

      <div
        className="relative bg-cover bg-center bg-white dark:bg-gray-900 h-[600px] transition-all duration-300 overflow-hidden"
        style={{
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
        }}
      >
        <div className={`absolute block inset-0 bg-white dark:bg-gray-900 w-full h-full transition-colors duration-300`} />

        {bgUrl && (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              opacity: bgLoaded ? 1 : 0,
              transition: 'opacity 300ms',
            }}
          >
            <img
              src={bgUrl}
              alt="bg preload"
              className={`absolute w-full h-full object-cover ${
                useFallback ? 'blur-md scale-110 -inset-4' : 'inset-0'
              } transition-all duration-300`}
              onLoad={() => setBgLoaded(true)}
              onError={() => {
                if (!useFallback && show?.anime?.anidbid) {
                  setUseFallback(true);
                  const posterUrl = `${global.config.cdn_url}/${encodeURIComponent(GetImageFromAnime(anime))}`;
                  setBgUrl(posterUrl);
                  setBgLoaded(true);
                } else {
                  setBgUrl("/assets/not found.jpg");
                  setBgLoaded(true);
                }
              }}
            />
          </div>
        )}
      </div>

      <div className="bg-gray-100 dark:bg-gray-900 -mt-[350px] lg:-mt-[200px] transition-colors duration-300">
        <div className="relative z-10 flex justify-center pt-20">
          <div className="flex flex-col lg:flex-row items-start max-w-screen-2xl w-full mx-4 lg:mx-auto p-6 text-white backdrop-blur-lg bg-black/50 rounded-md shadow-md">
            <SafeImage
              src={GetImageFromAnime(anime)}
              alt={anime?.titleEn || ""}
              className="h-48 w-32 lg:h-64 lg:w-48 object-cover rounded-md"
              onError={({ currentTarget }) => {
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
                  <Tag key={idx} tag={tag} />
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
                    <AnimeStatusDropdown entry={{ ...anime.userAnime, anime: anime }} variant="default" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-900 py-8 px-4 sm:px-8 lg:px-16 transition-colors duration-300">
          <div className="max-w-screen-2xl mx-auto flex flex-col gap-8">
            {nextEpisode && nextEpisodeResult && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:border-gray-700 p-4 transition-colors duration-300">
                {(() => {
                  const airTimeDisplay = getAirTimeDisplay(nextEpisode.airDate, anime.broadcast, parseDurationToMinutes(anime.duration));
                  const airTime = nextEpisodeResult.airTime;

                  let statusColor = 'text-blue-600 dark:text-blue-400';
                  let statusText = 'Next Episode';
                  let statusIcon = faCalendar;

                  if (airTimeDisplay) {
                    if (airTimeDisplay.variant === 'airing') {
                      statusColor = 'text-orange-600 dark:text-orange-400';
                      statusText = 'Currently Airing';
                      statusIcon = faClapperboard;
                    } else if (airTimeDisplay.variant === 'aired') {
                      statusColor = 'text-green-600 dark:text-green-400';
                      statusText = 'Recently Aired';
                      statusIcon = faCalendar;
                    } else if (airTimeDisplay.variant === 'countdown') {
                      statusColor = 'text-red-600 dark:text-red-400';
                      statusText = 'Airing Soon';
                      statusIcon = faClock;
                    } else if (airTimeDisplay.variant === 'scheduled') {
                      statusColor = 'text-blue-600 dark:text-blue-400';
                      statusText = 'Next Episode';
                      statusIcon = faCalendar;
                    }
                  }

                  return (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 ${statusColor}`}>
                          <FontAwesomeIcon icon={statusIcon} className="text-sm" />
                          <span className="font-semibold text-xs uppercase tracking-wide">{statusText}</span>
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            Episode {nextEpisode.episodeNumber}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">
                            {nextEpisode.titleEn || nextEpisode.titleJp || "TBA"}
                          </span>
                        </div>
                      </div>

                      <div className={`flex items-center gap-2 ${statusColor} flex-shrink-0`}>
                        <FontAwesomeIcon icon={faClock} className="text-xs" />
                        <span className="text-sm font-medium">
                          {airTimeDisplay ? airTimeDisplay.text :
                            airTime ? (
                              airTime <= now
                                ? `Aired ${format(airTime, "EEE MMM do 'at' h:mm a")}`
                                : `Airing ${format(airTime, "EEE MMM do 'at' h:mm a")}`
                            ) :
                              nextEpisode.airDate ? `Airing on ${format(new Date(nextEpisode.airDate), "dd MMM yyyy")}` : "TBA"
                          }
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className=" flex flex-col lg:flex-row gap-8">
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
                  <h2 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Ranking/Rating</h2>
                  {renderField("Rating", anime?.rating)}
                  {renderField("Ranking", anime?.ranking?.toString())}
                </div>
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Other
                    Info</h2>
                  {renderField("Broadcast", anime?.broadcast || "Unknown")}
                </div>
                <div className="space-y-3">
                  <h2 className="font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">Aired</h2>
                  {renderField("Start Date", anime?.startDate ? format(anime.startDate, "dd MMM yyyy") : "Unknown")}
                  {renderField("End Date", anime?.endDate ? format(anime.endDate, "dd MMM yyyy") : "Ongoing")}
                </div>
              </div>

              <div className=" w-full">
                <Tabs tabs={["Episodes", "Characters", "Trailers", "Artworks"]} defaultTab="Episodes">
                  <div>
                    {anime?.episodes && <Tables episodes={anime.episodes} broadcast={anime.broadcast} />}
                  </div>
                  <div>
                    <CharactersWithStaff animeId={anime.id} />
                  </div>
                  <div></div>
                  <div></div>
                </Tabs>
              </div>
            </div>
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