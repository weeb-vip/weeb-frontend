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
  const tabsRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchStartY, setTouchStartY] = useState<number | null>(null)
  const [currentX, setCurrentX] = useState<number>(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isSticky, setIsSticky] = useState(false)

  const activeIndex = tabs.indexOf(activeTab)

  // Handle sticky behavior on scroll
  useEffect(() => {
    let tabsOriginalTop: number | null = null
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!tabsRef.current) {
            ticking = false
            return
          }

          const scrollTop = window.pageYOffset || document.documentElement.scrollTop

          // Store original position on first calculation (only when not sticky)
          if (tabsOriginalTop === null) {
            const tabsRect = tabsRef.current.getBoundingClientRect()
            tabsOriginalTop = tabsRect.top + scrollTop
          }

          // Make sticky when scrolled past the tabs position, unsticky when scrolled back up
          if (tabsOriginalTop !== null) {
            const shouldBeSticky = scrollTop > tabsOriginalTop - 100 // 100px offset from top
            setIsSticky(shouldBeSticky)
          }

          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Check initial position

    return () => window.removeEventListener('scroll', handleScroll)
  }, []) // Remove isSticky dependency to avoid re-creating effect

  // Handle touch events for smooth swiping
  const onTouchStart = (e: React.TouchEvent) => {
    // Only handle touches that start on non-interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, select, textarea, [role="button"], .character-card')) {
      return
    }

    setTouchStart(e.targetTouches[0].clientX)
    setTouchStartY(e.targetTouches[0].clientY)
    setCurrentX(0)
    setIsTransitioning(false)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !touchStartY || !contentRef.current) return

    const currentTouch = e.targetTouches[0].clientX
    const currentTouchY = e.targetTouches[0].clientY
    const diff = currentTouch - touchStart
    const diffY = currentTouchY - touchStartY
    const containerWidth = contentRef.current.offsetWidth

    // Only handle horizontal swipes (ignore if more vertical than horizontal)
    const verticalDiff = Math.abs(diffY)
    const horizontalDiff = Math.abs(diff)

    // If the gesture is more vertical than horizontal, don't interfere
    if (verticalDiff > horizontalDiff && verticalDiff > 15) {
      return
    }

    // Only start handling swipe after minimum threshold
    if (horizontalDiff < 5) {
      return
    }

    // Prevent default scrolling when we're handling the swipe
    e.preventDefault()

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

    // Use percentage-based threshold - 15% of screen width (lower threshold for easier swiping)
    const swipeThreshold = 15

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
    setTouchStartY(null)

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
      {/* Spacer to prevent content jump when tabs become sticky */}
      {isSticky && <div className="sm:hidden h-16" />}

      {/* Mobile: Dropdown + Navigation */}
      <div
        ref={tabsRef}
        className={`sm:hidden transition-all duration-200 ${
          isSticky 
            ? 'fixed left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 shadow-sm' 
            : ''
        }`}
        style={isSticky ? { top: '10.5rem' } : undefined}
      >
        {/* Compact navigation with chevrons flanking dropdown */}
        <div className="flex items-center justify-center space-x-3">
          {/* Left chevron */}
          <button
            onClick={goToPrevious}
            disabled={activeIndex === 0}
            className={`p-1.5 rounded-full transition-colors duration-200 ${
              activeIndex === 0 
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
          </button>

          {/* Dropdown for quick navigation */}
          <div className="relative flex-1 max-w-xs">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-gray-900 dark:text-gray-100 font-medium text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 text-sm"
            >
              <span className="truncate">{activeTab}</span>
              <FontAwesomeIcon
                icon={faChevronDown}
                className={`w-3 h-3 ml-2 flex-shrink-0 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
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
                      className={`w-full text-left px-3 py-2 text-sm transition-colors duration-200 ${
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

          {/* Right chevron */}
          <button
            onClick={goToNext}
            disabled={activeIndex === tabs.length - 1}
            className={`p-1.5 rounded-full transition-colors duration-200 ${
              activeIndex === tabs.length - 1 
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
          </button>
        </div>

        {/* Page indicators */}
        <div className="flex items-center justify-center space-x-1.5 mt-2">
          {tabs.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                index === activeIndex 
                  ? 'bg-blue-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
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
