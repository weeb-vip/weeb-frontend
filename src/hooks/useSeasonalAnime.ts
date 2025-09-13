import { useQuery } from "@tanstack/react-query";
import { fetchSeasonalAnime } from "../services/queries";

export const useSeasonalAnime = (selectedSeason: string) => {
  return useQuery(fetchSeasonalAnime(selectedSeason));
};