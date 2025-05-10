import {create} from 'zustand'

export const useLoggedInStore = create((set) => ({
  isLoggedIn: false,
  setLoggedIn: () => set(() => ({isLoggedIn: true})),
  logout: () => set({isLoggedIn: false}),
}))


export const useLoginModalStore = create((set) => ({
  isOpen: false,
  openLogin: () => set(() => ({isOpen: true, register: false})),
  close: () => set(() => ({isOpen: false, register: false})),
  register: false,
  openRegister: () => set(() => ({isOpen: true, register: true})),
}))
