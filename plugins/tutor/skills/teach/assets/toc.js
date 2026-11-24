// Builds the "On this page" list (nav.toc) from a page's h2s, marks the section being read,
// and names the page in the crumbs bar. The markup contract lives in the teach skill's lesson rules.
(function () {
  const crumbs = document.querySelector('nav.crumbs');
  const h1 = document.querySelector('h1');
  if (crumbs && h1) {
    const here = document.createElement('span');
    here.textContent = h1.textContent;
    crumbs.append(here);
  }

  const heads = Array.from(document.querySelectorAll('h2'));
  if (heads.length < 2) return;

  const links = heads.map((h) => {
    if (!h.id) {
      const base =
        h.textContent
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'section';
      let id = base;
      for (let n = 2; document.getElementById(id); n++) id = base + '-' + n;
      h.id = id;
    }
    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    return a;
  });

  const nav = document.createElement('nav');
  nav.className = 'toc';
  nav.setAttribute('aria-label', 'On this page');
  const list = document.createElement('ol');
  links.forEach((a) => list.appendChild(document.createElement('li')).appendChild(a));
  nav.appendChild(list);
  if (crumbs) crumbs.after(nav);
  else document.body.prepend(nav);

  // the section being read is the last h2 above the top third of the screen
  let queued = false;
  function mark() {
    queued = false;
    let at = 0;
    heads.forEach((h, i) => {
      if (h.getBoundingClientRect().top < innerHeight / 3) at = i;
    });
    links.forEach((a, i) => {
      if (i === at) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }
  addEventListener(
    'scroll',
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(mark);
      }
    },
    { passive: true },
  );
  mark();
})();
