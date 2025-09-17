import { useQuery } from "@tanstack/react-query";
import {fetchHomePageData} from "../services/queries.ts";

export const useHomePageData = () => {
  return useQuery(fetchHomePageData());
};
