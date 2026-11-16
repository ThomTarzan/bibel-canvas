(function () {
  var Q = window.BibelQuiz;
  var S = window.BibelScore;
  var KEY = 'bibel-quiz.v4';

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
    store: loadStore(),
    game: null,
    cache: new Map(),
    bible: null,
    target: null,
    round: blankVerse(),
    step: 'book',
    giveUpArmed: false,
    requestId: 0,
    wrongBooks: {},
    wrongChapters: {},
    wrongVerses: {},
    bookWindow: null,
    chapterWindow: null,
    verseWindow: null,
    solvedBook: false,
    solvedChapter: false,
    panel: null,
    lastBox: '',
    fitLock: false,
    boardShown: 0,
    overwrite: false,
  };

  function loadStore() {
    var fallback = { slots: [], activeId: null };
    try {
      var data = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!data || !Array.isArray(data.slots)) return fallback;
      return {
        slots: data.slots.slice(0, 3).map(normalizeSlot),
        activeId: data.activeId || null,
      };
    } catch (err) {
      return fallback;
    }
  }

  function normalizeSlot(slot) {
    var translation = slot.translation;
    if (translation !== 'norsk1930' && translation !== 'bsb') translation = 'noblb';
    var motion = slot.motion === 'rolig' || slot.motion === 'levende' ? slot.motion : 'stille';
    return {
      id: String(slot.id || Date.now()),
      score: numberOr(slot.score, 0),
      verses: numberOr(slot.verses, 0),
      streak: numberOr(slot.streak, 0),
      updatedAt: slot.updatedAt || new Date().toISOString(),
      translation: translation,
      motion: motion,
      lys: !!slot.lys,
      log: Array.isArray(slot.log) ? slot.log : [],
      inProgress: slot.inProgress || null,
    };
  }

  function blankVerse() {
    return {
      status: 'play',
      bookWrongs: 0,
      chapterWrongs: 0,
      verseWrongs: 0,
      bookPoints: null,
      chapterPoints: null,
      versePoints: null,
      guessing: 0,
      fiveRowUses: 0,
      radius: 0,
      helpUsed: false,
      awarded: 0,
    };
  }

  function blankGame(settings) {
    return {
      id: String(Date.now()) + Math.floor(Math.random() * 1000),
      score: 0,
      verses: 0,
      streak: 0,
      updatedAt: new Date().toISOString(),
      translation: settings && settings.translation ? settings.translation : 'noblb',
      motion: settings && settings.motion ? settings.motion : 'stille',
      lys: !!(settings && settings.lys),
      log: [],
      inProgress: null,
    };
  }

  function numberOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function save() {
    if (state.game) {
      state.game.updatedAt = new Date().toISOString();
      state.store.activeId = state.game.id;
    }
    localStorage.setItem(KEY, JSON.stringify(state.store));
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
    if (!state.game) return;
    if (!state.bible || !state.target || state.round.status !== 'play') {
      state.game.inProgress = null;
      return;
    }
    state.game.inProgress = {
      translation: state.bible.id,
      bookId: state.bible.books[state.target.bookIndex].id,
      chapter: state.target.chapter,
      key: state.target.key,
      round: state.round,
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
    var saved = state.game && state.game.inProgress;
    if (!saved || saved.translation !== bible.id || !saved.round) return false;
    var bookIndex = bible.books.findIndex(function (book) { return book.id === saved.bookId; });
    if (bookIndex < 0) return false;
    var verse = bible.books[bookIndex].verses.find(function (item) {
      return item.chapter === saved.chapter && item.key === saved.key;
    });
    if (!verse) return false;
    var savedRound = saved.round;
    state.target = verse;
    state.round = Object.assign(blankVerse(), saved.round, { status: 'play' });
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
    state.round = blankVerse();
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

  function formatScore(n) {
    var sign = n < 0 ? '−' : '';
    var abs = Math.round(Math.abs(n) * 10) / 10;
    var text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace('.', ',');
    return sign + text;
  }

  function signed(n) {
    if (n > 0) return '+' + formatScore(n);
    return formatScore(n);
  }

  function reduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function paintBoard(delta) {
    if (!state.game) return;
    var digits = document.getElementById('board-digits');
    var board = document.getElementById('board');
    var badge = document.getElementById('board-streak');
    var target = state.game.score;
    board.classList.remove('is-gain', 'is-loss');
    if (!reduceMotion() && delta) {
      board.classList.add(delta > 0 ? 'is-gain' : 'is-loss');
      countTo(digits, state.boardShown, target);
    } else {
      digits.textContent = formatScore(target);
    }
    state.boardShown = target;
    var deltaEl = document.getElementById('board-delta');
    if (delta) {
      deltaEl.hidden = false;
      deltaEl.textContent = signed(delta);
    } else {
      deltaEl.hidden = true;
    }
    var mult = S.multiplier(state.game.streak);
    badge.textContent = 'Rekke ' + state.game.streak + ' · ×' + String(mult).replace('.', ',');
  }

  function countTo(el, from, to) {
    var start = performance.now();
    var duration = 420;
    function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      var value = from + (to - from) * (1 - Math.pow(1 - t, 3));
      el.textContent = formatScore(Math.round(value * 10) / 10);
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = formatScore(to);
    }
    requestAnimationFrame(frame);
  }

  function playDraw(value) {
    var el = document.getElementById('draw');
    if (!el) return;
    el.hidden = false;
    if (reduceMotion()) {
      el.textContent = '5 på rad ' + signed(value);
      return;
    }
    var steps = 14;
    var i = 0;
    var timer = setInterval(function () {
      i += 1;
      if (i < steps) {
        el.textContent = '5 på rad ' + signed(S.FIVE_ROW[Math.floor(Math.random() * S.FIVE_ROW.length)]);
      } else {
        clearInterval(timer);
        el.textContent = '5 på rad ' + signed(value);
      }
    }, 70);
  }

  function slotMarkup(slot, action, label) {
    var when = new Date(slot.updatedAt);
    var date = isNaN(when.getTime()) ? '' : when.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
    return '<article class="slot"><strong>' + formatScore(slot.score) + ' poeng</strong><p>'
      + slot.verses + ' vers · rekke ' + slot.streak + (date ? ' · ' + date : '')
      + '</p><button type="button" class="secondary" data-' + action + '="' + esc(slot.id) + '">' + label + '</button></article>';
  }

  function renderGate() {
    var gate = document.getElementById('gate');
    var list = document.getElementById('slot-list');
    var overwrite = document.getElementById('overwrite');
    var overwriteList = document.getElementById('overwrite-list');
    gate.hidden = !!state.game && !state.overwrite;
    list.innerHTML = state.store.slots.map(function (slot) {
      return slotMarkup(slot, 'continue', 'Fortsett');
    }).join('');
    overwrite.hidden = !state.overwrite;
    overwriteList.innerHTML = state.overwrite ? state.store.slots.map(function (slot) {
      return slotMarkup(slot, 'overwrite', 'Overskriv');
    }).join('') : '';
    document.getElementById('new-game').hidden = state.overwrite;
  }

  function renderMenuSlots() {
    var host = document.getElementById('menu-slots');
    if (!host) return;
    host.innerHTML = state.store.slots.map(function (slot) {
      return slotMarkup(slot, 'continue', 'Fortsett');
    }).join('');
  }

  function showGate() {
    state.overwrite = false;
    if (state.game) rememberVerse();
    save();
    state.game = null;
    renderGate();
    renderMenuSlots();
  }

  function beginNewGame() {
    var settings = state.game || (state.store.slots[0] || null);
    if (state.store.slots.length >= 3) {
      state.overwrite = true;
      state.game = null;
      renderGate();
      return;
    }
    var game = blankGame(settings);
    state.store.slots.unshift(game);
    startGame(game, false);
  }

  function startGame(game, resume) {
    state.game = game;
    state.overwrite = false;
    document.documentElement.dataset.motion = game.motion;
    document.getElementById('gate').hidden = true;
    var requestId = ++state.requestId;
    loadBible(game.translation).then(function (bible) {
      if (requestId !== state.requestId) return;
      useBible(bible, resume);
    }).catch(function () {
      if (requestId !== state.requestId) return;
      showError();
    });
  }

  function onGateClick(event) {
    var button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.continue) {
      var slot = state.store.slots.find(function (item) { return item.id === button.dataset.continue; });
      if (slot) startGame(slot, true);
    }
    if (button.dataset.overwrite) {
      var index = state.store.slots.findIndex(function (item) { return item.id === button.dataset.overwrite; });
      if (index < 0) return;
      var game = blankGame(state.store.slots[index]);
      state.store.slots.splice(index, 1);
      state.store.slots.unshift(game);
      startGame(game, false);
    }
  }

  function pushLog(solved) {
    state.game.log.unshift({
      ref: shortRef(),
      solved: solved,
      awarded: state.round.awarded,
    });
  }

  function touchScore(delta) {
    state.game.score = Math.round((state.game.score + delta) * 10) / 10;
    state.scoreDelta = delta;
  }

  function awardLevel(field, wrongs) {
    var points = S.pointsAfterWrongs(wrongs);
    state.round[field] = points;
    state.round.guessing += points;
    touchScore(points);
    if (wrongs > 0) state.game.streak = 0;
  }

  function finishVerse(gaveUp) {
    var result = S.completeVerse({
      gaveUp: gaveUp,
      helpUsed: state.round.helpUsed,
      bookDone: state.round.bookPoints !== null,
      chapterDone: state.round.chapterPoints !== null,
      verseDone: state.round.versePoints !== null,
      bookWrongs: state.round.bookWrongs,
      chapterWrongs: state.round.chapterWrongs,
      verseWrongs: state.round.verseWrongs,
      guessing: state.round.guessing,
      streak: state.game.streak,
    });
    state.game.streak = result.streak;
    if (result.bonus) {
      state.game.score = Math.round((state.game.score + result.bonus) * 10) / 10;
      state.scoreDelta = Math.round(((state.scoreDelta || 0) + result.bonus) * 10) / 10;
    }
    state.round.awarded = result.total;
    state.round.status = gaveUp ? 'revealed' : 'correct';
    state.game.verses += 1;
    state.game.inProgress = null;
    pushLog(!gaveUp);
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
    if (!state.game || state.round.status !== 'play') return false;
    var roll = Math.random();
    var placed = false;
    if (!state.solvedBook) {
      state.bookWindow = Q.bookHintWindow(state.bible.books.length, state.target.bookIndex, roll);
      placed = true;
    } else if (!state.solvedChapter) {
      var numbers = chapterNumbers(state.bible.books[state.target.bookIndex]);
      var index = numbers.indexOf(state.target.chapter);
      if (index < 0) return false;
      state.chapterWindow = Q.bookHintWindow(numbers.length, index, roll);
      placed = true;
    } else {
      var verses = verseList();
      var verseIndex = -1;
      for (var i = 0; i < verses.length; i += 1) {
        if (verses[i].key === state.target.key) verseIndex = i;
      }
      if (verseIndex < 0) return false;
      state.verseWindow = Q.bookHintWindow(verses.length, verseIndex, roll);
      placed = true;
    }
    if (!placed) return false;
    var draw = S.drawFiveRow(Math.random);
    state.round.fiveRowUses += 1;
    state.round.helpUsed = true;
    state.game.streak = 0;
    touchScore(draw.value);
    state.pendingDraw = draw.value;
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
    if (!state.game || !state.game.lys || state.round.status !== 'play') return;
    var shown = level === 'book' ? state.bookWindow : level === 'chapter' ? state.chapterWindow : state.verseWindow;
    if (shown) return;
    var wrongs = level === 'book' ? state.wrongBooks : level === 'chapter' ? state.wrongChapters : state.wrongVerses;
    if (Object.keys(wrongs).length !== 1) return;
    levelHint();
  }

  function extraHelp() {
    if (!state.game || state.round.status !== 'play') return;
    var book = state.bible.books[state.target.bookIndex];
    if (!Q.contextCanGrow(book.verses, state.target, state.round.radius)) return;
    state.giveUpArmed = false;
    state.round.radius += 1;
    state.round.helpUsed = true;
    state.game.streak = 0;
    touchScore(-S.CONTEXT_COST);
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
    state.giveUpArmed = false;
    finishVerse(true);
    render();
  }

  function chooseBook(index) {
    if (state.round.status !== 'play' || state.solvedBook) return;
    state.giveUpArmed = false;
    if (index === state.target.bookIndex) {
      awardLevel('bookPoints', state.round.bookWrongs);
      state.solvedBook = true;
      state.step = 'chapter';
    } else if (!state.wrongBooks[index]) {
      state.wrongBooks[index] = true;
      state.round.bookWrongs += 1;
      state.game.streak = 0;
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
      awardLevel('chapterPoints', state.round.chapterWrongs);
      state.solvedChapter = true;
      state.step = 'verse';
    } else if (!state.wrongChapters[number]) {
      state.wrongChapters[number] = true;
      state.round.chapterWrongs += 1;
      state.game.streak = 0;
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
      awardLevel('versePoints', state.round.verseWrongs);
      finishVerse(false);
    } else if (!state.wrongVerses[key]) {
      state.wrongVerses[key] = true;
      state.round.verseWrongs += 1;
      state.game.streak = 0;
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
    var draw = state.pendingDraw;
    state.pendingDraw = null;
    if (draw != null) playDraw(draw);
    requestAnimationFrame(fitPassage);
  }

  function renderStats() {
    var game = state.game;
    var playing = state.round.status === 'play';
    var roundNo = game ? game.verses + (playing && state.target ? 1 : 0) : 0;
    var translation = state.bible ? state.bible.name : '';
    document.getElementById('quiz-info').textContent = game
      ? 'Vers ' + roundNo + (translation ? ' · ' + translation : '') + levelLine()
      : 'Ingen spill';
    var hint = game && state.target ? String(state.round.fiveRowUses) : '0';
    if (state.round.radius) hint += ' · kontekst ' + state.round.radius;
    document.getElementById('hint-info').textContent = hint;
    document.getElementById('score-info').textContent = game ? formatScore(game.score) : '0';
    var list = document.getElementById('log-list');
    var log = game ? game.log : [];
    if (!log.length) {
      list.innerHTML = '<li class="log-empty">Ingen vers ennå.</li>';
    } else {
      list.innerHTML = log.map(function (item) {
        var kind = item.solved ? 'is-solved' : 'is-lost';
        return '<li class="' + kind + '"><span>' + esc(item.ref) + '</span><span>' + signed(item.awarded) + '</span></li>';
      }).join('');
    }
    paintBoard(state.scoreDelta || 0);
    state.scoreDelta = 0;
    renderMenuSlots();
  }

  function levelLine() {
    if (!state.target) return '';
    function bit(label, value) {
      return label + ' ' + (value === null ? '…' : signed(value));
    }
    return ' · ' + bit('Bok', state.round.bookPoints) + ' · ' + bit('Kapittel', state.round.chapterPoints) + ' · ' + bit('Vers', state.round.versePoints);
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
      + '<button type="button" class="secondary" data-act="hint">5 på rad</button>'
      + '<button type="button" class="secondary" data-act="extra"' + extraDisabled + '>mer kontekst</button>'
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
    var settings = state.game || { translation: 'noblb', motion: 'stille', lys: false };
    document.querySelectorAll('input[name="translation"]').forEach(function (input) {
      input.checked = input.value === settings.translation;
    });
    document.querySelectorAll('input[name="motion"]').forEach(function (input) {
      input.checked = input.value === settings.motion;
    });
    var lys = document.getElementById('lys');
    if (lys) lys.checked = !!settings.lys;
    document.getElementById('toggle-log').setAttribute('aria-pressed', state.panel === 'log' ? 'true' : 'false');
    document.getElementById('toggle-menu').setAttribute('aria-pressed', state.panel === 'menu' ? 'true' : 'false');
    logPanel.classList.toggle('is-open', state.panel === 'log');
    menuPanel.classList.toggle('is-open', state.panel === 'menu');
  }

  function setTranslation(id) {
    if (!state.game) return;
    if (id !== 'noblb' && id !== 'norsk1930' && id !== 'bsb') return;
    if (id === state.game.translation && state.bible && state.bible.id === id) return;
    state.game.translation = id;
    state.game.inProgress = null;
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
    if (!state.game) return;
    state.game.lys = !!on;
    save();
  }

  function inWindow(window, position) {
    return window && position >= window.start && position <= window.end;
  }

  function setMotion(motion) {
    if (!state.game) return;
    if (motion !== 'stille' && motion !== 'rolig' && motion !== 'levende') return;
    state.game.motion = motion;
    document.documentElement.dataset.motion = motion;
    save();
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
  menuPanel.addEventListener('click', onGateClick);
  menuPanel.addEventListener('change', function (event) {
    if (event.target.name === 'translation') setTranslation(event.target.value);
    if (event.target.name === 'motion') setMotion(event.target.value);
    if (event.target.id === 'lys') setLys(event.target.checked);
  });
  picker.addEventListener('click', onPickerClick);
  actions.addEventListener('click', onActionClick);
  document.getElementById('gate').addEventListener('click', onGateClick);
  document.getElementById('new-game').addEventListener('click', function () { beginNewGame(); });
  document.getElementById('menu-new').addEventListener('click', function () { beginNewGame(); });
  document.getElementById('menu-continue').addEventListener('click', showGate);
  document.getElementById('overwrite-cancel').addEventListener('click', function () {
    state.overwrite = false;
    renderGate();
  });

  document.documentElement.dataset.motion = state.game ? state.game.motion : 'stille';
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
  renderGate();
})();
