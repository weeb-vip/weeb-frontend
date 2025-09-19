import { toast } from 'svelte-sonner';
import AnimeToast from '../components/AnimeToast.svelte';

interface AnimeData {
  id?: string | number;
  titleEn?: string;
  titleJp?: string;
  imageUrl?: string;
}

interface EpisodeData {
  episodeNumber?: number;
  titleEn?: string;
  titleJp?: string;
}

export const animeToast = {
  airingSoon: (anime: AnimeData, episode: EpisodeData, minutesUntil: number) => {
    const timeInfo = minutesUntil === 1
      ? 'Starting in 1 minute'
      : `Starting in ${minutesUntil} minutes`;

    toast.custom(AnimeToast, {
      componentProps: {
        anime,
        episode,
        status: 'airing-soon',
        timeInfo
      },
      duration: 8000,
    });
  },

  warning: (anime: AnimeData, episode: EpisodeData) => {
    toast.custom(AnimeToast, {
      componentProps: {
        anime,
        episode,
        status: 'warning',
        timeInfo: 'Starting in 5 minutes'
      },
      duration: 10000,
    });
  },

  nowAiring: (anime: AnimeData, episode: EpisodeData) => {
    toast.custom(AnimeToast, {
      componentProps: {
        anime,
        episode,
        status: 'airing',
        timeInfo: 'Now airing'
      },
      duration: 8000,
    });
  },

  finished: (anime: AnimeData, episode: EpisodeData) => {
    toast.custom(AnimeToast, {
      componentProps: {
        anime,
        episode,
        status: 'finished',
        timeInfo: 'Finished airing'
      },
      duration: 6000,
    });
  }
};