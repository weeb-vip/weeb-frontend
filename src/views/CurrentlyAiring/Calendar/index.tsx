import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCurrentlyAiringWithDates } from "../../../services/queries";
import { CurrentlyAiringWithDateQuery } from "../../../gql/graphql";
import Loader from "../../../components/Loader";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
} from "date-fns";
import { AnimePopover } from "./AnimePopover";
import StatusButton, {ButtonColor} from "../../../components/Button";
import { parseAirTime } from "../../../services/airTimeUtils";

type ViewMode = "month" | "week";

export default function AiringCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const queryClient = useQueryClient();

  const start =
    viewMode === "month"
      ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 })
      : startOfWeek(currentDate, { weekStartsOn: 0 });

  const end =
    viewMode === "month"
      ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 })
      : endOfWeek(currentDate, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start, end });

  const { data, isLoading } = useQuery<CurrentlyAiringWithDateQuery>(
    ["currentlyAiring", start.toISOString(), end.toISOString()],
    () => fetchCurrentlyAiringWithDates(start, end).queryFn()
  );

  // Prefetch next & previous date ranges
  useEffect(() => {
    const ranges = [
      {
        start:
          viewMode === "month"
            ? startOfWeek(startOfMonth(subMonths(currentDate, 1)), { weekStartsOn: 0 })
            : startOfWeek(subWeeks(currentDate, 1), { weekStartsOn: 0 }),
        end:
          viewMode === "month"
            ? endOfWeek(endOfMonth(subMonths(currentDate, 1)), { weekStartsOn: 0 })
            : endOfWeek(subWeeks(currentDate, 1), { weekStartsOn: 0 }),
      },
      {
        start:
          viewMode === "month"
            ? startOfWeek(startOfMonth(addMonths(currentDate, 1)), { weekStartsOn: 0 })
            : startOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 0 }),
        end:
          viewMode === "month"
            ? endOfWeek(endOfMonth(addMonths(currentDate, 1)), { weekStartsOn: 0 })
            : endOfWeek(addWeeks(currentDate, 1), { weekStartsOn: 0 }),
      },
    ];

    for (const { start, end } of ranges) {
      queryClient.prefetchQuery(
        ["currentlyAiring", start.toISOString(), end.toISOString()],
        () => fetchCurrentlyAiringWithDates(start, end).queryFn()
      );
    }
  }, [currentDate, viewMode, queryClient]);

  if (isLoading || !data) return <Loader />;

  const animeByDate: Record<string, any[]> = {};

  for (const anime of data.currentlyAiring || []) {
    for (const episode of anime.episodes || []) {
      // Parse air time for this specific episode
      const episodeAirTime = parseAirTime(episode.airDate, anime.broadcast);
      if (!episodeAirTime) continue;

      const dateKey = format(episodeAirTime, "yyyy-MM-dd");
      if (!animeByDate[dateKey]) animeByDate[dateKey] = [];

      // Create entry with the episode's specific air time
      const animeEntry = {
        ...anime,
        episodes: [episode], // Pass single episode as array for HeroBanner
        episodeAirTime: episodeAirTime, // Use the episode's air time for sorting
      };

      animeByDate[dateKey].push(animeEntry);
    }
  }

  // Sort entries by episode air time within each day
  Object.keys(animeByDate).forEach(dateKey => {
    animeByDate[dateKey].sort((a, b) => {
      const aTime = a.episodeAirTime;
      const bTime = b.episodeAirTime;

      // Both should have episodeAirTime since we filtered out entries without it above
      if (aTime && bTime) {
        return aTime.getTime() - bTime.getTime();
      }

      // Fallback (shouldn't happen with the filtering above)
      return 0;
    });
  });

  const isTodayVisible = (day: Date) =>
    currentDate.getMonth() === new Date().getMonth() && isSameDay(day, new Date());

  const goPrev = () => {
    setCurrentDate((prev) =>
      viewMode === "month" ? subMonths(prev, 1) : subWeeks(prev, 1)
    );
  };

  const goNext = () => {
    setCurrentDate((prev) =>
      viewMode === "month" ? addMonths(prev, 1) : addWeeks(prev, 1)
    );
  };

  return (
    <div className="max-w-screen-xl mx-auto relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex gap-2">
          <StatusButton
            label="Month"
            color={viewMode === "month" ? ButtonColor.blue : ButtonColor.transparent}
            onClick={() => setViewMode("month")}
            className="px-3 py-1 rounded"
          />

          <StatusButton
            label="Week"
            color={viewMode === "week" ? ButtonColor.blue : ButtonColor.transparent}
            onClick={() => setViewMode("week")}
            className="px-3 py-1 rounded ml-2"
          />
        </div>

        <div className="flex items-center gap-4">
          <button onClick={goPrev} className="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300">
            ← Previous
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy")
              : `Week of ${format(start, "MMM d")}`}
          </h1>
          <button onClick={goNext} className="text-sm text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300">
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px bg-gray-200 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden text-sm relative z-0 transition-colors duration-300">
        {/* Day headers for desktop only */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="hidden lg:block bg-gray-50 dark:bg-gray-700 py-2 px-2 text-center font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 transition-colors duration-300"
          >
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const entries = animeByDate[dateKey] || [];
          const isToday = isTodayVisible(day);

          return (
            <div
              key={dateKey}
              className={`bg-white dark:bg-gray-800 p-2 transition-colors duration-300 ${
                viewMode === "month" ? "min-h-[140px]" : ""
              } flex flex-col justify-start border border-gray-100 dark:border-gray-600 ${
                isToday ? "bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400 dark:ring-blue-500" : ""
              }`}
            >
              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-1">
                <span>{format(day, "d")}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs block lg:hidden">
                  ({format(day, "EEE")})
                </span>
              </div>
              <div
                className={`flex flex-col gap-1 pr-1 ${
                  viewMode === "month"
                    ? "overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-500 scrollbar-track-transparent"
                    : ""
                }`}
              >
                {entries.map((anime, index) => (
                  <AnimePopover anime={anime} key={`${anime.id}-${index}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
