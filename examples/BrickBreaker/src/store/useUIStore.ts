import { create } from 'zustand';

export type ModalType =
  | 'NONE'
  | 'PAUSE'
  | 'LEVEL_COMPLETE'
  | 'GAME_OVER'
  | 'THEMES'
  | 'CONFIRM_RESTART'
  | 'DAILY_REWARDS';

export interface ToastMessage {
  id: string;
  title: string;
  subtitle?: string;
  type?: 'success' | 'warning' | 'info' | 'error';
}

interface UIState {
  activeModal: ModalType;
  toasts: ToastMessage[];

  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useUIStore = create<UIState>(set => ({
  activeModal: 'NONE',
  toasts: [],

  openModal: (modal: ModalType) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: 'NONE' }),

  showToast: toast =>
    set(state => ({
      toasts: [...state.toasts, { ...toast, id: `toast_${Date.now()}_${Math.random()}` }],
    })),

  dismissToast: id =>
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    })),
}));
