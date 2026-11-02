import { createContext } from 'react'

export type ToastMessage = { id: number; message: string; type: 'success' | 'error' }
export type ToastContextValue = { notify: (message: string, type?: ToastMessage['type']) => void }

export const ToastContext = createContext<ToastContextValue | null>(null)
