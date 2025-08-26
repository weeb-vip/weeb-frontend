import {create} from 'zustand'

interface LoggedInState {
  isLoggedIn: boolean
  setLoggedIn: () => void
  logout: () => void
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
}

export const useLoggedInStore = create<LoggedInState>((set) => ({
  isLoggedIn: false,
  setLoggedIn: () => set(() => ({isLoggedIn: true})),
  logout: () => set({isLoggedIn: false}),
}))

export const useLoginModalStore = create<LoginModalState>((set) => ({
  isOpen: false,
  register: false,
  openLogin: () => set(() => ({isOpen: true, register: false})),
  openRegister: () => set(() => ({isOpen: true, register: true})),
  close: () => set(() => ({isOpen: false, register: false})),
}))

export const useDarkModeStore = create<DarkModeState>((set, get) => ({
  isDarkMode: typeof window !== 'undefined' ? localStorage.getItem('darkMode') === 'true' : false,
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
    }
  },
}))
