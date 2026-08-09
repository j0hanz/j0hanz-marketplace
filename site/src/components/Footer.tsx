import { copy } from '../copy';
import { site } from '../site';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`page ${styles.inner}`}>
        <span>{site.name}</span>
        <span>{copy.footerNote}</span>
        <a href={site.repoUrl} target="_blank" rel="noreferrer">
          {site.repo}
        </a>
      </div>
    </footer>
  );
}
