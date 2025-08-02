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
