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
  return `${fullyEncodeSlug((anime.titleEn ? anime.titleEn.toLowerCase().replace(/ /g, "_") : anime.titleJp?.toLowerCase().replace(/ /g, "_")) || "")}`;
}

function fullyEncodeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/ /g, "_") // replace spaces first
    .split("")
    .map(char => {
      const code = char.charCodeAt(0);
      // Encode anything outside [a-z0-9_-]
      if (
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57) ||  // 0-9
        char === "_" || char === "-"
      ) {
        return char;
      }
      return "%" + code.toString(16).toUpperCase().padStart(2, "0");
    })
    .join("");
}
