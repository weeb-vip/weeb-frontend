import Button, {ButtonColor} from "../../../components/Button";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faChevronCircleLeft, faChevronCircleRight} from "@fortawesome/free-solid-svg-icons";
import AnimeCard, {AnimeCardStyle} from "../../../components/AnimeCard";
import {format} from "date-fns";
import {useRef} from "react";
import {useNavigate} from "react-router-dom";


interface CarouselProps {
  data: CarouselData[]
}
interface CarouselData {
  title: string
  description: string
  episodes: number
  episodeLength: string
  year: string
  image: string
  navigate: string
}
function Carousel({data}: {data: CarouselData[]}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  return (
    <div
      className={'w-full flex flex-row space-x-4 m-auto py-8 cursor-pointer overflow-visible justify-center items-center'}>

      {/* button to scroll left */}
      <Button
        className={'flex-none w-12 h-12'}
        color={ButtonColor.transparent}
        label={""}
        onClick={() => {

          containerRef.current?.scrollBy({
            top: 0,
            left: -((cardRef.current?.clientWidth || 0) + 16),
            behavior: 'smooth'
          })

        }}
        showLabel={false}
        icon={<FontAwesomeIcon size="1x" color="#333" icon={faChevronCircleLeft} className={"w-6 h-6"}/>}
      />
      <div
        className={'w-full flex flex-row space-x-4 m-auto cursor-pointer overflow-x-scroll overflow-y-visible py-4'}
        ref={containerRef}
      >
        {/* button to scroll left */}

        {/* anime cards */}
        {data?.map((result: CarouselData) => (
          <div ref={cardRef} className={`flex flex-grow`}>
            <AnimeCard
              style={AnimeCardStyle.DETAIL}
              title={result.title}
              description={result.description}
              episodes={result.episodes?.toString()}
              episodeLength={result.episodeLength}
              year={result.year}
              image={result.image}
              onClick={() => {
                navigate(result.navigate)
              }}

            />
          </div>
        ))}
      </div>
      {/* button to scroll right */}

      <Button
        className={'flex-none w-12 h-12'}
        color={ButtonColor.transparent}
        onClick={() => {
          // use react ref to scroll to the right
          containerRef.current?.scrollBy({
            top: 0,
            // clientwidth and margin  left of the anime card
            left: (cardRef.current?.offsetWidth || 0) + 16,
            behavior: 'smooth'
          })
        }}
        label={"Next"}
        icon={<FontAwesomeIcon size="1x" color="#333" icon={faChevronCircleRight} className={"w-6 h-6"}/>}
      />

    </div>
  )
}

export default Carousel