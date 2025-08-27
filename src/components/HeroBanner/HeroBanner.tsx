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
  onDeleteAnime?: (animeId: string) => void;
}

export default function HeroBanner({ anime, onAddAnime, animeStatus, onDeleteAnime }: HeroBannerProps) {
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
    <div className="relative w-full h-[600px]">
      {/* Background layer */}
      <div className="absolute inset-0 overflow-hidden bg-white dark:bg-gray-900">
        {bgUrl && (
          <img
            src={bgUrl}
            alt="bg preload"
            style={{ opacity: bgLoaded ? 1 : 0 }}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            onLoad={() => setBgLoaded(true)}
            onError={() => {
              setBgUrl("/assets/not found.jpg");
              setBgLoaded(true);
            }}
          />
        )}

        {/*/!* overlays *!/*/}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Foreground content (not clipped) */}
      <div className="relative z-10 h-full flex items-end px-4 sm:px-8 lg:px-16">
        <div className="max-w-3xl text-white py-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-600 text-sm font-semibold mb-4">
            <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
            NOW AIRING
          </div>

          <h1 className="text-5xl font-bold mb-6 leading-tight">{title}</h1>

          <div className="mb-6 space-y-2">
            <p className="text-2xl font-medium">
              Episode {episodeNumber}: {episodeTitle}
            </p>
            <p className="text-lg text-gray-300">Airing {airDate}</p>
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
                className="px-5 py-2 text-base font-semibold shadow-md hover:shadow-lg"
              />
            </Link>

            {!anime.userAnime ? (
              <Button
                color={ButtonColor.transparent}
                label="Add to List"
                showLabel
                status={animeStatus}
                onClick={() => onAddAnime(anime.id)}
                className="px-4 py-2 text-base border-2 border-white text-white hover:bg-white hover:text-black transition"
              />
            ) : (
              <AnimeStatusDropdown
                entry={{ ...anime.userAnime, anime }}
                variant="hero"
                buttonClassName="px-4 py-2 text-base font-semibold flex-grow min-w-[100px]"
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
