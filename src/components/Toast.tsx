import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import styles from './Toast.module.css';

type ToastTone = 'default' | 'brass' | 'unpaid';

/** Azione facoltativa mostrata come pulsante nel toast (es. "Salva anche un backup"). */
interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  action?: ToastAction;
  /** Durata prima della chiusura automatica (ms). */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ToastApi {
  /** Mostra un toast in alto al centro; con `options.action` diventa un suggerimento cliccabile. */
  show: (message: string, tone?: ToastTone, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = 'default', options?: ToastOptions) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, tone, action: options?.action }]);
      // I toast con azione restano più a lungo, per dare il tempo di cliccare.
      const duration = options?.duration ?? (options?.action ? 8000 : 2600);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast} data-tone={t.tone}>
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className={styles.toastAction}
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast va usato dentro <ToastProvider>');
  return ctx;
}

export default ToastProvider;
