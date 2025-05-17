import {Anime} from "../gql/graphql";

interface AnimePart {
  titleEn?: string;
  titleJp?: string;
  title_en?: string;
  title_jp?: string;
}
export function GetImageFromAnime(anime: AnimePart | any): string {
  if (!anime) {
    return "not found.png";
  }
  if (anime.title_en) {
    anime.titleEn = anime.title_en;
  }
  if (anime.title_jp) {
    anime.titleJp = anime.title_jp;
  }
  return `${encodeURIComponent((anime.titleEn ? anime.titleEn.toLowerCase().replace(/ /g, "_") : anime.titleJp?.toLowerCase().replace(/ /g, "_")) || "")}`;
}

