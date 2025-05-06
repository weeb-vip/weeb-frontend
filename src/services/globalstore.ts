import { create } from 'zustand'

export const useLoggedInStore = create((set) => ({
  isLoggedIn: false,
  setLoggedIn: () => set(() => ({ isLoggedIn: true })),
  logout: () => set({ isLoggedIn: false }),
}))


export const useLoginModalStore = create((set) => ({
  isOpen: false,
  open: () => set(() => ({ isOpen: true })),
  close: () => set(() => ({ isOpen: false })),
}))
