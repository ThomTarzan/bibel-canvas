(function () {
  var Q = window.BibelQuiz;
  var KEY = 'bibel-quiz.v1';

  var BOOKS = [
    { id: 'mat', name: 'Matteus', abbr: 'Matt' },
    { id: 'mrk', name: 'Markus', abbr: 'Mark' },
    { id: 'luk', name: 'Lukas', abbr: 'Luk' },
    { id: 'joh', name: 'Johannes', abbr: 'Joh' },
    { id: 'apg', name: 'Apostlenes gjerninger', abbr: 'Apg' },
    { id: 'rom', name: 'Romerne', abbr: 'Rom' },
    { id: '1kor', name: '1. Korinter', abbr: '1 Kor' },
    { id: '2kor', name: '2. Korinter', abbr: '2 Kor' },
    { id: 'gal', name: 'Galaterne', abbr: 'Gal' },
    { id: 'efe', name: 'Efeserne', abbr: 'Ef' },
    { id: 'fil', name: 'Filipperne', abbr: 'Fil' },
    { id: 'kol', name: 'Kolosserne', abbr: 'Kol' },
    { id: '1tess', name: '1. Tessaloniker', abbr: '1 Tess' },
    { id: '2tess', name: '2. Tessaloniker', abbr: '2 Tess' },
    { id: '1tim', name: '1. Timoteus', abbr: '1 Tim' },
    { id: '2tim', name: '2. Timoteus', abbr: '2 Tim' },
    { id: 'tit', name: 'Titus', abbr: 'Tit' },
    { id: 'flm', name: 'Filemon', abbr: 'Filem' },
    { id: 'heb', name: 'Hebreerne', abbr: 'Hebr' },
    { id: 'jak', name: 'Jakob', abbr: 'Jak' },
    { id: '1pet', name: '1. Peter', abbr: '1 Pet' },
    { id: '2pet', name: '2. Peter', abbr: '2 Pet' },
    { id: '1joh', name: '1. Johannes', abbr: '1 Joh' },
    { id: '2joh', name: '2. Johannes', abbr: '2 Joh' },
    { id: '3joh', name: '3. Johannes', abbr: '3 Joh' },
    { id: 'jud', name: 'Judas', abbr: 'Jud' },
    { id: 'aap', name: 'Johannes’ åpenbaring', abbr: 'Åp' },
  ];

  var scoreline = document.getElementById('scoreline');
  var stake = document.getElementById('stake');
  var passage = document.getElementById('passage');
  var feedback = document.getElementById('feedback');
  var actions = document.getElementById('actions');
  var picker = document.getElementById('picker');
  var menu = document.getElementById('menu');
  var summary = document.getElementById('summary');

  var state = {
    prefs: loadPrefs(),
    cache: new Map(),
    bible: null,
    target: null,
    round: Q.newRound(),
    selection: blankSelection(),
    step: 'book',
    giveUpArmed: false,
    awaitNewRound: false,
    requestId: 0,
  };

  function blankSelection() {
    return { bookIndex: null, chapter: null, key: null };
  }

  function loadPrefs() {
    var fallback = {
      translation: 'noblb',
      motion: 'stille',
      session: { score: 0, rounds: 0 },
      previous: null,
      inProgress: null,
    };
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!data) return fallback;
      var motion = data.motion === 'rolig' || data.motion === 'levende' ? data.motion : 'stille';
      var session = data.session || {};
      return {
        translation: data.translation === 'norsk1930' ? 'norsk1930' : 'noblb',
        motion: motion,
        session: {
          score: numberOr(session.score, 0),
          rounds: numberOr(session.rounds, 0),
        },
        previous: data.previous && Number.isFinite(data.previous.score)
          ? { score: data.previous.score, rounds: numberOr(data.previous.rounds, 0) }
          : null,
        inProgress: data.inProgress || null,
      };
    } catch (err) {
      return fallback;
    }
  }

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state.prefs));
  }

  function rememberVerse() {
    if (!state.bible || !state.target || state.round.status !== 'play') {
      state.prefs.inProgress = null;
      return;
    }
    state.prefs.inProgress = {
      translation: state.bible.id,
      bookId: state.bible.books[state.target.bookIndex].id,
      chapter: state.target.chapter,
      key: state.target.key,
      hints: state.round.hints,
      wrongs: state.round.wrongs,
      feedback: state.round.feedback,
    };
  }

  function prepareBible(data) {
    var byId = new Map(data.books.map(function (book) { return [book.id, book]; }));
    var books = BOOKS.map(function (meta, bookIndex) {
      var raw = byId.get(meta.id);
      if (!raw) throw new Error('Mangler bok ' + meta.id);
      var chapters = raw.chapters.map(function (chapter) {
        return chapter
          .filter(function (row) { return row[1]; })
          .map(function (row) {
            return { key: row[0], text: row[1], label: String(row[0]).replace('-', '–') };
          });
      });
      var verses = [];
      chapters.forEach(function (chapter, index) {
        chapter.forEach(function (verse) {
          verses.push({
            bookIndex: bookIndex,
            chapter: index + 1,
            key: verse.key,
            label: verse.label,
            text: verse.text,
          });
        });
      });
      return {
        id: meta.id,
        name: meta.name,
        abbr: meta.abbr,
        chapters: chapters,
        verses: verses,
      };
    });
    return {
      id: data.id,
      name: data.name,
      books: books,
      flat: books.flatMap(function (book) { return book.verses; }),
    };
  }

  function loadBible(id) {
    if (state.cache.has(id)) return Promise.resolve(state.cache.get(id));
    return fetch('data/' + id + '.json?v=1').then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (data) {
      var bible = prepareBible(data);
      state.cache.set(id, bible);
      return bible;
    });
  }

  function useBible(bible, resume) {
    state.bible = bible;
    if (resume && restoreRound(bible)) {
      render();
      return;
    }
    newRound();
  }

  function restoreRound(bible) {
    var saved = state.prefs.inProgress;
    if (!saved || saved.translation !== bible.id) return false;
    var bookIndex = bible.books.findIndex(function (book) { return book.id === saved.bookId; });
    if (bookIndex < 0) return false;
    var verse = bible.books[bookIndex].verses.find(function (item) {
      return item.chapter === saved.chapter && item.key === saved.key;
    });
    if (!verse) return false;
    var hints = clamp(saved.hints, 0, Q.MAX_HINTS);
    var wrongs = clamp(saved.wrongs, 0, 12);
    var points = Q.START_POINTS - hints - wrongs;
    if (points < 1) return false;
    state.target = verse;
    state.round = {
      points: points,
      hints: hints,
      wrongs: wrongs,
      radius: Math.min(Q.MAX_HINTS, hints + wrongs),
      status: 'play',
      feedback: typeof saved.feedback === 'string' ? saved.feedback : '',
      awarded: 0,
    };
    state.selection = blankSelection();
    state.step = 'book';
    state.giveUpArmed = false;
    return true;
  }

  function clamp(value, min, max) {
    var n = Number.isFinite(value) ? value : min;
    return Math.max(min, Math.min(max, n));
  }

  function newRound() {
    if (!state.bible || state.bible.flat.length === 0) return;
    var index = Math.floor(Math.random() * state.bible.flat.length);
    state.target = state.bible.flat[index];
    state.round = Q.newRound();
    state.selection = blankSelection();
    state.step = 'book';
    state.giveUpArmed = false;
    rememberVerse();
    save();
    render();
  }

  function commitRound() {
    state.prefs.session = Q.addRound(state.prefs.session, state.round.awarded);
    state.prefs.inProgress = null;
    save();
  }

  function hint() {
    if (!Q.canHint(state.round)) return;
    state.giveUpArmed = false;
    state.round = Q.applyHint(state.round);
    rememberVerse();
    save();
    render();
  }

  function giveUp() {
    if (state.round.status !== 'play') return;
    if (!state.giveUpArmed) {
      state.giveUpArmed = true;
      render();
      return;
    }
    state.round = Q.applyGiveUp(state.round);
    state.giveUpArmed = false;
    commitRound();
    render();
  }

  function submit() {
    if (state.round.status !== 'play') return;
    var sel = state.selection;
    if (sel.bookIndex == null || sel.chapter == null || sel.key == null) return;
    state.giveUpArmed = false;
    var kind = Q.judge(state.target, sel);
    state.round = Q.applyGuess(state.round, kind);
    if (state.round.status === 'play') {
      if (kind === 'book') {
        state.selection = blankSelection();
        state.step = 'book';
      } else if (kind === 'chapter') {
        state.selection.chapter = null;
        state.selection.key = null;
        state.step = 'chapter';
      } else {
        state.selection.key = null;
        state.step = 'verse';
      }
      rememberVerse();
      save();
    } else {
      commitRound();
    }
    render();
  }

  function reference() {
    var book = state.bible.books[state.target.bookIndex];
    return book.name + ' ' + state.target.chapter + ',' + state.target.label;
  }

  function signed(n) {
    if (n > 0) return '+' + n;
    return Q.plain(n);
  }

  function render() {
    var session = state.prefs.session;
    var previous = state.prefs.previous;
    scoreline.textContent = 'Sum ' + Q.plain(session.score)
      + (previous ? ' · Forrige ' + Q.plain(previous.score) : '')
      + ' · ' + session.rounds + (session.rounds === 1 ? ' runde' : ' runder');

    if (state.round.status === 'play') {
      var loss = Q.lossValue(state.round.hints, state.round.wrongs);
      stake.textContent = 'Riktig gir ' + state.round.points + ' poeng. Gi opp gir ' + Q.plain(loss) + ' poeng.';
    } else {
      stake.textContent = '';
    }

    renderPassage();
    renderFeedback();
    renderActions();
    renderPicker();
    requestAnimationFrame(fitPassage);
  }

  function passageFit() {
    var fit = document.getElementById('passage-fit');
    if (fit) return fit;
    passage.innerHTML = '<div class="passage-fit" id="passage-fit"></div>';
    return document.getElementById('passage-fit');
  }

  function renderPassage() {
    var book = state.bible.books[state.target.bookIndex];
    var windowVerses = Q.contextFor(book.verses, state.target, state.round.radius);
    var fit = passageFit();
    var ref = state.round.status === 'play' ? '' : '<p class="reference">' + esc(reference()) + '</p>';
    fit.classList.toggle('has-company', windowVerses.length > 1);
    fit.innerHTML = ref + windowVerses.map(function (verse) {
      return '<p class="verse' + (verse.target ? ' is-target' : '') + '">' + esc(verse.text) + '</p>';
    }).join('');
  }

  function fitPassage() {
    var fit = document.getElementById('passage-fit');
    if (!fit || !passage.clientHeight) return;
    var availableH = Math.max(0, passage.clientHeight - 8);
    var availableW = Math.max(0, passage.clientWidth - 4);
    fit.classList.remove('is-tight');
    var best = fitSize(fit, availableH, availableW, 15);
    if (!best) {
      fit.classList.add('is-tight');
      best = fitSize(fit, availableH, availableW, 12);
    }
    fit.style.fontSize = (best || 12) + 'px';
  }

  function fitSize(fit, availableH, availableW, floor) {
    var hi = Math.min(56, Math.max(floor, Math.floor(availableW / 9)));
    var lo = floor;
    var best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      fit.style.fontSize = mid + 'px';
      if (fit.scrollHeight <= availableH && fit.scrollWidth <= availableW + 2) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  function renderFeedback() {
    var round = state.round;
    feedback.className = 'feedback';
    if (round.status === 'correct') {
      feedback.classList.add('is-correct');
      feedback.textContent = 'Riktig. ' + reference() + '. ' + signed(round.awarded) + ' poeng.';
      return;
    }
    if (round.status === 'revealed') {
      feedback.classList.add('is-loss');
      var lead = round.feedback && round.feedback !== 'Tap' ? round.feedback + '. ' : '';
      feedback.textContent = lead + 'Tap. ' + reference() + '. ' + signed(round.awarded) + ' poeng.';
      return;
    }
    if (round.feedback) feedback.classList.add('is-wrong');
    feedback.textContent = round.feedback || '';
  }

  function renderActions() {
    if (!state.bible || state.round.status !== 'play') {
      actions.innerHTML = '<button type="button" class="primary wide" data-act="next">Neste vers</button>';
      return;
    }
    var room = Q.canHint(state.round)
      ? Math.min(Q.MAX_HINTS - state.round.hints, state.round.points - 1, Q.MAX_HINTS - state.round.radius)
      : 0;
    var hintNote = room > 0 ? '−1 · ' + room + ' igjen' : 'ikke flere';
    var answerDisabled = state.selection.key == null ? ' disabled' : '';
    var hintDisabled = room > 0 ? '' : ' disabled';
    var giveUpLabel = state.giveUpArmed ? 'Bekreft tap' : 'Gi opp';
    actions.innerHTML = ''
      + '<div class="action-row">'
      + '<button type="button" class="secondary" data-act="hint"' + hintDisabled + '>Hint<span>' + hintNote + '</span></button>'
      + '<button type="button" class="primary" data-act="answer"' + answerDisabled + '>Svar</button>'
      + '</div>'
      + '<button type="button" class="quiet" data-act="giveup">' + giveUpLabel + '</button>';
  }

  function renderPicker() {
    if (!state.bible || state.round.status !== 'play') {
      picker.innerHTML = '';
      return;
    }
    if (state.step === 'chapter' && state.selection.bookIndex != null) {
      picker.innerHTML = chapterStep();
      return;
    }
    if (state.step === 'verse' && state.selection.chapter != null) {
      picker.innerHTML = verseStep();
      return;
    }
    picker.innerHTML = ''
      + '<h2 class="step-title">Hvilken bok?</h2>'
      + '<div class="grid books">'
      + state.bible.books.map(function (book, index) {
        return '<button type="button" class="pick" data-act="book" data-index="' + index + '" aria-label="' + esc(book.name) + '">' + esc(book.abbr) + '</button>';
      }).join('')
      + '</div>';
  }

  function chapterStep() {
    var book = state.bible.books[state.selection.bookIndex];
    var buttons = book.chapters.map(function (chapter, index) {
      if (!chapter.length) return '';
      var number = index + 1;
      return '<button type="button" class="pick" data-act="chapter" data-chapter="' + number + '">' + number + '</button>';
    }).join('');
    return ''
      + '<h2 class="step-title">Hvilket kapittel?</h2>'
      + '<button type="button" class="back" data-act="back">' + esc(book.name) + ' · bytt bok</button>'
      + '<div class="grid chapters">' + buttons + '</div>';
  }

  function verseStep() {
    var book = state.bible.books[state.selection.bookIndex];
    var chapter = book.chapters[state.selection.chapter - 1] || [];
    var buttons = chapter.map(function (verse) {
      var pressed = verse.key === state.selection.key ? 'true' : 'false';
      return '<button type="button" class="pick" data-act="verse" data-key="' + esc(verse.key) + '" aria-pressed="' + pressed + '">' + esc(verse.label) + '</button>';
    }).join('');
    return ''
      + '<h2 class="step-title">Hvilket vers?</h2>'
      + '<button type="button" class="back" data-act="back">' + esc(book.name) + ' ' + state.selection.chapter + ' · bytt kapittel</button>'
      + '<div class="grid verses">' + buttons + '</div>';
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function onPickerClick(event) {
    var button = event.target.closest('button');
    if (!button || state.round.status !== 'play') return;
    var act = button.dataset.act;
    if (act !== 'giveup') state.giveUpArmed = false;
    if (act === 'book') {
      state.selection = { bookIndex: Number(button.dataset.index), chapter: null, key: null };
      state.step = 'chapter';
      render();
    } else if (act === 'chapter') {
      state.selection.chapter = Number(button.dataset.chapter);
      state.selection.key = null;
      state.step = 'verse';
      render();
    } else if (act === 'verse') {
      state.selection.key = button.dataset.key;
      render();
    } else if (act === 'back') {
      if (state.step === 'verse') {
        state.step = 'chapter';
        state.selection.key = null;
      } else {
        state.step = 'book';
        state.selection = blankSelection();
      }
      render();
    }
  }

  function onActionClick(event) {
    var button = event.target.closest('button');
    if (!button) return;
    var act = button.dataset.act;
    if (act === 'hint') hint();
    else if (act === 'answer') submit();
    else if (act === 'giveup') giveUp();
    else if (act === 'next') newRound();
  }

  function syncMenu() {
    document.querySelectorAll('input[name="translation"]').forEach(function (input) {
      input.checked = input.value === state.prefs.translation;
    });
    document.querySelectorAll('input[name="motion"]').forEach(function (input) {
      input.checked = input.value === state.prefs.motion;
    });
    var note = document.getElementById('finish-note');
    var button = document.getElementById('finish-session');
    if (state.prefs.session.rounds < 1) {
      note.textContent = 'Spill minst én runde før du avslutter økten. En uferdig runde teller ikke med.';
      button.disabled = true;
    } else {
      note.textContent = 'Summen så langt er ' + Q.plain(state.prefs.session.score)
        + ' på ' + state.prefs.session.rounds
        + (state.prefs.session.rounds === 1 ? ' runde.' : ' runder.')
        + ' En uferdig runde teller ikke med.';
      button.disabled = false;
    }
  }

  function setTranslation(id) {
    if (id !== 'noblb' && id !== 'norsk1930') return;
    if (id === state.prefs.translation && state.bible && state.bible.id === id) return;
    state.prefs.translation = id;
    state.prefs.inProgress = null;
    save();
    var requestId = ++state.requestId;
    passageFit().classList.remove('has-company');
    passageFit().innerHTML = '<p class="verse">Henter teksten…</p>';
    loadBible(id).then(function (bible) {
      if (requestId !== state.requestId) return;
      useBible(bible, false);
    }).catch(function () {
      if (requestId !== state.requestId) return;
      showError();
    });
  }

  function setMotion(motion) {
    if (motion !== 'stille' && motion !== 'rolig' && motion !== 'levende') return;
    state.prefs.motion = motion;
    document.documentElement.dataset.motion = motion;
    save();
  }

  function finishSession() {
    var result = Q.finishSession(state.prefs.session, state.prefs.previous);
    if (!result.ok) return;
    state.prefs.previous = result.nextPrevious;
    state.prefs.session = result.nextSession;
    state.prefs.inProgress = null;
    save();
    document.getElementById('summary-text').textContent = result.text;
    document.getElementById('summary-rounds').textContent = result.rounds + (result.rounds === 1 ? ' runde.' : ' runder.');
    state.awaitNewRound = true;
    menu.close();
    summary.showModal();
  }

  function showError() {
    passageFit().classList.remove('has-company');
    passageFit().innerHTML = '<p class="verse">Teksten kunne ikke hentes. Prøv å laste siden på nytt.</p>';
    requestAnimationFrame(fitPassage);
    actions.innerHTML = '';
    picker.innerHTML = '';
  }

  document.getElementById('open-menu').addEventListener('click', function () {
    syncMenu();
    menu.showModal();
  });
  document.getElementById('close-menu').addEventListener('click', function () { menu.close(); });
  menu.addEventListener('click', function (event) {
    if (event.target === menu) menu.close();
  });
  menu.addEventListener('change', function (event) {
    if (event.target.name === 'translation') setTranslation(event.target.value);
    if (event.target.name === 'motion') setMotion(event.target.value);
  });
  document.getElementById('finish-session').addEventListener('click', finishSession);
  document.getElementById('new-session').addEventListener('click', function () { summary.close(); });
  summary.addEventListener('close', function () {
    if (!state.awaitNewRound) return;
    state.awaitNewRound = false;
    if (state.bible) newRound();
  });
  summary.addEventListener('click', function (event) {
    if (event.target === summary) summary.close();
  });
  picker.addEventListener('click', onPickerClick);
  actions.addEventListener('click', onActionClick);

  document.documentElement.dataset.motion = state.prefs.motion;
  if (window.ResizeObserver) {
    new ResizeObserver(function () { fitPassage(); }).observe(passage);
  } else {
    window.addEventListener('resize', fitPassage);
  }
  var bootId = ++state.requestId;
  loadBible(state.prefs.translation).then(function (bible) {
    if (bootId !== state.requestId) return;
    useBible(bible, true);
  }).catch(function () {
    if (bootId !== state.requestId) return;
    showError();
  });
})();
