import { GithubLogoIcon } from '@phosphor-icons/react';
import { copy } from '../copy';
import { site } from '../site';
import styles from './Nav.module.css';

export function Nav() {
  return (
    <header className={styles.nav}>
      <nav className={`page ${styles.inner}`}>
        <a className={styles.brand} href="#top">
          {site.name}
        </a>
        <div className={styles.links}>
          {copy.navLinks.map((link) => (
            <a className={styles.anchor} key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <a href={site.repoUrl} target="_blank" rel="noreferrer" aria-label={copy.heroSecondary}>
            <GithubLogoIcon size={20} />
          </a>
        </div>
      </nav>
    </header>
  );
}
