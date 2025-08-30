const fs = require('fs');
const data = JSON.parse(fs.readFileSync('currentlyairing.json', 'utf8'));

const targetAnimeId = '83076d4f-300f-45b1-b082-83d8e838a527';
const targetAnime = data.currentlyAiring.find(anime => anime.id === targetAnimeId);

console.log('Target anime found:', !!targetAnime);
if (targetAnime) {
  console.log('Anime details:', {
    id: targetAnime.id,
    title: targetAnime.titleEn,
    hasEpisodes: targetAnime.episodes?.length > 0,
    episodeCount: targetAnime.episodes?.length,
    nextEpisode: targetAnime.nextEpisode?.airDate,
  });

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  console.log('Date filters:', {
    now: now.toISOString(),
    sevenDaysFromNow: sevenDaysFromNow.toISOString(),
    thirtyMinutesAgo: thirtyMinutesAgo.toISOString()
  });

  if (targetAnime.episodes && targetAnime.episodes.length > 0) {
    console.log('\nEpisode filtering:');
    targetAnime.episodes.forEach(ep => {
      if (ep.airDate) {
        const episodeDate = new Date(ep.airDate);
        const inRange = episodeDate >= thirtyMinutesAgo && episodeDate <= sevenDaysFromNow;
        console.log(`Episode ${ep.episodeNumber}: ${episodeDate.toISOString()} - In range: ${inRange}`);
      }
    });

    const filteredEpisodes = targetAnime.episodes
      .filter(ep => ep.airDate)
      .map(ep => ({ ...ep, airDate: new Date(ep.airDate) }))
      .filter(episode => {
        return episode.airDate >= thirtyMinutesAgo && episode.airDate <= sevenDaysFromNow;
      });

    console.log('\nFiltered episodes:', filteredEpisodes.length);
    filteredEpisodes.forEach(ep => {
      console.log(`- Episode ${ep.episodeNumber}: ${ep.airDate.toISOString()}`);
    });
  }
}