import {useState, useRef, useEffect} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

export interface TabsProps {
  tabs: string[],
  defaultTab: string,
  children: React.ReactNode
}

function Tabs({tabs, defaultTab, children}: TabsProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [currentX, setCurrentX] = useState<number>(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const activeIndex = tabs.indexOf(activeTab)
  
  // Handle touch events for smooth swiping
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
    setCurrentX(0)
    setIsTransitioning(false)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !contentRef.current) return
    
    const currentTouch = e.targetTouches[0].clientX
    const diff = currentTouch - touchStart
    const containerWidth = contentRef.current.offsetWidth
    
    // Convert pixel difference to percentage for smooth movement
    let percentageDiff = (diff / containerWidth) * 100
    
    // Limit the swipe distance and add resistance at boundaries
    if ((activeIndex === 0 && diff > 0) || (activeIndex === tabs.length - 1 && diff < 0)) {
      // Add resistance at boundaries (reduce movement)
      percentageDiff = percentageDiff * 0.3
    }
    
    setCurrentX(percentageDiff)
  }

  const onTouchEnd = () => {
    if (!touchStart) return
    
    setIsTransitioning(true)
    
    // Use percentage-based threshold - 25% of screen width
    const swipeThreshold = 25
    
    const shouldGoNext = currentX < -swipeThreshold && activeIndex < tabs.length - 1
    const shouldGoPrev = currentX > swipeThreshold && activeIndex > 0
    
    if (shouldGoNext) {
      setActiveTab(tabs[activeIndex + 1])
    } else if (shouldGoPrev) {
      setActiveTab(tabs[activeIndex - 1])
    }
    
    // Reset position
    setCurrentX(0)
    setTouchStart(null)
    
    // Remove transition class after animation
    setTimeout(() => setIsTransitioning(false), 300)
  }

  const goToPrevious = () => {
    if (activeIndex > 0) {
      setIsTransitioning(true)
      setCurrentX(0)
      setActiveTab(tabs[activeIndex - 1])
      setTimeout(() => setIsTransitioning(false), 300)
    }
  }

  const goToNext = () => {
    if (activeIndex < tabs.length - 1) {
      setIsTransitioning(true)
      setCurrentX(0)
      setActiveTab(tabs[activeIndex + 1])
      setTimeout(() => setIsTransitioning(false), 300)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Mobile: Dropdown + Navigation */}
      <div className="sm:hidden">
        {/* Dropdown for quick navigation */}
        <div className="relative mb-4">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-gray-100 font-medium text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <span>{activeTab}</span>
            <FontAwesomeIcon 
              icon={faChevronDown} 
              className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>
          
          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsDropdownOpen(false)}
              />
              
              {/* Dropdown menu */}
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setIsTransitioning(true)
                      setCurrentX(0)
                      setActiveTab(tab)
                      setIsDropdownOpen(false)
                      setTimeout(() => setIsTransitioning(false), 300)
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors duration-200 ${
                      activeTab === tab 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation arrows + swipe indicator */}
        <div className="flex items-center justify-between mb-4 px-2">
          <button
            onClick={goToPrevious}
            disabled={activeIndex === 0}
            className={`p-2 rounded-full transition-colors duration-200 ${
              activeIndex === 0 
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-4 h-4" />
          </button>
          
          <div className="flex items-center space-x-2">
            {/* Page indicators */}
            {tabs.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                  index === activeIndex 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={goToNext}
            disabled={activeIndex === tabs.length - 1}
            className={`p-2 rounded-full transition-colors duration-200 ${
              activeIndex === tabs.length - 1 
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faChevronRight} className="w-4 h-4" />
          </button>
        </div>

        {/* Swipe hint */}
        <div className="text-center mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ← Swipe to navigate →
          </p>
        </div>
      </div>

      {/* Desktop: Traditional tabs */}
      <div className="hidden sm:block">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              return (
                <button
                  key={tab}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === tab 
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Content with swipe detection */}
      <div className="py-6 sm:py-8">
        {/* Mobile: Swipeable content */}
        <div className="sm:hidden overflow-hidden">
          <div 
            ref={contentRef}
            className={`flex ${isTransitioning ? 'transition-transform duration-300 ease-out' : ''}`}
            style={{
              transform: `translateX(${-activeIndex * (100 / tabs.length) + currentX}%)`,
              width: `${tabs.length * 100}%`
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* @ts-ignore */}
            {children.map((child, index) => (
              <div 
                key={index}
                className="w-full flex-shrink-0 px-4"
                style={{ width: `${100 / tabs.length}%` }}
              >
                <div className="w-full">
                  {child}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: Traditional single content */}
        <div className="hidden sm:block">
          {/* @ts-ignore */}
          {[...children][tabs.indexOf(activeTab)]}
        </div>
      </div>
    </div>
  )
}

export default Tabs;