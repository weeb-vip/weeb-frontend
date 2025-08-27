import React, {useState, useEffect} from 'react';
import {Link} from 'react-router-dom';
import {format} from 'date-fns';
import Button, {ButtonColor} from '../Button';
import {StatusType} from '../Button/Button';
import {AnimeStatusDropdown} from '../AnimeStatusDropdown/AnimeStatusDropdown';

interface HeroBannerProps {
  anime: {
    id: string;
    titleEn?: string | null;
    titleJp?: string | null;
    description?: string | null;
    anidbid?: string | null;
    broadcast?: string | null;
    nextEpisode?: {
      episodeNumber?: number | null;
      titleEn?: string | null;
      titleJp?: string | null;
      airDate?: string | null;
    } | null;
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
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    setUseFallback(false);
    setBgLoaded(false);
    
    if (anime.anidbid) {
      const fanartUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/fanart`;
      setBgUrl(fanartUrl);
    } else {
      // No anidbid available, use default fallback
      setBgUrl("/assets/not found.jpg");
      setBgLoaded(true);
    }
  }, [anime.anidbid, anime]);

  const title = anime.titleEn || anime.titleJp || "Unknown";
  const episodeTitle = anime.nextEpisode?.titleEn || anime.nextEpisode?.titleJp || "Unknown";
  const episodeNumber = anime.nextEpisode?.episodeNumber || "Unknown";

  // Parse broadcast time and create accurate air time
  const parseAirTime = () => {
    if (!anime.nextEpisode?.airDate || !anime.broadcast) return null;

    const airDate = new Date(anime.nextEpisode.airDate);

    // Parse broadcast time (e.g., "Wednesdays at 01:29 (JST)")
    const timeMatch = anime.broadcast.match(/(\d{1,2}):(\d{2})/);
    const timezoneMatch = anime.broadcast.match(/\(([A-Z]{3,4})\)/);

    if (!timeMatch) return airDate;

    const [, hours, minutes] = timeMatch;
    const timezone = timezoneMatch ? timezoneMatch[1] : 'JST';

    // Create a new date with the broadcast time in JST, then convert to UTC
    const broadcastDate = new Date(airDate);

    if (timezone === 'JST') {
      // JST is UTC+9, so to convert JST time to UTC, we subtract 9 hours
      broadcastDate.setUTCHours(parseInt(hours) - 9, parseInt(minutes), 0, 0);

      // Handle negative hours (previous day)
      if (parseInt(hours) - 9 < 0) {
        broadcastDate.setUTCDate(broadcastDate.getUTCDate() - 1);
        broadcastDate.setUTCHours(parseInt(hours) - 9 + 24, parseInt(minutes), 0, 0);
      }
    } else {
      broadcastDate.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
    }

    return broadcastDate;
  };

  // Format air date with time in local timezone
  const getAirDateTime = () => {
    if (!anime.nextEpisode?.airDate) return "Unknown";

    const airTime = parseAirTime();
    if (airTime) {
      // Use the parsed air time for both date and time (properly converted from JST to local)
      const localDate = format(airTime, "EEE MMM do");
      const localTime = format(airTime, "h:mm a");
      return `${localDate} at ${localTime}`;
    }

    // Fallback to just the original air date
    return format(new Date(anime.nextEpisode.airDate), "EEE MMM do");
  };

  // Check if the anime is airing today or within 24 hours (more flexible)
  const isAiringToday = (() => {
    if (!anime.nextEpisode?.airDate) return false;

    const airTime = parseAirTime();
    if (!airTime) return false;

    const now = new Date();
    const diffMs = airTime.getTime() - now.getTime();

    // Show countdown if airing within next 24 hours
    return diffMs > 0 && diffMs <= (24 * 60 * 60 * 1000);
  })();

  // Check if the anime has already aired
  const hasAlreadyAired = (() => {
    if (!anime.nextEpisode?.airDate) return false;

    const airTime = parseAirTime();
    if (!airTime) return false;

    const now = new Date();
    const diffMs = airTime.getTime() - now.getTime();

    // Show "already aired" if it aired within the last 7 days
    return diffMs <= 0 && Math.abs(diffMs) <= (7 * 24 * 60 * 60 * 1000);
  })();

  // Countdown logic
  useEffect(() => {
    if (!anime.nextEpisode?.airDate || !isAiringToday) {
      setCountdown("");
      return;
    }

    const calculateCountdown = () => {
      const now = new Date();
      const airTime = parseAirTime();
      if (!airTime) return;

      const diffMs = airTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdown("AIRING NOW");
        return;
      }

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 60) {
        setCountdown(`${diffMinutes}m`);
      } else if (diffHours < 24) {
        setCountdown(`${diffHours}h`);
      } else if (diffDays < 30) {
        setCountdown(`${diffDays}d`);
      } else {
        setCountdown("");
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [anime.nextEpisode?.airDate, anime.broadcast, isAiringToday]);

  return (
    <div className="relative w-full h-[600px] rounded-lg">
      {/* Background layer */}
      <div className="absolute inset-0 overflow-hidden bg-white dark:bg-gray-900 md:rounded-lg xs:rounded-none">
        {bgUrl && (
          <img
            src={bgUrl}
            alt="bg preload"
            style={{opacity: bgLoaded ? 1 : 0}}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${
              useFallback ? 'blur-md scale-110' : ''
            }`}
            onLoad={() => setBgLoaded(true)}
            onError={() => {
              if (!useFallback && anime.anidbid) {
                // Fanart failed, try poster as fallback
                setUseFallback(true);
                const posterUrl = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/poster`;
                setBgUrl(posterUrl);
              } else {
                // Poster also failed, use default
                setBgUrl("/assets/not found.jpg");
                setBgLoaded(true);
              }
            }}
          />
        )}

        {/*/!* overlays *!/*/}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"/>
      </div>

      {/* Foreground content (not clipped) */}
      <div className="relative z-10 h-full flex items-end px-4 sm:px-8 lg:px-16">
        <div className="max-w-3xl text-white py-12">
          {isAiringToday && (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-red-600 text-sm font-semibold mb-4">
              <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
              AIRING TODAY
              {countdown && (
                <span className="ml-2 px-2 py-1 bg-white/20 rounded text-xs">
                  in {countdown}
                </span>
              )}
            </div>
          )}

          {hasAlreadyAired && !isAiringToday && (
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-600 text-sm font-semibold mb-4">
              <span className="w-2 h-2 bg-white rounded-full mr-2"></span>
              RECENTLY AIRED
            </div>
          )}

          <h1 className="text-5xl font-bold mb-6 leading-tight">{title}</h1>

          <div className="mb-8 space-y-4">
            <p className="text-2xl font-medium">
              Episode {episodeNumber}: {episodeTitle}
            </p>
            <div className="flex items-center gap-2">
              <p className="text-lg text-gray-300">Airing {getAirDateTime()}</p>
              {anime.broadcast && (
                <span className="px-2 py-1 bg-blue-600/20 text-blue-300 rounded text-xs font-medium">
                  JST Broadcast
                </span>
              )}
            </div>
          </div>

          {anime.description && (
            <p className="text-gray-200 text-lg mb-8 line-clamp-3">
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
