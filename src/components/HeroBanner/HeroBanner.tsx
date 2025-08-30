import React, {useState, useEffect} from 'react';
import {Link} from 'react-router-dom';
import Button, {ButtonColor} from '../Button';
import {StatusType} from '../Button/Button';
import {AnimeStatusDropdown} from '../AnimeStatusDropdown/AnimeStatusDropdown';
import {GetImageFromAnime} from '../../services/utils';
import {useAnimeCountdownStore} from '../../stores/animeCountdownStore';
import debug from "../../utils/debug";

interface HeroBannerProps {
  anime: {
    id: string;
    titleEn?: string | null;
    titleJp?: string | null;
    description?: string | null;
    anidbid?: string | null;
    broadcast?: string | null;
    userAnime?: any;
  };
  onAddAnime: (id: string) => void;
  animeStatus: StatusType;
  onDeleteAnime?: (animeId: string) => void;
}

export default function HeroBanner({anime, onAddAnime, animeStatus, onDeleteAnime}: HeroBannerProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [showJstPopover, setShowJstPopover] = useState(false);

  // Get comprehensive timing data from Zustand store
  const timingData = useAnimeCountdownStore((state) => state.getTimingData(anime.id));

  // Get worker countdown data from Zustand store (backward compatibility)
  const workerCountdown = useAnimeCountdownStore((state) => state.countdowns[anime.id]);

  useEffect(() => {
    setUseFallback(false);
    setBgLoaded(false);

    if (anime.anidbid) {
      const fanartUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/fanart`;
      setBgUrl(fanartUrl);
    } else {
      // No anidbid available, use same fallback as anime cards
      setBgUrl(GetImageFromAnime(anime));
      setBgLoaded(true);
    }
  }, [anime.anidbid, anime.id, anime.titleEn, anime.titleJp]);

  const title = anime.titleEn || anime.titleJp || "Unknown";

  // All timing data comes from the worker via Zustand store

  const hasTimingData = Boolean(timingData || workerCountdown);
  const airDateTime = timingData?.airDateTime || "";
  const airingToday = timingData?.isAiringToday || false;
  const currentlyAiring = timingData?.isCurrentlyAiring || workerCountdown?.isAiring || false;
  const alreadyAired = timingData?.hasAlreadyAired || workerCountdown?.hasAired || false;
  const countdown = timingData?.countdown || workerCountdown?.countdown || "";
  const progress = timingData?.progress || workerCountdown?.progress;

  // Episode info from worker
  const episode = timingData?.episode;
  const episodeTitle = episode ? (episode.titleEn || episode.titleJp || "Next Episode") : (hasTimingData ? "Next Episode" : "No upcoming episodes");
  const episodeNumber = episode?.episodeNumber ? `${episode.episodeNumber}` : "";


  return (
    <div className="relative w-full h-[600px] rounded-lg">
      {/* Background layer */}
      <div className="absolute inset-0 overflow-hidden bg-white dark:bg-gray-900 md:rounded-lg xs:rounded-none">
        {bgUrl && (
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              opacity: bgLoaded ? 1 : 0,
              transition: 'opacity 500ms',
            }}
          >
            <img
              src={bgUrl}
              alt="bg preload"
              className={`absolute w-full h-full object-cover ${
                useFallback ? 'blur-md scale-110 -inset-4' : 'inset-0'
              } transition-all duration-500`}
              onLoad={() => setBgLoaded(true)}
              onError={() => {
                if (!useFallback && anime.anidbid) {
                  // Fanart failed, try poster as fallback
                  setUseFallback(true);
                  setBgUrl(`https://cdn.weeb.vip/weeb/${encodeURIComponent(GetImageFromAnime(anime))}`);

                } else {
                  // Poster also failed, use same fallback as anime cards
                  setBgUrl("/assets/not found.jpg");
                  setBgLoaded(true);
                }
              }}
            />
          </div>
        )}

        {/*/!* overlays *!/*/}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"/>
      </div>

      {/* Foreground content (not clipped) */}
      <div className="relative z-10 h-full flex items-end px-4 sm:px-8 lg:px-16">
        <div className="max-w-3xl text-white py-12">
          {hasTimingData && currentlyAiring && (
            <div className="relative inline-flex items-center px-4 py-2 rounded-full bg-orange-600 text-sm font-semibold mb-4 overflow-hidden">
              {/* Progress bar background */}
              {progress !== undefined && (
                <div
                  className="absolute inset-0 bg-orange-800/60 transition-all duration-1000 ease-out"
                  style={{ width: `${progress * 100}%` }}
                />
              )}
              {/* Content */}
              <span className="relative w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
              <span className="relative">CURRENTLY AIRING</span>
            </div>
          )}

          {hasTimingData && airingToday && !currentlyAiring && !alreadyAired && (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-red-600 text-sm font-semibold mb-4">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
              {countdown === "JUST AIRED" ? "JUST AIRED" : "AIRING SOON"}
              {countdown && !countdown.includes("JUST AIRED") && !countdown.includes("AIRING NOW") && (
                <span className="ml-2 px-2 py-1 bg-white/20 rounded text-xs">
                  in {countdown}
                </span>
              )}
            </div>
          )}

          {hasTimingData && alreadyAired && !currentlyAiring && (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-600 text-sm font-semibold mb-4">
              <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
              RECENTLY AIRED
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 leading-tight">{title}</h1>

          {hasTimingData && airDateTime && (
            <div className="mb-6 sm:mb-8 space-y-3 sm:space-y-4">
              <p className="text-lg sm:text-xl lg:text-2xl font-medium">
                {episodeNumber ? `Episode ${episodeNumber}: ${episodeTitle}` : episodeTitle}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="text-base sm:text-lg text-gray-300">Airing {airDateTime}</p>
                {anime.broadcast && (
                <div className="relative">
                  <span
                    className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs font-medium cursor-help"
                    onMouseEnter={() => setShowJstPopover(true)}
                    onMouseLeave={() => setShowJstPopover(false)}
                  >
                    JST Broadcast
                  </span>
                  <div
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 transition-all duration-200 ease-out pointer-events-none"
                    style={{
                      opacity: showJstPopover ? 1 : 0,
                      transform: showJstPopover ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
                    }}
                  >
                    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm rounded-lg p-3 w-80 max-w-[calc(100vw-2rem)]" style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)' }}>
                      <div className="text-center">
                        <p className="text-gray-700 dark:text-gray-200">
                          Japanese TV broadcast time. Streaming services usually release around the same time.
                        </p>
                      </div>
                      <div className="absolute top-full left-4 sm:left-1/2 sm:transform sm:-translate-x-1/2 border-8 border-transparent border-t-white dark:border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {anime.description && (
            <p className="text-gray-200 text-sm sm:text-base lg:text-lg mb-6 sm:mb-8 line-clamp-3">
              {anime.description.length > 250
                ? `${anime.description.substring(0, 250)}...`
                : anime.description}
            </p>
          )}

          <div className="flex flex-wrap gap-4 items-center">
            <Link to={`/show/${anime.id}`}>
              <Button
                color={ButtonColor.blue}
                label="More Info"
                showLabel
                className="px-4 py-2 text-base font-semibold shadow-md hover:shadow-lg"
              />
            </Link>

            {!anime.userAnime ? (
              <Button
                color={ButtonColor.transparent}
                label="Add to List"
                showLabel
                status={animeStatus}
                onClick={() => onAddAnime(anime.id)}
                className="px-4 py-2 text-base font-semibold text-white
           hover:bg-white hover:text-black
           focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black
           transition"
              />
            ) : (
              <AnimeStatusDropdown
                entry={{...anime.userAnime, anime}}
                variant="hero"
                buttonClassName="px-4 py-2 text-base font-semibold min-w-[80px] sm:min-w-[120px] w-fit"
                deleteButtonClassName="px-2 py-2 min-w-[36px] h-[36px] text-base"
                onDelete={onDeleteAnime}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export function HeroBannerSkeleton() {
  return (
    <div className="relative w-full h-[600px] rounded-lg animate-pulse">
      {/* Background layer */}
      <div className="absolute inset-0 overflow-hidden bg-gray-300 dark:bg-gray-700 md:rounded-lg xs:rounded-none">
        <div className="absolute inset-0 w-full h-full bg-gray-400 dark:bg-gray-600"/>
      </div>

      {/* Foreground content (not clipped) */}
      <div className="relative z-10 h-full flex items-end px-4 sm:px-8 lg:px-16">
        <div className="max-w-3xl text-white py-12 space-y-6 w-full">
          <div className="h-8 bg-gray-400 dark:bg-gray-600 rounded w-3/4"></div>
          <div className="space-y-4">
            <div className="h-6 bg-gray-400 dark:bg-gray-600 rounded w-1/2"></div>
            <div className="h-5 bg-gray-400 dark:bg-gray-600 rounded w-1/3"></div>
          </div>
          <div className="h-20 bg-gray-400 dark:bg-gray-600 rounded w-full"></div>
          <div className="flex flex-wrap gap-4">
            <div className="h-10 bg-gray-400 dark:bg-gray-600 rounded w-32"></div>
            <div className="h-10 bg-gray-400 dark:bg-gray-600 rounded w-32"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
