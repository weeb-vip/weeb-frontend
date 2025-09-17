import { useQuery } from "@tanstack/react-query";
import {fetchCurrentlyAiringWithDates} from "../services/queries.ts";
import type {CurrentlyAiringWithDateQuery} from "../gql/graphql.ts";

export const useCurrentlyAiringWithDates = (startDate?: Date, endDate?: Date | null, daysFromNow?: number) => {
  // Default to past day through next 7 days if no dates provided
  const defaultStartDate = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
  const defaultDaysFromNow = daysFromNow || 7;

  return useQuery<CurrentlyAiringWithDateQuery>(
    fetchCurrentlyAiringWithDates(defaultStartDate, endDate, defaultDaysFromNow)
  );
};
