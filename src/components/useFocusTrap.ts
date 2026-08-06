import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibilità dei modali. Mentre `active` è true:
 *  - porta il focus dentro `containerRef` all'apertura (se non è già lì);
 *  - mantiene Tab / Shift+Tab dentro il contenitore (ciclo);
 *  - alla chiusura RIPRISTINA il focus all'elemento che l'aveva prima.
 *
 * Il listener Tab è su `document` (fase di cattura) e legge il contenitore in
 * modo "live": così funziona anche se il pannello entra nel DOM dopo
 * l'attivazione (es. Drawer con animazione, dove all'apertura il pannello non è
 * ancora montato) e cattura il focus da ripristinare PRIMA che il contenuto del
 * modale se lo prenda.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  containerRef: RefObject<T | null>,
): void {
  useEffect(() => {
    if (!active) return;

    // Chi aveva il focus prima dell'apertura: da ripristinare alla chiusura.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = (c: HTMLElement) =>
      Array.from(c.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );

    // Porta il focus nel modale, se non è già al suo interno e il pannello esiste.
    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      (focusable(container)[0] ?? container).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const c = containerRef.current;
      if (!c) return;
      const items = focusable(c);
      if (items.length === 0) {
        e.preventDefault();
        c.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const el = document.activeElement;
      if (e.shiftKey) {
        if (el === first || !c.contains(el)) {
          e.preventDefault();
          last.focus();
        }
      } else if (el === last || !c.contains(el)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [active, containerRef]);
}
