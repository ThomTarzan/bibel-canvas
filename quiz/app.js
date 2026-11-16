(function () {
  var Q = window.BibelQuiz;
  var KEY = 'bibel-quiz.v2';

  var BOOKS_NB = [
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

  var BOOKS_EN = [
    { id: 'mat', name: 'Matthew', abbr: 'Matt' },
    { id: 'mrk', name: 'Mark', abbr: 'Mark' },
    { id: 'luk', name: 'Luke', abbr: 'Luke' },
    { id: 'joh', name: 'John', abbr: 'John' },
    { id: 'apg', name: 'Acts', abbr: 'Acts' },
    { id: 'rom', name: 'Romans', abbr: 'Rom' },
    { id: '1kor', name: '1 Corinthians', abbr: '1 Cor' },
    { id: '2kor', name: '2 Corinthians', abbr: '2 Cor' },
    { id: 'gal', name: 'Galatians', abbr: 'Gal' },
    { id: 'efe', name: 'Ephesians', abbr: 'Eph' },
    { id: 'fil', name: 'Philippians', abbr: 'Phil' },
    { id: 'kol', name: 'Colossians', abbr: 'Col' },
    { id: '1tess', name: '1 Thessalonians', abbr: '1 Thess' },
    { id: '2tess', name: '2 Thessalonians', abbr: '2 Thess' },
    { id: '1tim', name: '1 Timothy', abbr: '1 Tim' },
    { id: '2tim', name: '2 Timothy', abbr: '2 Tim' },
    { id: 'tit', name: 'Titus', abbr: 'Titus' },
    { id: 'flm', name: 'Philemon', abbr: 'Phlm' },
    { id: 'heb', name: 'Hebrews', abbr: 'Heb' },
    { id: 'jak', name: 'James', abbr: 'Jas' },
    { id: '1pet', name: '1 Peter', abbr: '1 Pet' },
    { id: '2pet', name: '2 Peter', abbr: '2 Pet' },
    { id: '1joh', name: '1 John', abbr: '1 John' },
    { id: '2joh', name: '2 John', abbr: '2 John' },
    { id: '3joh', name: '3 John', abbr: '3 John' },
    { id: 'jud', name: 'Jude', abbr: 'Jude' },
    { id: 'aap', name: 'Revelation', abbr: 'Rev' },
  ];

  var passage = document.getElementById('passage');
  var feedback = document.getElementById('feedback');
  var actions = document.getElementById('actions');
  var picker = document.getElementById('picker');
  var summary = document.getElementById('summary');
  var logPanel = document.getElementById('log-panel');
  var menuPanel = document.getElementById('menu-panel');

  var state = {
    prefs: loadPrefs(),
    cache: new Map(),
    bible: null,
    target: null,
    round: Q.newRound(),
    step: 'book',
    giveUpArmed: false,
    awaitNewRound: false,
    requestId: 0,
    wrongBooks: {},
    wrongChapters: {},
    wrongVerses: {},
    bookWindow: null,
    chapterWindow: null,
    verseWindow: null,
    solvedBook: false,
    solvedChapter: false,
    log: [],
    panel: null,
    lastBox: '',
    fitLock: false,
  };
  state.log = state.prefs.log;

  function loadPrefs() {
    var fallback = {
      translation: 'noblb',
      motion: 'stille',
      lys: false,
      session: { score: 0, rounds: 0 },
      previous: null,
      inProgress: null,
      log: [],
    };
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!data) return fallback;
      var motion = data.motion === 'rolig' || data.motion === 'levende' ? data.motion : 'stille';
      var session = data.session || {};
      var translation = data.translation;
      if (translation !== 'norsk1930' && translation !== 'bsb') translation = 'noblb';
      return {
        translation: translation,
        motion: motion,
        lys: !!data.lys,
        session: {
          score: numberOr(session.score, 0),
          rounds: numberOr(session.rounds, 0),
        },
        previous: data.previous && Number.isFinite(data.previous.score)
          ? { score: data.previous.score, rounds: numberOr(data.previous.rounds, 0) }
          : null,
        inProgress: data.inProgress || null,
        log: Array.isArray(data.log) ? data.log : [],
      };
    } catch (err) {
      return fallback;
    }
  }

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function save() {
    state.prefs.log = state.log;
    localStorage.setItem(KEY, JSON.stringify(state.prefs));
  }

  function catalogFor(id) {
    return id === 'bsb' ? BOOKS_EN : BOOKS_NB;
  }

  function english() {
    return state.bible && state.bible.id === 'bsb';
  }

  function resetBoard() {
    state.step = 'book';
    state.giveUpArmed = false;
    state.wrongBooks = {};
    state.wrongChapters = {};
    state.wrongVerses = {};
    state.bookWindow = null;
    state.chapterWindow = null;
    state.verseWindow = null;
    state.solvedBook = false;
    state.solvedChapter = false;
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
      round: {
        points: state.round.points,
        bookHints: state.round.bookHints,
        extra: state.round.extra,
        wrongs: state.round.wrongs,
        radius: state.round.radius,
      },
      step: state.step,
      wrongBooks: Object.keys(state.wrongBooks),
      wrongChapters: Object.keys(state.wrongChapters),
      wrongVerses: Object.keys(state.wrongVerses),
      bookWindow: state.bookWindow,
      chapterWindow: state.chapterWindow,
      verseWindow: state.verseWindow,
      solvedBook: state.solvedBook,
      solvedChapter: state.solvedChapter,
    };
  }

  function prepareBible(data) {
    var catalog = catalogFor(data.id);
    var byId = new Map(data.books.map(function (book) { return [book.id, book]; }));
    var books = catalog.map(function (meta, bookIndex) {
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
    return fetch('data/' + id + '.json?v=2').then(function (response) {
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

  function listToMap(list) {
    var map = {};
    (list || []).forEach(function (key) { map[key] = true; });
    return map;
  }

  function restoreRound(bible) {
    var saved = state.prefs.inProgress;
    if (!saved || saved.translation !== bible.id || !saved.round) return false;
    var bookIndex = bible.books.findIndex(function (book) { return book.id === saved.bookId; });
    if (bookIndex < 0) return false;
    var verse = bible.books[bookIndex].verses.find(function (item) {
      return item.chapter === saved.chapter && item.key === saved.key;
    });
    if (!verse) return false;
    var savedRound = saved.round;
    state.target = verse;
    state.round = {
      points: numberOr(savedRound.points, Q.START_POINTS),
      bookHints: numberOr(savedRound.bookHints, 0),
      extra: numberOr(savedRound.extra, 0),
      wrongs: numberOr(savedRound.wrongs, 0),
      radius: numberOr(savedRound.radius, 0),
      status: 'play',
      awarded: 0,
    };
    state.step = saved.step === 'chapter' || saved.step === 'verse' ? saved.step : 'book';
    state.wrongBooks = listToMap(saved.wrongBooks);
    state.wrongChapters = listToMap(saved.wrongChapters);
    state.wrongVerses = listToMap(saved.wrongVerses);
    state.bookWindow = saved.bookWindow && Number.isFinite(saved.bookWindow.start) ? saved.bookWindow : null;
    state.chapterWindow = saved.chapterWindow && Number.isFinite(saved.chapterWindow.start) ? saved.chapterWindow : null;
    state.verseWindow = saved.verseWindow && Number.isFinite(saved.verseWindow.start) ? saved.verseWindow : null;
    state.solvedBook = !!saved.solvedBook;
    state.solvedChapter = !!saved.solvedChapter;
    state.giveUpArmed = false;
    return true;
  }

  function newRound() {
    if (!state.bible || state.bible.flat.length === 0) return;
    var index = Math.floor(Math.random() * state.bible.flat.length);
    state.target = state.bible.flat[index];
    state.round = Q.newRound();
    resetBoard();
    rememberVerse();
    save();
    render();
  }

  function shortRef() {
    var book = state.bible.books[state.target.bookIndex];
    var sep = english() ? ':' : ',';
    return book.abbr + ' ' + state.target.chapter + sep + state.target.label;
  }

  function fullRef() {
    var book = state.bible.books[state.target.bookIndex];
    var sep = english() ? ':' : ',';
    return book.name + ' ' + state.target.chapter + sep + state.target.label;
  }

  function signed(n) {
    if (n > 0) return '+' + n;
    return Q.plain(n);
  }

  function pushLog(solved) {
    state.log.unshift({
      ref: shortRef(),
      solved: solved,
      awarded: state.round.awarded,
    });
  }

  function commitRound() {
    state.prefs.session = Q.addRound(state.prefs.session, state.round.awarded);
    state.prefs.inProgress = null;
    save();
  }

  function chapterNumbers(book) {
    var numbers = [];
    book.chapters.forEach(function (chapter, index) {
      if (chapter.length) numbers.push(index + 1);
    });
    return numbers;
  }

  function verseList() {
    var book = state.bible.books[state.target.bookIndex];
    return book.chapters[state.target.chapter - 1] || [];
  }

  function levelHint() {
    if (state.round.status !== 'play') return false;
    var roll = Math.random();
    if (!state.solvedBook) {
      state.round = Q.applyBookHint(state.round);
      state.bookWindow = Q.bookHintWindow(state.bible.books.length, state.target.bookIndex, roll);
      return true;
    }
    if (!state.solvedChapter) {
      var numbers = chapterNumbers(state.bible.books[state.target.bookIndex]);
      var index = numbers.indexOf(state.target.chapter);
      if (index < 0) return false;
      state.round = Q.applyBookHint(state.round);
      state.chapterWindow = Q.bookHintWindow(numbers.length, index, roll);
      return true;
    }
    var verses = verseList();
    var verseIndex = -1;
    for (var i = 0; i < verses.length; i += 1) {
      if (verses[i].key === state.target.key) verseIndex = i;
    }
    if (verseIndex < 0) return false;
    state.round = Q.applyBookHint(state.round);
    state.verseWindow = Q.bookHintWindow(verses.length, verseIndex, roll);
    return true;
  }

  function hint() {
    state.giveUpArmed = false;
    if (!levelHint()) return;
    rememberVerse();
    save();
    render();
  }

  function maybeLys(level) {
    if (!state.prefs.lys || state.round.status !== 'play') return;
    var shown = level === 'book' ? state.bookWindow : level === 'chapter' ? state.chapterWindow : state.verseWindow;
    if (shown) return;
    var wrongs = level === 'book' ? state.wrongBooks : level === 'chapter' ? state.wrongChapters : state.wrongVerses;
    if (Object.keys(wrongs).length !== 1) return;
    levelHint();
  }

  function extraHelp() {
    if (state.round.status !== 'play') return;
    var book = state.bible.books[state.target.bookIndex];
    if (!Q.contextCanGrow(book.verses, state.target, state.round.radius)) return;
    state.giveUpArmed = false;
    state.round = Q.applyExtra(state.round);
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
    pushLog(false);
    commitRound();
    render();
  }

  function chooseBook(index) {
    if (state.round.status !== 'play' || state.solvedBook) return;
    state.giveUpArmed = false;
    if (index === state.target.bookIndex) {
      state.solvedBook = true;
      state.step = 'chapter';
    } else if (!state.wrongBooks[index]) {
      state.wrongBooks[index] = true;
      state.round = Q.applyWrong(state.round);
      maybeLys('book');
    }
    rememberVerse();
    save();
    render();
  }

  function chooseChapter(number) {
    if (state.round.status !== 'play' || !state.solvedBook || state.solvedChapter) return;
    state.giveUpArmed = false;
    if (number === state.target.chapter) {
      state.solvedChapter = true;
      state.step = 'verse';
    } else if (!state.wrongChapters[number]) {
      state.wrongChapters[number] = true;
      state.round = Q.applyWrong(state.round);
      maybeLys('chapter');
    }
    rememberVerse();
    save();
    render();
  }

  function chooseVerse(key) {
    if (state.round.status !== 'play' || !state.solvedChapter) return;
    state.giveUpArmed = false;
    if (key === state.target.key) {
      state.round = Q.applyCorrect(state.round);
      pushLog(true);
      commitRound();
    } else if (!state.wrongVerses[key]) {
      state.wrongVerses[key] = true;
      state.round = Q.applyWrong(state.round);
      maybeLys('verse');
      rememberVerse();
      save();
    }
    render();
  }

  function render() {
    renderStats();
    renderPassage();
    renderFeedback();
    renderActions();
    renderPicker();
    syncMenu();
    requestAnimationFrame(fitPassage);
  }

  function renderStats() {
    var session = state.prefs.session;
    var playing = state.round.status === 'play';
    var roundNo = session.rounds + (playing ? 1 : 0);
    if (roundNo < 1) roundNo = 1;
    var translation = state.bible ? state.bible.name : '';
    document.getElementById('quiz-info').textContent = 'Runde ' + roundNo + (translation ? ' · ' + translation : '');
    var hint = String(state.round.bookHints);
    if (state.round.extra) hint += ' · ekstra ' + state.round.extra;
    document.getElementById('hint-info').textContent = hint;
    var score = 'Økt ' + Q.plain(session.score);
    if (playing) score += ' · runden ' + Q.plain(state.round.points);
    else if (state.round.status === 'correct' || state.round.status === 'revealed') {
      score += ' · sist ' + signed(state.round.awarded);
    }
    document.getElementById('score-info').textContent = score;
    var list = document.getElementById('log-list');
    if (!state.log.length) {
      list.innerHTML = '<li class="log-empty">Ingen vers ennå.</li>';
      return;
    }
    list.innerHTML = state.log.map(function (item) {
      var kind = item.solved ? 'is-solved' : 'is-lost';
      return '<li class="' + kind + '"><span>' + esc(item.ref) + '</span><span>' + signed(item.awarded) + '</span></li>';
    }).join('');
  }

  function passageFit() {
    var fit = document.getElementById('passage-fit');
    if (fit) return fit;
    passage.innerHTML = '<div class="passage-fit" id="passage-fit"></div>';
    return document.getElementById('passage-fit');
  }

  function renderPassage() {
    if (!state.bible || !state.target) return;
    var book = state.bible.books[state.target.bookIndex];
    var windowVerses = Q.contextFor(book.verses, state.target, state.round.radius);
    var fit = passageFit();
    var ref = state.round.status === 'play' ? '' : '<p class="reference">' + esc(fullRef()) + '</p>';
    fit.classList.toggle('has-company', windowVerses.length > 1);
    fit.innerHTML = ref + windowVerses.map(function (verse) {
      return '<p class="verse' + (verse.target ? ' is-target' : '') + '">' + esc(verse.text) + '</p>';
    }).join('');
  }

  function fitPassage() {
    if (state.fitLock) return;
    var fit = document.getElementById('passage-fit');
    if (!fit || !passage.clientHeight) return;
    state.fitLock = true;
    var availableH = Math.max(0, passage.clientHeight - 8);
    var availableW = Math.max(0, passage.clientWidth - 4);
    fit.classList.remove('is-tight');
    var best = fitSize(fit, availableH, availableW, 15);
    if (!best) {
      fit.classList.add('is-tight');
      best = fitSize(fit, availableH, availableW, 12);
    }
    fit.style.fontSize = (best || 12) + 'px';
    state.fitLock = false;
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
    if (!state.bible) {
      feedback.textContent = '';
      return;
    }
    if (round.status === 'correct') {
      feedback.classList.add('is-correct');
      feedback.textContent = 'Riktig. ' + fullRef() + '. ' + signed(round.awarded) + ' poeng.';
      return;
    }
    if (round.status === 'revealed') {
      feedback.classList.add('is-loss');
      feedback.textContent = 'Tap. ' + fullRef() + '. ' + signed(round.awarded) + ' poeng.';
      return;
    }
    feedback.textContent = '';
  }

  function renderActions() {
    if (!state.bible || state.round.status !== 'play') {
      actions.innerHTML = '<button type="button" class="primary wide" data-act="next">Neste vers</button>';
      return;
    }
    var book = state.bible.books[state.target.bookIndex];
    var extraDisabled = Q.contextCanGrow(book.verses, state.target, state.round.radius) ? '' : ' disabled';
    var giveUpLabel = state.giveUpArmed ? 'Bekreft tap' : 'Gi opp';
    actions.innerHTML = ''
      + '<div class="action-row">'
      + '<button type="button" class="secondary" data-act="hint">Hint</button>'
      + '<button type="button" class="secondary" data-act="extra"' + extraDisabled + '>Ekstra hjelp</button>'
      + '</div>'
      + '<button type="button" class="quiet" data-act="giveup">' + giveUpLabel + '</button>';
  }

  function bookClass(index) {
    var classes = 'pick';
    var revealed = state.round.status !== 'play';
    if (state.wrongBooks[index]) classes += ' is-wrong';
    if ((state.solvedBook || revealed) && index === state.target.bookIndex) classes += ' is-right';
    else if (state.bookWindow && index >= state.bookWindow.start && index <= state.bookWindow.end && !state.wrongBooks[index]) {
      classes += ' is-window';
    }
    return classes;
  }

  function renderPicker() {
    if (!state.bible || !state.target) {
      picker.innerHTML = '';
      return;
    }
    if (state.step === 'verse' && state.solvedChapter) {
      picker.innerHTML = verseStep();
      return;
    }
    if (state.step === 'chapter' && state.solvedBook) {
      picker.innerHTML = chapterStep();
      return;
    }
    picker.innerHTML = ''
      + '<h2 class="step-title">Hvilken bok?</h2>'
      + '<div class="grid books">'
      + state.bible.books.map(function (book, index) {
        return '<button type="button" class="' + bookClass(index) + '" data-act="book" data-index="' + index + '" aria-label="' + esc(book.name) + '">' + esc(book.abbr) + '</button>';
      }).join('')
      + '</div>';
  }

  function chapterStep() {
    var book = state.bible.books[state.target.bookIndex];
    var revealed = state.round.status !== 'play';
    var numbers = chapterNumbers(book);
    var buttons = numbers.map(function (number, position) {
      var classes = 'pick';
      if (state.wrongChapters[number]) classes += ' is-wrong';
      if ((state.solvedChapter || revealed) && number === state.target.chapter) classes += ' is-right';
      else if (inWindow(state.chapterWindow, position) && !state.wrongChapters[number]) classes += ' is-window';
      return '<button type="button" class="' + classes + '" data-act="chapter" data-chapter="' + number + '">' + number + '</button>';
    }).join('');
    return ''
      + '<h2 class="step-title is-right-label">' + esc(book.name) + '</h2>'
      + '<p class="step-kicker">Hvilket kapittel?</p>'
      + '<div class="grid chapters">' + buttons + '</div>';
  }

  function verseStep() {
    var book = state.bible.books[state.target.bookIndex];
    var chapter = book.chapters[state.target.chapter - 1] || [];
    var revealed = state.round.status !== 'play';
    var buttons = chapter.map(function (verse, position) {
      var classes = 'pick';
      if (state.wrongVerses[verse.key]) classes += ' is-wrong';
      if ((state.round.status === 'correct' || revealed) && verse.key === state.target.key) classes += ' is-right';
      else if (inWindow(state.verseWindow, position) && !state.wrongVerses[verse.key]) classes += ' is-window';
      return '<button type="button" class="' + classes + '" data-act="verse" data-key="' + esc(verse.key) + '">' + esc(verse.label) + '</button>';
    }).join('');
    return ''
      + '<h2 class="step-title">' + esc(book.name) + ' ' + state.target.chapter + '</h2>'
      + '<p class="step-kicker">Hvilket vers?</p>'
      + '<div class="grid verses">' + buttons + '</div>';
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function onPickerClick(event) {
    var button = event.target.closest('button');
    if (!button) return;
    var act = button.dataset.act;
    if (act === 'book') chooseBook(Number(button.dataset.index));
    else if (act === 'chapter') chooseChapter(Number(button.dataset.chapter));
    else if (act === 'verse') chooseVerse(button.dataset.key);
  }

  function onActionClick(event) {
    var button = event.target.closest('button');
    if (!button) return;
    var act = button.dataset.act;
    if (act === 'hint') hint();
    else if (act === 'extra') extraHelp();
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
    var lys = document.getElementById('lys');
    if (lys) lys.checked = !!state.prefs.lys;
    var note = document.getElementById('finish-note');
    var button = document.getElementById('finish-session');
    if (state.prefs.session.rounds < 1) {
      note.textContent = 'Spill minst én runde før du avslutter økten.';
      button.disabled = true;
    } else {
      note.textContent = 'Summen er ' + Q.plain(state.prefs.session.score)
        + ' på ' + state.prefs.session.rounds
        + (state.prefs.session.rounds === 1 ? ' runde.' : ' runder.');
      button.disabled = false;
    }
    document.getElementById('toggle-log').setAttribute('aria-pressed', state.panel === 'log' ? 'true' : 'false');
    document.getElementById('toggle-menu').setAttribute('aria-pressed', state.panel === 'menu' ? 'true' : 'false');
    logPanel.classList.toggle('is-open', state.panel === 'log');
    menuPanel.classList.toggle('is-open', state.panel === 'menu');
  }

  function setTranslation(id) {
    if (id !== 'noblb' && id !== 'norsk1930' && id !== 'bsb') return;
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

  function setLys(on) {
    state.prefs.lys = !!on;
    save();
  }

  function inWindow(window, position) {
    return window && position >= window.start && position <= window.end;
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
    state.log = [];
    state.prefs.log = [];
    save();
    document.getElementById('summary-text').textContent = result.text;
    document.getElementById('summary-rounds').textContent = result.rounds + (result.rounds === 1 ? ' runde.' : ' runder.');
    state.awaitNewRound = true;
    state.panel = null;
    syncMenu();
    summary.showModal();
  }

  function showError() {
    passageFit().classList.remove('has-company');
    passageFit().innerHTML = '<p class="verse">Teksten kunne ikke hentes. Prøv å laste siden på nytt.</p>';
    requestAnimationFrame(fitPassage);
    actions.innerHTML = '';
    picker.innerHTML = '';
  }

  function togglePanel(name) {
    state.panel = state.panel === name ? null : name;
    syncMenu();
  }

  document.getElementById('toggle-log').addEventListener('click', function () { togglePanel('log'); });
  document.getElementById('toggle-menu').addEventListener('click', function () { togglePanel('menu'); });
  menuPanel.addEventListener('change', function (event) {
    if (event.target.name === 'translation') setTranslation(event.target.value);
    if (event.target.name === 'motion') setMotion(event.target.value);
    if (event.target.id === 'lys') setLys(event.target.checked);
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
    new ResizeObserver(function () {
      var key = passage.clientWidth + 'x' + passage.clientHeight;
      if (key === state.lastBox) return;
      state.lastBox = key;
      fitPassage();
    }).observe(passage);
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
