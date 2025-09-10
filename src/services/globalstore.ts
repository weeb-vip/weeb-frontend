import {create} from 'zustand'

interface LoggedInState {
  isLoggedIn: boolean
  isAuthInitialized: boolean
  setLoggedIn: () => void
  logout: () => void
  setAuthInitialized: () => void
}

interface LoginModalState {
  isOpen: boolean
  register: boolean
  openLogin: () => void
  openRegister: () => void
  close: () => void
}

interface DarkModeState {
  isDarkMode: boolean
  toggleDarkMode: () => void
  setDarkMode: (dark: boolean) => void
  initializeTheme: () => void
  useSystemTheme: () => void
}

export const useLoggedInStore = create<LoggedInState>((set) => ({
  isLoggedIn: false,
  isAuthInitialized: false,
  setLoggedIn: () => set(() => ({isLoggedIn: true, isAuthInitialized: true})),
  logout: () => set({isLoggedIn: false, isAuthInitialized: true}),
  setAuthInitialized: () => set({isAuthInitialized: true}),
}))

export const useLoginModalStore = create<LoginModalState>((set) => ({
  isOpen: false,
  register: false,
  openLogin: () => set(() => ({isOpen: true, register: false})),
  openRegister: () => set(() => ({isOpen: true, register: true})),
  close: () => set(() => ({isOpen: false, register: false})),
}))

const updateThemeColor = (isDark: boolean) => {
  if (typeof window !== 'undefined') {
    // Update theme-color meta tag for PWA status bar
    const existingTag = document.querySelector('meta[name="theme-color"]:not([media])')
    if (existingTag) {
      existingTag.setAttribute('content', isDark ? '#111827' : '#ffffff')
    } else {
      // Create the meta tag if it doesn't exist
      const metaTag = document.createElement('meta')
      metaTag.name = 'theme-color'
      metaTag.content = isDark ? '#111827' : '#ffffff'
      document.head.appendChild(metaTag)
    }
  }
}

const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false
  
  const savedTheme = localStorage.getItem('darkMode')
  if (savedTheme !== null) {
    return savedTheme === 'true'
  }
  
  // If no saved preference, use system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useDarkModeStore = create<DarkModeState>((set, get) => ({
  isDarkMode: getInitialTheme(),
  initializeTheme: () => {
    if (typeof window !== 'undefined') {
      const initialTheme = getInitialTheme()
      set({ isDarkMode: initialTheme })
      
      if (initialTheme) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      updateThemeColor(initialTheme)
      
      // Listen for system theme changes if no saved preference
      const savedTheme = localStorage.getItem('darkMode')
      if (savedTheme === null) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = (e: MediaQueryListEvent) => {
          const systemDark = e.matches
          set({ isDarkMode: systemDark })
          if (systemDark) {
            document.documentElement.classList.add('dark')
          } else {
            document.documentElement.classList.remove('dark')
          }
          updateThemeColor(systemDark)
        }
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
      }
    }
  },
  toggleDarkMode: () => {
    const newDarkMode = !get().isDarkMode
    set({ isDarkMode: newDarkMode })
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', newDarkMode.toString())
      if (newDarkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      updateThemeColor(newDarkMode)
    }
  },
  setDarkMode: (dark: boolean) => {
    set({ isDarkMode: dark })
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', dark.toString())
      if (dark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      updateThemeColor(dark)
    }
  },
  useSystemTheme: () => {
    if (typeof window !== 'undefined') {
      // Clear saved preference to use system theme
      localStorage.removeItem('darkMode')
      
      // Get current system preference
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      set({ isDarkMode: systemDark })
      
      if (systemDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      updateThemeColor(systemDark)
      
      // Set up listener for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemDark = e.matches
        set({ isDarkMode: newSystemDark })
        if (newSystemDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
        updateThemeColor(newSystemDark)
      }
      
      // Remove any existing listener first
      mediaQuery.removeEventListener('change', handleChange)
      mediaQuery.addEventListener('change', handleChange)
    }
  },
}))
