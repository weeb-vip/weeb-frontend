import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Status } from "../gql/graphql";
import { upsertAnime } from "../services/queries";
import debug from "../utils/debug";

export const useAddAnime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    ...upsertAnime(),
    onSuccess: async (data) => {
      debug.anime("Added anime", data);
      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries(["homedata"]);
      await queryClient.invalidateQueries(["currentlyAiring"]);
      await queryClient.invalidateQueries(["user-animes"]);
    },
    onError: (error) => {
      debug.error("Error adding anime", error);
    }
  });

};