import { useQuery } from "@tanstack/react-query";
import {fetchDetails} from "../services/queries.ts";

export const useShowDetails = (id: string | undefined) => {
  return useQuery({
    ...fetchDetails(id || ''),
    enabled: !!id
  });
};
