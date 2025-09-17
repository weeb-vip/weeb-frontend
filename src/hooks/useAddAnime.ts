import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertAnime } from "../services/queries";
import debug from "../utils/debug";

export const useAddAnime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    ...upsertAnime(),
    onSuccess: async (data) => {
      debug.anime("Added anime", data);
      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["homedata"] });
      await queryClient.invalidateQueries({ queryKey: ["currently-airing"] });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error) => {
      debug.error("Error adding anime", error);
    }
  });
};