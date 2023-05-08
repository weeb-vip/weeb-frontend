import {Character} from "../../../services/api/details";
import Modal from "../../../components/Modal";
import {useState} from "react";

function Characters({characters}: { characters: Character[] }) {
  const [showModal, setShowModal] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)


  return (
    <div className="flex flex-row space-x-2 p-10 bg-slate-300 flex-grow">

      <div
        className={'w-full grid xs:grid-cols-[repeat(auto-fit,50%)] sm:grid-cols-[repeat(auto-fit,_33.333333%)] lg:grid-cols-[repeat(auto-fit,_25%)] xl:grid-cols-[repeat(auto-fit,_16.66666%)] 2xl:grid-cols-[repeat(auto-fit,_12.5%)] m-auto p-24 justify-center gap-16 cursor-pointer'}>
        {characters.map((character) => (
          <div className={'flex flex-col space-y-2'}
               onClick={() => {
                 setSelectedCharacter(character)
                 setShowModal(true)
               }}
          >
            { /* @ts-ignore */}
            <img src={`${global.config.api_host}/character/${character.id}/artwork`}
              alt={character.id.toString()}
              className={"max-w-none"}
              style={{height: '322px', width: '225px'}}
              onError={({ currentTarget }) => {
                currentTarget.onerror = null; // prevents looping
                currentTarget.src="/assets/not found.jpg";
              }}
            />
            <span>{character.name}</span>
          </div>
        ))}
      </div>
      <Modal title={"Character"} isOpen={showModal} closeFn={() => setShowModal(false)}
             options={[
               {
                 label: "Close",
                 onClick: () => setShowModal(false)
               }
             ]}
      >
        <div className="flex flex-col space-y-2">
          { /* @ts-ignore */}
          <img src={`${global.config.api_host}/character/${selectedCharacter?.id}/artwork`}
            alt={selectedCharacter?.id.toString()}
            className={"max-w-none"}
            style={{height: '322px', width: '225px'}}
            onError={({ currentTarget }) => {
              currentTarget.onerror = null; // prevents looping
              currentTarget.src="/assets/not found.jpg";
            }}
          />
          <span>{selectedCharacter?.name}</span>

          <div className="flex flex-row space-x-2">
            <div className="flex flex-col space-y-2">
              <span className="font-bold">Name</span>
              <span>{selectedCharacter?.name}</span>

              <span className="font-bold">Actor</span>
              <span>{selectedCharacter?.personName}</span>


            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default Characters