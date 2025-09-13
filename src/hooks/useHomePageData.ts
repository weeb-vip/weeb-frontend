import { useQuery } from "@tanstack/react-query";
import { GetHomePageDataQuery } from "../gql/graphql";
import { fetchHomePageData } from "../services/queries";

export const useHomePageData = () => {
  return useQuery<GetHomePageDataQuery>(fetchHomePageData());
};