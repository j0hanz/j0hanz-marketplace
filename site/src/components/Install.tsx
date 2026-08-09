import { copy } from '../copy';
import { site } from '../site';
import { Command } from './Command';
import styles from './Install.module.css';

// Steps two and three are command shapes rather than one arbitrary plugin's command;
// the exact per-plugin command lives on its catalog card.
const rows = [
  { label: copy.installSteps[0], value: site.addCommand },
  { label: copy.installSteps[1], value: `/plugin install <plugin>@${site.name}` },
  { label: copy.installSteps[2], value: '/<plugin>:<skill>' },
];

export function Install() {
  return (
    <section className="page section" id="install">
      <div className="section-head">
        <h2>{copy.installTitle}</h2>
      </div>

      <div className={styles.ladder}>
        {rows.map((row) => (
          <div className={styles.row} key={row.label}>
            <span>{row.label}</span>
            <Command value={row.value} />
          </div>
        ))}
      </div>
    </section>
  );
}
