import { useQuery } from "@tanstack/react-query";
import { GetAnimeDetailsByIdQuery } from "../gql/graphql";
import { fetchDetails } from "../services/queries";

export const useShowDetails = (id?: string) => {
  return useQuery<GetAnimeDetailsByIdQuery>({
    ...fetchDetails(id || ""),
    enabled: !!id,
  });
};