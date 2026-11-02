import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, X, XCircle } from 'lucide-react'
import { ToastContext, type ToastMessage } from './toast-context'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])
  const notify = useCallback((message: string, type: ToastMessage['type'] = 'success') => {
    const id = Date.now() + Math.random()
    setMessages((current) => [...current, { id, message, type }])
    window.setTimeout(
      () => setMessages((current) => current.filter((item) => item.id !== id)),
      4500,
    )
  }, [])
  const value = useMemo(() => ({ notify }), [notify])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {messages.map((item) => (
          <div className={`toast toast-${item.type}`} role="status" key={item.id}>
            {item.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{item.message}</span>
            <button
              type="button"
              aria-label="Fechar notificação"
              onClick={() => setMessages((current) => current.filter(({ id }) => id !== item.id))}
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
