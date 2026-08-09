import type { CSSProperties } from 'react';
import { copy } from '../copy';
import { site } from '../site';
import { Command } from './Command';
import styles from './Hero.module.css';

const rise = (index: number) => ({ '--i': index }) as CSSProperties;

const stats = [
  { count: site.totals.plugins, unit: copy.unit.plugin },
  { count: site.totals.skills, unit: copy.unit.skill },
  { count: site.totals.agents, unit: copy.unit.agent },
];

export function Hero() {
  return (
    <section className={`page ${styles.hero}`} id="top">
      <div className={styles.copy}>
        <h1 className="rise" style={rise(0)}>
          {copy.heroTitle}
        </h1>
        <p className="rise" style={rise(1)}>
          {copy.heroBody}
        </p>
        <div className={`${styles.cta} rise`} style={rise(2)}>
          <a className="btn btn-primary" href={copy.navLinks[0].href}>
            {copy.heroPrimary}
          </a>
          <a className="btn btn-ghost" href={site.repoUrl} target="_blank" rel="noreferrer">
            {copy.heroSecondary}
          </a>
        </div>
        <div className={`${styles.commandSlot} rise`} style={rise(3)}>
          <Command value={site.addCommand} />
        </div>
      </div>
      <ul className={`${styles.stats} rise`} style={rise(4)}>
        {stats.map((stat) => (
          <li key={stat.unit}>
            <span>{stat.count}</span>
            {stat.count === 1 ? stat.unit : `${stat.unit}s`}
          </li>
        ))}
      </ul>
    </section>
  );
}
