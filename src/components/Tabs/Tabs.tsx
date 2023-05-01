import {useState} from "react";

export interface TabsProps {
  tabs: string[],
  defaultTab: string,
  children: React.ReactNode
}

function Tabs({tabs, defaultTab, children}: TabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  return (
    <div className="flex flex-col">
      <div className="flex flex-row w-full rounded-full overflow-hidden">
        {tabs.map((tab) => {
          return (
            <button
              key={tab}
              className={`px-4 py-2 ${activeTab === tab ? 'bg-gray-200' : 'bg-gray-100'} hover:bg-gray-200 flex-grow`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col">
        { /* @ts-ignore */}
        {[...children][tabs.indexOf(activeTab)]}
      </div>
    </div>
  )
}

export default Tabs;