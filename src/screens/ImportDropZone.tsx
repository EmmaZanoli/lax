import { useRef, useState } from 'react';
import styles from './Import.module.css';

interface ImportDropZoneProps {
  onFile: (file: File) => void;
  busy?: boolean;
}

export function ImportDropZone({ onFile, busy = false }: ImportDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`${styles.dropzone} ${over ? styles.dropzoneOver : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Carica un file di ordini"
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <span className={styles.dropIcon} aria-hidden="true">
        ⤓
      </span>
      <span className={styles.dropTitle}>
        {busy ? 'Lettura del file…' : 'Trascina qui il file degli ordini'}
      </span>
      <span className={styles.dropHint}>
        Oppure fai clic per sceglierlo. Il file esportato dal Google Form va bene: le colonne
        le mappi tu al passo successivo.
      </span>
      <span className={styles.dropFormats}>Formati accettati: .csv · .xlsx</span>
      <input
        ref={inputRef}
        className={styles.hiddenInput}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xlsm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = ''; // consente di ricaricare lo stesso file
        }}
      />
    </div>
  );
}

export default ImportDropZone;
