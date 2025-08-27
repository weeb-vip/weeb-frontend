import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { utc } from '@date-fns/utc/utc';
import Button, { ButtonColor } from '../Button';
import { StatusType } from '../Button/Button';
import { AnimeStatusDropdown } from '../AnimeStatusDropdown/AnimeStatusDropdown';

interface HeroBannerProps {
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

export default function HeroBanner({ anime, onAddAnime, animeStatus }: HeroBannerProps) {
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

      {/* Content */}
      <div className="relative z-10 h-full flex items-end">
        <div className="p-8 md:p-12 text-white max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Now Airing Badge */}
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-600 text-sm font-semibold mb-4">
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
            NOW AIRING
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            {title}
          </h1>

          {/* Episode Info */}
          <div className="mb-4 space-y-2">
            <p className="text-xl md:text-2xl font-medium">
              Episode {episodeNumber}: {episodeTitle}
            </p>
            <p className="text-lg text-gray-300">
              Airing {airDate}
            </p>
          </div>

          {/* Description */}
          {anime.description && (
            <p className="text-gray-200 text-lg mb-6 line-clamp-3 max-w-lg">
              {anime.description.length > 200
                ? `${anime.description.substring(0, 200)}...`
                : anime.description
              }
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 items-center">
            <Link to={`/show/${anime.id}`}>
              <Button
                color={ButtonColor.blue}
                label="More Info"
                showLabel
                className="px-8 py-3 text-lg font-semibold"
              />
            </Link>

            {!anime.userAnime ? (
              <Button
                color={ButtonColor.transparent}
                label="Add to List"
                showLabel
                status={animeStatus}
                onClick={() => onAddAnime(anime.id)}
                className="px-6 py-3 text-lg border-2 border-white text-white hover:bg-white hover:text-black transition-colors duration-300"
              />
            ) : (
              <div className="bg-white/20 backdrop-blur rounded-lg p-2">
                <AnimeStatusDropdown entry={{...anime.userAnime, anime}} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
