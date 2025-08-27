import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { utc } from '@date-fns/utc/utc';
import Button, { ButtonColor } from '../Button';
import { StatusType } from '../Button/Button';
import { AnimeStatusDropdown } from '../AnimeStatusDropdown/AnimeStatusDropdown';

interface HeroBannerFullWidthProps {
  anime: {
    id: string;
    titleEn?: string | null;
    titleJp?: string | null;
    description?: string | null;
    anidbid?: string | null;
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
}

export default function HeroBannerFullWidth({ anime, onAddAnime, animeStatus }: HeroBannerFullWidthProps) {
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    if (anime.anidbid) {
      const url = `https://weeb-api.staging.weeb.vip/show/anime/anidb/series/${anime.anidbid}/fanart`;
      setBgLoaded(false);
      setBgUrl(url);
    }
  }, [anime.anidbid]);

  const title = anime.titleEn || anime.titleJp || "Unknown";
  const episodeTitle = anime.nextEpisode?.titleEn || anime.nextEpisode?.titleJp || "Unknown";
  const airDate = anime.nextEpisode?.airDate
    ? format(new Date(anime.nextEpisode.airDate), "EEE MMM do", { in: utc })
    : "Unknown";
  const episodeNumber = anime.nextEpisode?.episodeNumber || "Unknown";

  return (
    <div className="absolute inset-0">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-white dark:bg-gray-900 transition-all duration-500"
        style={{
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
        }}
      >
        <div className="absolute block inset-0 bg-white dark:bg-gray-900 w-full h-full transition-colors duration-300" />

        {bgUrl && (
          <img
            src={bgUrl}
            alt="bg preload"
            style={{ opacity: bgLoaded ? 1 : 0 }}
            className="absolute inset-0 w-full h-full object-cover bg-white dark:bg-gray-900 transition-all duration-500"
            onLoad={() => setBgLoaded(true)}
            onError={() => {
              setBgUrl("/assets/not found.jpg");
              setBgLoaded(true);
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 h-full flex items-end">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-8 lg:px-16">
          <div className="p-4 sm:p-6 md:p-12 text-white max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Now Airing Badge */}
            <div className="inline-flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-red-600 text-xs sm:text-sm font-semibold mb-2 sm:mb-4">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full mr-1 sm:mr-2 animate-pulse"></span>
              NOW AIRING
            </div>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl font-bold mb-3 sm:mb-4 md:mb-6 leading-tight">
              {title}
            </h1>

            {/* Episode Info */}
            <div className="mb-3 sm:mb-4 md:mb-6 space-y-1 sm:space-y-2">
              <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-medium">
                Episode {episodeNumber}: {episodeTitle}
              </p>
              <p className="text-base sm:text-lg md:text-xl text-gray-300">
                Airing {airDate}
              </p>
            </div>

            {/* Description - Hidden on small mobile, shown on larger screens */}
            {anime.description && (
              <p className="hidden sm:block text-gray-200 text-base sm:text-lg md:text-xl mb-4 sm:mb-6 md:mb-8 line-clamp-2 sm:line-clamp-3 md:line-clamp-4 max-w-2xl leading-relaxed">
                {anime.description.length > 250
                  ? `${anime.description.substring(0, 250)}...`
                  : anime.description
                }
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 sm:gap-4 md:gap-6 items-center">
              <Link to={`/show/${anime.id}`}>
                <Button
                  color={ButtonColor.blue}
                  label="More Info"
                  showLabel
                  className="px-6 py-3 sm:px-8 sm:py-3 md:px-12 md:py-4 text-base sm:text-lg md:text-xl font-semibold shadow-lg hover:shadow-xl transition-shadow duration-300"
                />
              </Link>
              
              {!anime.userAnime ? (
                <Button
                  color={ButtonColor.transparent}
                  label="Add to List"
                  showLabel
                  status={animeStatus}
                  onClick={() => onAddAnime(anime.id)}
                  className="px-4 py-3 sm:px-6 sm:py-3 md:px-8 md:py-4 text-base sm:text-lg md:text-xl border-2 border-white text-white hover:bg-white hover:text-black transition-colors duration-300 shadow-lg hover:shadow-xl"
                />
              ) : (
                <div className="bg-white/20 backdrop-blur rounded-lg p-2 sm:p-3">
                  <AnimeStatusDropdown entry={{...anime.userAnime, anime}} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}