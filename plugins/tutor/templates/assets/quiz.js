/* quiz.js — reusable quiz widget for a lesson. Self-contained, works on file://.
 * Markup contract and behaviour: skills/teach/references/DESIGN.md § Quiz.
 * teach-template-version: 25
 */
(function () {
  'use strict';

  const SEAL_KEY = 'teach:unsealed:' + location.pathname;
  const UNDO_MS = 3000;

  // Every string the widget writes into a page, with its English default — the
  // one place any of them live. Override with the matching attribute on .quiz
  // for one quiz, or on <html> for the whole lesson: closest() takes the nearer
  // one, so an existing per-quiz override still wins. A non-English course sets
  // what it needs once beside lang and never forks the widget.
  // Tabled in DESIGN.md § Quiz.
  const DEFAULTS = {
    'data-label': 'Cold open',
    'data-undo-label': 'Undo',
    'data-copied-label': 'Copied',
    'data-copy-failed-label': 'Copy failed. Result selected; copy it manually.',
    'data-copied-status': 'Result copied. Paste it into your next message to your teacher.',
    'data-unsealed-label': 'Lesson unsealed.',
    'data-progress-label': '{n} of {total} answered',
  };

  // {name} slots fill from vals. A translated string carries its own slot
  // positions — word order moves between languages, so the widget never
  // concatenates fragments around a number.
  const t = (from, attr, vals) => {
    const src = from.closest('[' + attr + ']');
    const s = (src && src.getAttribute(attr)) || DEFAULTS[attr];
    return vals ? s.replace(/\{(\w+)\}/g, (_, k) => vals[k]) : s;
  };

  const alreadyUnsealed = () => {
    try {
      return localStorage.getItem(SEAL_KEY) === '1';
    } catch {
      return false;
    }
  };

  const rememberUnsealed = () => {
    try {
      localStorage.setItem(SEAL_KEY, '1');
    } catch {}
  };

  function unseal(targetId, announce) {
    const sealed = document.getElementById(targetId);
    if (!sealed) return;
    sealed.classList.remove('sealed');
    sealed.removeAttribute('inert');
    const note = document.querySelector('.seal-note');
    if (!note) return;
    if (announce) {
      note.textContent = t(note, 'data-unsealed-label');
      note.classList.add('is-unsealed');
    } else note.remove();
  }

  // navigator.clipboard covers every browser this renders in, file:// included
  // (a file URL is a potentially-trustworthy origin). onFailure selects the
  // result instead, so a blocked clipboard still leaves a line to copy by hand.
  function copyText(text, btn, copiedLabel, onSuccess, onFailure) {
    const done = () => {
      if (!btn) return;
      const original = btn.textContent;
      btn.textContent = copiedLabel;
      onSuccess?.();
      setTimeout(() => {
        btn.textContent = original;
      }, 1200);
    };
    try {
      navigator.clipboard.writeText(text).then(done, onFailure);
    } catch {
      onFailure?.();
    }
  }

  function initQuiz(root) {
    const items = Array.from(root.querySelectorAll('.quiz-item'));
    if (!items.length) return;
    const outcomes = Array(items.length).fill(null);
    const resultEl = root.querySelector('.quiz-result');
    const copyBtn = root.querySelector('.quiz-copy');
    const copyStatus = root.querySelector('.quiz-copy-status');
    const releases = root.getAttribute('data-releases');
    const undoLabel = t(root, 'data-undo-label');
    let progressEl = null;
    const replay = !!releases && alreadyUnsealed();
    if (replay) unseal(releases);

    if (items.length > 1) {
      progressEl = document.createElement('p');
      progressEl.className = 'quiz-progress';
      root.insertBefore(progressEl, items[0]);
    }

    const updateProgress = () => {
      if (!progressEl) return;
      const answered = outcomes.filter((o) => o !== null).length;
      progressEl.textContent = t(root, 'data-progress-label', {
        n: answered,
        total: items.length,
      });
    };

    const selectResult = () => {
      if (!resultEl) return;
      const selection = window.getSelection();
      if (!selection) return;
      const range = document.createRange();
      range.selectNodeContents(resultEl);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    updateProgress();

    items.forEach((item, i) => {
      const correct = Number(item.getAttribute('data-correct'));
      const buttons = Array.from(item.querySelectorAll('.quiz-btn'));
      const fb = item.querySelector('.quiz-fb');
      let fbText = '';
      if (fb) {
        fbText = fb.textContent;
        fb.textContent = '';
        fb.hidden = false;
      }
      let timer = null;
      let countdownTimer = null;
      let chosen = -1;

      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'quiz-undo';
      undo.textContent = undoLabel;
      undo.hidden = true;
      item.appendChild(undo);

      const setDisabled = (on) => {
        buttons.forEach((b) => {
          if (on) b.setAttribute('aria-disabled', 'true');
          else b.removeAttribute('aria-disabled');
        });
      };

      const clearCountdown = () => {
        if (countdownTimer !== null) clearInterval(countdownTimer);
        countdownTimer = null;
        undo.textContent = undoLabel;
      };

      const updateCountdown = (commitAt) => {
        const seconds = Math.max(0, Math.ceil((commitAt - Date.now()) / 1000));
        undo.textContent = `${undoLabel} (${seconds})`;
      };

      const lock = () => {
        timer = null;
        clearCountdown();
        item.removeAttribute('data-pending');
        item.setAttribute('data-answered', '');
        const focusWasOnUndo = document.activeElement === undo;
        undo.hidden = true;
        const right = chosen === correct;
        buttons[chosen].setAttribute('data-state', right ? 'right' : 'wrong');
        if (!right && buttons[correct]) buttons[correct].setAttribute('data-state', 'right');
        setDisabled(true);
        if (fb) fb.textContent = fbText;
        if (focusWasOnUndo) buttons[chosen].focus();

        navigator.vibrate?.(right ? 50 : [50, 100, 50]);

        outcomes[i] = right ? 'right' : 'wrong';
        updateProgress();
        if (outcomes.every((o) => o !== null)) finish();
      };

      undo.addEventListener('click', () => {
        if (timer === null) return;
        clearTimeout(timer);
        timer = null;
        clearCountdown();
        item.removeAttribute('data-pending');
        buttons.forEach((b) => b.removeAttribute('data-state'));
        setDisabled(false);
        undo.hidden = true;
        const back = buttons[chosen] || buttons[0];
        chosen = -1;
        if (back) back.focus();
      });

      buttons.forEach((btn, b) => {
        btn.addEventListener('click', () => {
          if (item.hasAttribute('data-answered') || timer !== null) return;
          chosen = b;
          item.setAttribute('data-pending', '');
          btn.setAttribute('data-state', 'chosen');
          setDisabled(true);
          undo.hidden = false;
          const commitAt = Date.now() + UNDO_MS;
          updateCountdown(commitAt);
          countdownTimer = setInterval(() => updateCountdown(commitAt), 1000);
          timer = setTimeout(lock, UNDO_MS);
        });
      });
    });

    function finish() {
      const label = t(root, 'data-label');
      const lesson = root.getAttribute('data-lesson');
      const head = lesson ? `${label} ${lesson}` : label;
      const line = head + ': ' + outcomes.map((o, i) => `${i + 1} ${o}`).join(', ');
      if (resultEl) resultEl.textContent = line;
      // Copy control only on a first pass through a gated cold open: a revisit
      // unseals from remembered state and a practice quiz never gates, so
      // neither produces a line worth pasting back.
      if (copyBtn && releases && !replay) {
        copyBtn.hidden = false;
        copyBtn.addEventListener('click', () => {
          if (copyStatus) copyStatus.textContent = '';
          copyText(
            line,
            copyBtn,
            t(root, 'data-copied-label'),
            () => {
              if (copyStatus) copyStatus.textContent = t(root, 'data-copied-status');
            },
            () => {
              selectResult();
              if (copyStatus) copyStatus.textContent = t(root, 'data-copy-failed-label');
            },
          );
        });
      }
      if (releases) {
        unseal(releases, true);
        rememberUnsealed();
      }
    }
  }

  const init = () => {
    document.querySelectorAll('.quiz').forEach((q) => initQuiz(q));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
