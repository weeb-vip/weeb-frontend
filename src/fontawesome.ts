import { library, config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'

// Configure FontAwesome
config.autoAddCss = false // We'll import the CSS manually
config.familyPrefix = 'fa'
config.replacementClass = 'svg-inline--fa'

// Import all the icons that are being used in the project
import {
  faBars,
  faSearch,
  faMoon,
  faSun,
  faUser,
  faLock,
  faArrowLeft,
  faEnvelope,
  faChevronDown,
  faTrash,
  faEllipsis,
  faPlus,
  faCalendar,
  faClapperboard,
  faClock,
  faBookmark,
  faChevronRight,
  faPlay,
  faCalendarDays,
  faX,
  faCheckCircle,
  faCircleChevronDown,
  faCircleChevronUp,
  faChevronUp,
  faEye,
  faEyeSlash
} from '@fortawesome/free-solid-svg-icons'

// Add icons to the library
library.add(
  faBars,
  faSearch,
  faMoon,
  faSun,
  faUser,
  faLock,
  faArrowLeft,
  faEnvelope,
  faChevronDown,
  faTrash,
  faEllipsis,
  faPlus,
  faCalendar,
  faClapperboard,
  faClock,
  faBookmark,
  faChevronRight,
  faPlay,
  faCalendarDays,
  faX,
  faCheckCircle,
  faCircleChevronDown,
  faCircleChevronUp,
  faChevronUp,
  faEye,
  faEyeSlash
)