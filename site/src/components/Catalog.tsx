import { useState } from 'react';
import { copy, plural } from '../copy';
import { site, type Plugin } from '../site';
import styles from './Catalog.module.css';
import { Command } from './Command';

/** The widest plugin leads the grid and carries the tinted cell. */
const lead = (plugins: Plugin[]) =>
  plugins.reduce((widest, p) => (p.skills.length > widest.skills.length ? p : widest));

export function Catalog() {
  const [category, setCategory] = useState<string | null>(null);
  const visible = category ? site.plugins.filter((p) => p.category === category) : site.plugins;
  const feature = visible.length > 2 ? lead(visible) : null;
  const ordered = feature ? [feature, ...visible.filter((p) => p !== feature)] : visible;

  return (
    <section className="page section" id="plugins">
      <div className="section-head">
        <h2>{copy.catalogTitle}</h2>
        <span className="count">{visible.length}</span>
      </div>

      <div className={styles.chips}>
        <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}>
          {copy.catalogAll}
        </button>
        {site.categories.map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className={styles.grid}>
        {ordered.map((p) => (
          <article
            key={p.name}
            className={[
              styles.card,
              p === feature ? styles.feature : '',
              p.hookEvents.length ? styles.hooks : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className={styles.head}>
              <h3>
                <a href={p.homepage} target="_blank" rel="noreferrer">
                  {p.displayName}
                </a>
              </h3>
              <span className={styles.version}>{p.version}</span>
            </div>
            <p>{p.summary}</p>
            <ul className={styles.meta}>
              <li>{plural(p.skills.length, copy.unit.skill)}</li>
              {p.agents.length > 0 && <li>{plural(p.agents.length, copy.unit.agent)}</li>}
              {p.hookEvents.map((event) => (
                <li key={event}>{event}</li>
              ))}
            </ul>
            <Command value={p.installCommand} stacked />
          </article>
        ))}
      </div>
    </section>
  );
}
