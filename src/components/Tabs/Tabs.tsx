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
              className={`px-4 py-2 text-gray-900 dark:text-gray-100 ${activeTab === tab ? 'bg-gray-200 dark:bg-gray-600' : 'bg-gray-100 dark:bg-gray-700'} hover:bg-gray-200 dark:hover:bg-gray-600 flex-grow transition-colors duration-300`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col py-8">
        { /* @ts-ignore */}
        {[...children][tabs.indexOf(activeTab)]}
      </div>
    </div>
  )
}

export default Tabs;