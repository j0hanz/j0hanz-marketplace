import { CaretDownIcon } from '@phosphor-icons/react';
import { copy, plural } from '../copy';
import { site } from '../site';
import styles from './SkillIndex.module.css';

export function SkillIndex() {
  return (
    <section className="page section" id="skills">
      <div className="section-head">
        <h2>{copy.skillsTitle}</h2>
        <span className="count">{site.totals.skills}</span>
      </div>

      <div className={styles.index}>
        {site.plugins.map((p, i) => (
          <details key={p.name} open={i === 0}>
            <summary>
              <span>{p.displayName}</span>
              <span className={styles.counts}>
                <span className="count">{plural(p.skills.length, copy.unit.skill)}</span>
                {p.agents.length > 0 && (
                  <span className="count">{plural(p.agents.length, copy.unit.agent)}</span>
                )}
              </span>
              <CaretDownIcon className={styles.caret} size={16} />
            </summary>
            <ul>
              {p.skills.map((skill) => (
                <li key={skill.name}>
                  <div className={styles.names}>
                    <code>{skill.command ?? skill.name}</code>
                    {skill.argumentHint && (
                      <code className={styles.hint}>{skill.argumentHint}</code>
                    )}
                    {!skill.invocable && <span className={styles.tag}>{copy.modelLoadedTag}</span>}
                  </div>
                  <p>{skill.description}</p>
                </li>
              ))}
              {p.agents.map((agent) => (
                <li key={agent.name}>
                  <div className={styles.names}>
                    <code>{agent.name}</code>
                    <span className={styles.tag}>{copy.agentTag}</span>
                  </div>
                  <p>{agent.description}</p>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
