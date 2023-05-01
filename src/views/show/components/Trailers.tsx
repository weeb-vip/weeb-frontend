import {Trailer} from "../../../services/api/details";

function Trailers({ trailers }: { trailers: Trailer[] }) {
  return (
    <div className="flex flex-col space-x-2 p-10 bg-slate-300 flex-grow">
      <div className={'flex flex-row justify-center flex-wrap'}>
        {trailers.map((trailer) => (
          <div className={'flex flex-col flex-grow items-center space-y-2'}>
            <iframe
              className={'aspect-video w-96'}
              src={trailer.url.replace('watch?v=', 'embed/')}
              title={trailer.name}
              allowFullScreen
            />
            <span>{trailer.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Trailers