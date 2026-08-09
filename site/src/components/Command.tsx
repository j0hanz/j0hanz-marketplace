import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { copy } from '../copy';
import styles from './Command.module.css';

/** A real, selectable command with a copy button. Not a picture of a terminal. */
export function Command({ value, stacked = false }: { value: string; stacked?: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const write = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard denied or unavailable (insecure context). The command stays
      // selectable, so there is nothing to recover from.
    }
  };

  return (
    <div className={stacked ? `${styles.cmd} ${styles.stacked}` : styles.cmd}>
      <code className={styles.code}>{value}</code>
      <button
        type="button"
        className={styles.button}
        onClick={write}
        aria-label={`${copy.copyLabel} ${value}`}
      >
        {copied ? <CheckIcon weight="bold" /> : <CopyIcon />}
        <span>{copied ? copy.copiedLabel : copy.copyLabel}</span>
      </button>
    </div>
  );
}
