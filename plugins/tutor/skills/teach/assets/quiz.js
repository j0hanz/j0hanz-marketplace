// Scores single-choice quizzes (form.quiz) with instant feedback; each form scores on its own.
// The markup contract lives in the teach skill's lesson rules.
(function () {
  function setup(form) {
    const sets = Array.from(form.querySelectorAll('fieldset[data-answer]'));
    const score = form.querySelector('.score');
    let retry = null;

    function update() {
      const done = sets.filter(
        (s) => s.classList.contains('correct') || s.classList.contains('wrong'),
      );
      const right = form.querySelectorAll('fieldset.correct').length;
      if (!score) return;
      if (done.length === sets.length) {
        score.textContent = 'Score: ' + right + '/' + sets.length;
      } else {
        score.textContent = right + ' of ' + sets.length + ' answered right';
      }
      if (done.length === sets.length && !retry) {
        retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Try again';
        retry.addEventListener('click', reset);
        form.appendChild(retry);
      }
    }

    function reset() {
      form.reset();
      sets.forEach((s) => {
        s.classList.remove('correct', 'wrong');
        s.querySelectorAll('label').forEach((l) => l.classList.remove('picked', 'answer'));
        s.querySelectorAll('input').forEach((i) => {
          i.disabled = false;
        });
        const fb = s.querySelector('.feedback');
        if (fb) fb.hidden = true;
      });
      if (score) score.textContent = '';
      if (retry) retry.remove();
      retry = null;
    }

    function grade(set, input) {
      const want = set.dataset.answer;
      set.querySelectorAll('input').forEach((i) => {
        const label = i.closest('label');
        if (i.value === want && label) label.classList.add('answer');
        if (i === input && label) label.classList.add('picked');
        i.disabled = true;
      });
      set.classList.add(input.value === want ? 'correct' : 'wrong');
      const fb = set.querySelector('.feedback');
      if (fb) fb.hidden = false;
      update();
    }

    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    sets.forEach((set) => {
      let moving = false; // an arrow key is moving the selection: do not grade it
      set.addEventListener('keydown', (e) => {
        if (e.target.type !== 'radio') return;
        if (arrows.includes(e.key)) {
          moving = true;
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.target.checked = true;
          grade(set, e.target);
        }
      });
      set.addEventListener('keyup', (e) => {
        if (arrows.includes(e.key)) moving = false;
      });
      set.addEventListener('change', (e) => {
        if (e.target.type === 'radio' && !moving) grade(set, e.target);
      });
    });

    form.addEventListener('submit', (e) => e.preventDefault());
  }

  document.querySelectorAll('form.quiz').forEach(setup);
})();
