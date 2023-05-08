import {Artwork} from "../../../services/api/details";
import Modal from "../../../components/Modal";
import {useState} from "react";


function Artworks({artworks}: { artworks: Artwork[] }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)


  return (
    <div className="flex flex-col space-x-2 py-16 bg-slate-300 flex-grow">

      <div
        className={'w-full columns-2 sm:columns-3 md:columns-3 lg:columns-3 xl:columns-4 2xl:columns-6 gap-x-4 gap-y-4 m-auto justify-center cursor-pointer'}>
        {artworks.map((artwork: Artwork) => (
          <div  className={"bg-white my-4 rounded-md overflow-hidden drop-shadow-sm min-w-64 m-h-16"} onClick={() => {
            setSelectedArtwork(artwork)
            setShowModal(true)
          }}>
            { /* @ts-ignore */}
            <img src={`${global.config.api_host}/artwork/${artwork.id}/thumbnail`}
              alt={artwork.id.toString()}
              className={""}
              style={{width: "100%"}}
              onError={({ currentTarget }) => {
                currentTarget.onerror = null; // prevents looping
                currentTarget.src="/assets/not found.jpg";
              }}
            />
          </div>
        ))}
      </div>
      <Modal title={"Artwork"} isOpen={showModal} closeFn={() => setShowModal(false)} options={[
        {
          label: "Close",
          onClick: () => setShowModal(false)
        }
      ]}
      className={"w-screen h-screen"}
      >
        <div className={"flex flex-col items-center"}>
          { /* @ts-ignore */}
          <img src={`${global.config.api_host}/artwork/${selectedArtwork?.id}/image`}
            alt={selectedArtwork?.id.toString()}
            className={"max-w-none"}
            style={{maxHeight: '100%', maxWidth: '100%'}}
            onError={({ currentTarget }) => {
              currentTarget.onerror = null; // prevents looping
              currentTarget.src="/assets/not found.jpg";
            }}
          />
        </div>
      </Modal>

    </div>
  )
}

export default Artworks