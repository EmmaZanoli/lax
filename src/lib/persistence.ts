/**
 * Sicurezza dei dati. L'app tiene l'UNICA copia della giornata in IndexedDB, su
 * un solo browser di un solo dispositivo: la perdita è il rischio di prodotto
 * più serio. Due difese, entrambe qui:
 *  1) chiedere al browser lo storage PERSISTENTE (non sfrattabile sotto pressione
 *     di spazio) — `requestPersistentStorage`;
 *  2) sapere quando c'è lavoro non ancora messo al sicuro in un backup, per
 *     nudgiare l'utente — `needsBackup`.
 */

/**
 * Chiede al browser di non sfrattare i dati (IndexedDB) sotto pressione di
 * spazio. Idempotente e tollerante: se già concesso non richiede di nuovo, e in
 * assenza dell'API (browser vecchi, contesti non sicuri) non fa nulla.
 * Non blocca l'avvio: va lanciata "fire-and-forget". Ritorna lo stato finale.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Metadati di backup tenuti (persistiti) nello store, come timestamp ISO. */
export interface BackupMeta {
  /** Ultima esportazione di un backup JSON completo. */
  lastBackupAt?: string;
  /** Ultima mutazione dei dati (import, ritiro, pagamento, catalogo…). */
  lastMutatedAt?: string;
}

/**
 * true se c'è lavoro da mettere al sicuro in un backup:
 *  - ci sono dati (buyer) e non è mai stato esportato un backup, oppure
 *  - ci sono state modifiche dopo l'ultimo backup.
 * Con IndexedDB vuoto (nessun buyer) non c'è nulla da salvare ⇒ false.
 */
export function needsBackup(hasData: boolean, meta: BackupMeta): boolean {
  if (!hasData) return false;
  if (!meta.lastBackupAt) return true;
  if (!meta.lastMutatedAt) return false;
  return new Date(meta.lastMutatedAt).getTime() > new Date(meta.lastBackupAt).getTime();
}
