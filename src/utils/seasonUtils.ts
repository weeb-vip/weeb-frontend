import { Season } from "../gql/graphql";

export function getCurrentSeason(date: Date = new Date()): Season {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (0 = January, 11 = December)

  // Define season boundaries
  // Winter: January, February, March
  // Spring: April, May, June
  // Summer: July, August, September
  // Fall: October, November, December

  if (month >= 3 && month <= 5) {
    // March (2), April (3), May (4) = Spring
    return `SPRING_${year}` as Season;
  } else if (month >= 6 && month <= 8) {
    // June (5), July (6), August (7) = Summer
    return `SUMMER_${year}` as Season;
  } else if (month >= 9 && month <= 11) {
    // September (8), October (9), November (10) = Fall
    return `FALL_${year}` as Season;
  } else {
    // December (11), January (0), February (1) = Winter
    // For December, use next year's winter season
    // For January/February, use current year's winter season
    const winterYear = month === 11 ? year + 1 : year;
    return `WINTER_${winterYear}` as Season;
  }
}

export function getSeasonDisplayName(season: Season): string {
  const match = season.match(/^(SPRING|SUMMER|FALL|WINTER)_(\d{4})$/);
  if (!match) return season;

  const [, seasonName, year] = match;
  const capitalizedSeason = seasonName.charAt(0) + seasonName.slice(1).toLowerCase();
  return `${capitalizedSeason} ${year}`;
}

export function getNextSeasons(currentSeason: Season, count: number = 2): Season[] {
  const match = currentSeason.match(/^(SPRING|SUMMER|FALL|WINTER)_(\d{4})$/);
  if (!match) return [];
  
  const [, seasonName, yearStr] = match;
  let year = parseInt(yearStr);
  
  // Season order: WINTER -> SPRING -> SUMMER -> FALL -> WINTER (next year)
  const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  let currentIndex = seasons.indexOf(seasonName);
  
  const nextSeasons: Season[] = [];
  
  for (let i = 1; i <= count; i++) {
    currentIndex++;
    if (currentIndex >= seasons.length) {
      currentIndex = 0;
      year++;
    }
    nextSeasons.push(`${seasons[currentIndex]}_${year}` as Season);
  }
  
  return nextSeasons;
}

export function getSeasonOptions(currentSeason: Season): Season[] {
  return [currentSeason, ...getNextSeasons(currentSeason, 2)];
}
