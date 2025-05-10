import {useState} from "react";

interface CarouselData {
  title: string
  description: string
  episodes: number
  episodeLength: string
  year: string
  image: string
  navigate: string
}

export function AnimeGridSection({ title, data }: { title: string, data: CarouselData[] }) {
  const [filter, setFilter] = useState("Airing")

  return (
    <div className="w-full flex flex-col px-4">
      <h2 className="text-3xl font-bold mt-8 mb-4">{title}</h2>
      <div className="flex gap-2 mb-6">
        {["Airing", "Season", "Newest"].map(f => (
          <button
            key={f}
            className={`px-4 py-2 rounded-full ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.map((anime, idx) => (
          <AnimeCard
            key={`${anime.title}-${idx}`}
            style={AnimeCardStyle.DEFAULT}
            title={anime.title}
            description={anime.description}
            episodes={anime.episodes.toString()}
            episodeLength={anime.episodeLength}
            year={anime.year}
            image={anime.image}
            onClick={() => navigate(anime.navigate)}
          />
        ))}
      </div>
    </div>
  )
}
