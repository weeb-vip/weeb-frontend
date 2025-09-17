import { writable } from 'svelte/store';

export interface ToastData {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  duration?: number;
  anime?: {
    id: string;
    titleEn?: string | null;
    titleJp?: string | null;
    imageUrl?: string | null;
  };
}

interface ToastStore {
  toasts: ToastData[];
  mobileQueue: ToastData[];
}

const createToastStore = () => {
  const { subscribe, update } = writable<ToastStore>({
    toasts: [],
    mobileQueue: []
  });

  return {
    subscribe,
    showToast: (toastData: Omit<ToastData, 'id'>, isMobile: boolean = false) => {
      const id = Date.now().toString() + Math.random().toString(36);
      const newToast: ToastData = {
        ...toastData,
        id,
        duration: toastData.duration || 6000
      };

      update(store => {
        if (isMobile) {
          // On mobile, queue toasts and show them one at a time
          const updatedQueue = [...store.mobileQueue, newToast];

          // If no toast is currently showing, start showing this one
          if (store.toasts.length === 0) {
            return {
              toasts: [newToast],
              mobileQueue: updatedQueue
            };
          } else {
            return {
              ...store,
              mobileQueue: updatedQueue
            };
          }
        } else {
          // On desktop, show all toasts simultaneously
          return {
            ...store,
            toasts: [...store.toasts, newToast]
          };
        }
      });
    },
    removeToast: (id: string, isMobile: boolean = false) => {
      update(store => {
        const updatedToasts = store.toasts.filter(toast => toast.id !== id);

        if (isMobile) {
          // Remove from queue as well
          const updatedQueue = store.mobileQueue.filter(toast => toast.id !== id);

          // If there are more toasts in queue, show the next one
          if (updatedQueue.length > 0 && updatedToasts.length === 0) {
            const nextToast = updatedQueue[0];
            return {
              toasts: [nextToast],
              mobileQueue: updatedQueue
            };
          }

          return {
            toasts: updatedToasts,
            mobileQueue: updatedQueue
          };
        } else {
          return {
            ...store,
            toasts: updatedToasts
          };
        }
      });
    },
    clear: () => {
      update(() => ({ toasts: [], mobileQueue: [] }));
    }
  };
};

export const toastStore = createToastStore();