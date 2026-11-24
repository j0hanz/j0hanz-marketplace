// Course helper for the teach skill: reads a course folder and reports on it.
// `node course.mjs state [dir]` prints a resume report; `index [dir]` writes index.html.
// Teaching must work without this file: it only reads and renders, it holds no teaching logic.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const fwd = (p) => p.replace(/\\/g, '/');
const STARTERS = fwd(fileURLToPath(new URL('./assets/', import.meta.url))).replace(/\/$/, '');
const NAME = /^(\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.(html|md)$/;

const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const list = (p) => (existsSync(p) ? readdirSync(p).sort() : []);
const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function meta(text, fallback) {
  const title = /<title>([\s\S]*?)<\/title>/i.exec(text)?.[1].trim();
  const desc = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(text)?.[1];
  return { title: title ? decode(title) : fallback, summary: desc ? decode(desc).trim() : '' };
}

function numbered(dir, sub, ext) {
  const out = [];
  for (const name of list(join(dir, sub))) {
    const m = NAME.exec(name);
    if (m && m[3] === ext) out.push({ file: `${sub}/${name}`, number: m[1], slug: m[2] });
  }
  return out;
}

function parseGlossary(text) {
  const terms = [];
  let group = null;
  let cur = null;
  for (const line of text.split('\n')) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    const t = /^\*\*(.+?)\*\*:\s*$/.exec(line);
    if (h) {
      group = h[1] === 'Terms' ? null : h[1];
      cur = null;
    } else if (t) {
      cur = { group, term: t[1], definition: '', avoid: null };
      terms.push(cur);
    } else if (!line.trim()) {
      cur = null;
    } else if (cur) {
      const a = /^_Avoid_:\s*(.*)$/.exec(line);
      if (a) cur.avoid = a[1].trim();
      else cur.definition = cur.definition ? `${cur.definition} ${line.trim()}` : line.trim();
    }
  }
  return terms;
}

export function readCourse(dir) {
  const root = fwd(resolve(dir));
  const has = (f) => existsSync(join(root, f));
  const mission = has('MISSION.md') ? read(join(root, 'MISSION.md')) : '';
  const topic = /^# Mission:\s*(.+?)\s*$/m.exec(mission)?.[1] ?? basename(root);
  const whyBody = /^## Why\s*\n([\s\S]*?)(?=^#|(?![\s\S]))/m.exec(mission)?.[1];
  const why =
    whyBody
      ?.trim()
      .split(/\n\s*\n/)[0]
      .split('\n')
      .map((l) => l.trim())
      .join(' ') || null;

  const lessons = numbered(root, 'lessons', 'html').map((l) => ({
    ...l,
    ...meta(read(join(root, l.file)), l.slug),
    review: l.slug.startsWith('review-'),
    modified: statSync(join(root, l.file)).mtimeMs,
  }));
  const records = numbered(root, 'learning-records', 'md').map((r) => {
    const text = read(join(root, r.file));
    const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';
    return {
      ...r,
      title: /^# (.+?)\s*$/m.exec(text)?.[1] ?? r.slug,
      superseded: /^status:\s*superseded/im.test(front),
    };
  });
  const references = list(join(root, 'reference'))
    .filter((n) => n.endsWith('.html'))
    .map((n) => {
      const file = `reference/${n}`;
      return { file, ...meta(read(join(root, file)), n.slice(0, -5)) };
    });

  return {
    dir: root,
    topic,
    why,
    lessons,
    references,
    records,
    glossary: has('GLOSSARY.md') ? parseGlossary(read(join(root, 'GLOSSARY.md'))) : null,
    has: {
      mission: has('MISSION.md'),
      resources: has('RESOURCES.md'),
      glossary: has('GLOSSARY.md'),
      notes: has('NOTES.md'),
    },
    assets: list(join(root, 'assets')),
  };
}

function assetsLine(assets) {
  if (!assets.length) return `assets: missing; starters in ${STARTERS}`;
  const missing = list(STARTERS).filter((n) => !assets.includes(n));
  const have = `assets: ${assets.join(', ')}`;
  return missing.length ? `${have}; missing ${missing.join(', ')}; starters in ${STARTERS}` : have;
}

export function formatState(c, now = Date.now()) {
  const next = (items) =>
    String(items.length ? Number(items.at(-1).number) + 1 : 1).padStart(4, '0');
  const tail = (label, items) =>
    items.length
      ? `${label}: ${items.length}, last ${items.at(-1).number}-${items.at(-1).slug} "${items.at(-1).title}", next ${next(items)}`
      : `${label}: 0, next 0001`;
  const plural = (n) => `${n} lesson${n === 1 ? '' : 's'}`;
  const review = () => {
    const at = c.lessons.findLastIndex((l) => l.review);
    if (at === -1) return `review: none yet, ${plural(c.lessons.length)}`;
    const r = c.lessons[at];
    const days = Math.max(0, Math.floor((now - r.modified) / 86_400_000));
    return `review: last ${r.number}-${r.slug}, ${plural(c.lessons.length - at - 1)} since, ${days} day${days === 1 ? '' : 's'} ago`;
  };
  const gone = c.records.filter((r) => r.superseded).map((r) => `${r.number}-${r.slug}`);
  const lines = [
    `course: ${c.dir}`,
    c.has.mission ? `mission: ${c.topic}: ${c.why ?? ''}` : 'mission: missing',
    tail('lessons', c.lessons),
    review(),
    tail('records', c.records),
  ];
  if (gone.length) lines.push(`superseded: ${gone.join(', ')}`);
  lines.push(
    c.references.length
      ? `references: ${c.references.length} (${c.references.map((r) => r.file).join(', ')})`
      : 'references: 0',
    c.glossary ? `glossary: ${c.glossary.length} terms` : 'glossary: missing',
    `resources: ${c.has.resources ? 'present' : 'missing'}`,
    `notes: ${c.has.notes ? 'present' : 'missing'}`,
    assetsLine(c.assets),
  );
  return lines.join('\n');
}

const inline = (s) =>
  esc(s)
    .split(/(`[^`]+`)/)
    .map((part, i) =>
      i % 2
        ? `<code>${part.slice(1, -1)}</code>`
        : part
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>'),
    )
    .join('');

export function renderIndex(c) {
  const para = (s) => (s ? `<p>${esc(s)}</p>` : '');
  const link = (l) =>
    `<a href="${esc(l.file)}"><span class="num">${l.number}</span> ${esc(l.title)}</a>`;
  const last = c.lessons.at(-1);
  const out = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${esc(c.topic)}</title>`,
    '<link rel="stylesheet" href="assets/style.css" />',
    '</head>',
    '<body class="home">',
    '<main>',
    `<header><h1>${esc(c.topic)}</h1>${c.why ? `<p class="mission">${esc(c.why)}</p>` : ''}</header>`,
  ];
  if (last) {
    out.push(
      `<section class="continue"><h2>Continue</h2>`,
      `<a class="card" href="${esc(last.file)}"><span class="num">${last.number}</span> ${esc(last.title)}</a>`,
      `${para(last.summary)}</section>`,
    );
  }
  out.push('<section><h2>Lessons</h2>');
  if (c.lessons.length) {
    out.push('<ol class="lessons">');
    for (const l of c.lessons) {
      out.push(
        `<li>${link(l)}${l.review ? ' <span class="tag">Review</span>' : ''}${para(l.summary)}</li>`,
      );
    }
    out.push('</ol>');
  } else out.push('<p>No lessons yet.</p>');
  out.push('</section>');
  if (c.references.length) {
    out.push('<section><h2>Reference</h2><ul class="references">');
    for (const r of c.references) {
      out.push(`<li><a href="${esc(r.file)}">${esc(r.title)}</a>${para(r.summary)}</li>`);
    }
    out.push('</ul></section>');
  }
  if (c.glossary?.length) {
    out.push('<section id="glossary"><h2>Glossary</h2>');
    let open = false;
    let group = null;
    for (const [i, t] of c.glossary.entries()) {
      if (!open || t.group !== group) {
        if (open) out.push('</dl>');
        if (t.group !== null) out.push(`<h3>${esc(t.group)}</h3>`);
        out.push('<dl class="glossary">');
        open = true;
        group = t.group;
      }
      const avoid = t.avoid ? `<span class="avoid">Avoid: ${esc(t.avoid)}</span>` : '';
      out.push(`<dt>${esc(t.term)}</dt>`, `<dd>${inline(t.definition)}${avoid}</dd>`);
      if (i === c.glossary.length - 1) out.push('</dl>');
    }
    out.push('</section>');
  }
  out.push('</main>', '</body>', '</html>');
  return out.join('\n') + '\n';
}

function main(argv) {
  const [cmd, dir = process.cwd()] = argv;
  if (cmd !== 'state' && cmd !== 'index') {
    console.error('usage: node course.mjs <state|index> [dir]');
    return 2;
  }
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`not a folder: ${dir}`);
    return 1;
  }
  const course = readCourse(dir);
  if (cmd === 'state') console.log(formatState(course));
  else {
    const out = join(course.dir, 'index.html');
    writeFileSync(out, renderIndex(course));
    console.log(`wrote ${out}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
