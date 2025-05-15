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
import { utc } from "@date-fns/utc/utc";
import { AnimePopover } from "./AnimePopover";

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

  // Prefetch next & previous ranges
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

  const animeByDate: Record<string, typeof data.currentlyAiring> = {};
  for (const anime of data.currentlyAiring || []) {
    for (const episode of anime.episodes || []) {
      const airDate = episode.airDate;
      if (!airDate) continue;

      const key = format(parseISO(airDate, { in: utc }), "yyyy-MM-dd", { in: utc });
      if (!animeByDate[key]) animeByDate[key] = [];

      (animeByDate[key] || []).push({
        ...anime,
        nextEpisode: episode,
      });
    }
  }

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
    <div className="max-w-screen-xl mx-auto px-4 py-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("month")}
            className={`px-3 py-1 rounded ${viewMode === "month" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 rounded ${viewMode === "week" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            Week
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={goPrev} className="text-sm text-blue-600 hover:underline">
            ← Previous
          </button>
          <h1 className="text-xl font-bold">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy")
              : `Week of ${format(start, "MMM d")}`}
          </h1>
          <button onClick={goNext} className="text-sm text-blue-600 hover:underline">
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-300 rounded-lg overflow-hidden text-sm relative z-0">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="bg-gray-50 py-3 text-center font-medium text-gray-700 border-b border-gray-200"
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd", { in: utc });
          const entries = animeByDate[dateKey] || [];
          const isToday = isTodayVisible(day);

          return (
            <div
              key={dateKey}
              className={`bg-white p-2 ${
                viewMode === "month" ? "h-[140px]" : ""
              } flex flex-col justify-start border border-gray-100 ${
                isToday ? "bg-blue-50 ring-2 ring-blue-400" : ""
              }`}
            >
              <div className="text-xs font-semibold text-gray-800 mb-1">
                {format(day, "d", { in: utc })}
              </div>
              <div
                className={`flex flex-col gap-1 pr-1 ${
                  viewMode === "month"
                    ? "overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
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
