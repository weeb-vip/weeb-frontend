import debug from "../utils/debug";

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
  console.log("ASHDKJASHDJK: ", anime.titleEn, anime.titleJp);
  return `${escapeUri((anime.titleEn ? anime.titleEn.toLowerCase().replace(/ /g, "_") : anime.titleJp?.toLowerCase().replace(/ /g, "_")) || "")}`;
}


function escapeUri(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, char =>
      '%' + char.charCodeAt(0).toString(16).toUpperCase()
    );
}
