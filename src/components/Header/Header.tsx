import Button, {ButtonColor} from "../Button";
import Search from "../Search";
import { searchResult} from "../../services/api/search";
import api from "../../services/api";
import {Link, useNavigate} from "react-router-dom";

function Header() {
  const navigate = useNavigate()
  return (
    <>
      <div className="flex flex-row items-center justify-between p-4 bg-white-800 border-b border-gray-200">
        <div className="flex flex-row items-center space-x-4">
          <Link to={"/"}>
            <div className="flex flex-row items-center justify-center bg-gray-200"
                 style={{width: '112px', height: '40px'}}>
              <img src="/logo192.png" alt="logo" style={{width: '112', height: '40px'}}/>
            </div>
          </Link>
          <span className="text-xl font-normal">Anime</span>
        </div>
        <div className="flex flex-row items-center space-x-4">
          <Search<searchResult>
            searchFunction={api.search.search}
            className="relative w-72 z-10"
            parseSearchResult={(item: searchResult) => item.name}
            mapFunction={
              (selectItem) => (item: searchResult) => (
                <div onClick={() => {
                  selectItem(item)
                  navigate(`/show/${item.id.split('-')[0].toLowerCase()}/${item.id.replace(/[^0-9.]/gm, '')}`)
                }}
                     className="flex flex-row items-center space-x-2 p-2"
                >
                  <img
                    src={`${(global as any).config.api_host}/show/anime/${item.id.split('-')[0].toLowerCase()}/${item.id.replace(/[^0-9.]/gm, '')}/poster`}
                    alt={item.name}
                    style={{height: '50px'}}
                    className={"aspect-2/3 m-2"}
                  />
                  <div className={"flex flex-col flex-shrink"}>
                    <span>{item.name}</span>
                    <span>{item.year}</span>
                  </div>
                </div>
              )
            }/>
          <Button color={ButtonColor.blue} showLabel={true} label={"Login"} onClick={() => {
          }} icon={null}/>
          <Button color={ButtonColor.transparent} showLabel={true} label={"Register"} onClick={() => {
          }} icon={null}/>
        </div>
      </div>
    </>
  )
}

export {Header as default}