import { useQuery } from "@tanstack/react-query";
import { CurrentlyAiringQuery } from "../gql/graphql";
import { fetchCurrentlyAiringWithDates } from "../services/queries";

export const useCurrentlyAiring = (startDate?: Date, endDate?: Date) => {
  // Default to yesterday through 7 days from now if no dates provided
  const defaultStartDate = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const defaultEndDate = endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return useQuery<CurrentlyAiringQuery>(fetchCurrentlyAiringWithDates(defaultStartDate, defaultEndDate));
};