/* Bibel-quiz rules. No DOM. Loaded as a classic script and as a CommonJS module. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BibelQuiz = api;
})(typeof window !== 'undefined' ? window : null, function () {
  var START_POINTS = 4;
  var BOOK_HINT_WIDTH = 5;

  function newRound() {
    return {
      points: START_POINTS,
      bookHints: 0,
      extra: 0,
      wrongs: 0,
      radius: 0,
      status: 'play',
      awarded: 0,
    };
  }

  function spent(round) {
    return round.bookHints + round.extra + round.wrongs;
  }

  function charge(round, field) {
    var next = {
      points: round.points - 1,
      bookHints: round.bookHints,
      extra: round.extra,
      wrongs: round.wrongs,
      radius: round.radius,
      status: 'play',
      awarded: 0,
    };
    next[field] = round[field] + 1;
    return next;
  }

  function applyBookHint(round) {
    if (round.status !== 'play') return round;
    return charge(round, 'bookHints');
  }

  function applyExtra(round) {
    if (round.status !== 'play') return round;
    var next = charge(round, 'extra');
    next.radius = round.radius + 1;
    return next;
  }

  function applyWrong(round) {
    if (round.status !== 'play') return round;
    return charge(round, 'wrongs');
  }

  function applyCorrect(round) {
    if (round.status !== 'play') return round;
    return {
      points: round.points,
      bookHints: round.bookHints,
      extra: round.extra,
      wrongs: round.wrongs,
      radius: round.radius,
      status: 'correct',
      awarded: round.points,
    };
  }

  function applyGiveUp(round) {
    if (round.status !== 'play') return round;
    var cost = spent(round);
    return {
      points: 0,
      bookHints: round.bookHints,
      extra: round.extra,
      wrongs: round.wrongs,
      radius: round.radius,
      status: 'revealed',
      awarded: cost > 0 ? -cost : 0,
    };
  }

  function bookHintWindow(bookCount, correctIndex, roll) {
    var width = Math.min(BOOK_HINT_WIDTH, bookCount);
    var minStart = Math.max(0, correctIndex - (width - 1));
    var maxStart = Math.min(correctIndex, bookCount - width);
    var span = maxStart - minStart + 1;
    var offset = Math.floor(roll * span);
    if (offset < 0) offset = 0;
    if (offset >= span) offset = span - 1;
    var start = minStart + offset;
    return { start: start, end: start + width - 1 };
  }

  function contextFor(verses, target, radius) {
    var index = -1;
    for (var i = 0; i < verses.length; i += 1) {
      if (verses[i].chapter === target.chapter && verses[i].key === target.key) {
        index = i;
        break;
      }
    }
    if (index < 0) return [];
    var start = Math.max(0, index - radius);
    var end = Math.min(verses.length, index + radius + 1);
    var out = [];
    for (var n = start; n < end; n += 1) {
      out.push({
        chapter: verses[n].chapter,
        key: verses[n].key,
        text: verses[n].text,
        target: n === index,
      });
    }
    return out;
  }

  function contextCanGrow(verses, target, radius) {
    return contextFor(verses, target, radius + 1).length > contextFor(verses, target, radius).length;
  }

  function addRound(session, awarded) {
    return {
      score: session.score + awarded,
      rounds: session.rounds + 1,
    };
  }

  function plain(n) {
    return n < 0 ? '−' + Math.abs(n) : String(n);
  }

  function comparisonText(score, previousScore) {
    var sum = 'Sum ' + plain(score);
    if (previousScore == null) return sum + '. Dette er den første økten.';
    if (score > previousScore) return sum + ' er høyere enn forrige gang (' + plain(previousScore) + ').';
    if (score < previousScore) return sum + ' er lavere enn forrige gang (' + plain(previousScore) + ').';
    return sum + ' er den samme som forrige gang.';
  }

  function finishSession(session, previous) {
    if (!session || session.rounds < 1) return { ok: false };
    var previousScore = previous && Number.isFinite(previous.score) ? previous.score : null;
    return {
      ok: true,
      score: session.score,
      rounds: session.rounds,
      previousScore: previousScore,
      text: comparisonText(session.score, previousScore),
      nextPrevious: { score: session.score, rounds: session.rounds },
      nextSession: { score: 0, rounds: 0 },
    };
  }

  return {
    START_POINTS: START_POINTS,
    BOOK_HINT_WIDTH: BOOK_HINT_WIDTH,
    newRound: newRound,
    spent: spent,
    applyBookHint: applyBookHint,
    applyExtra: applyExtra,
    applyWrong: applyWrong,
    applyCorrect: applyCorrect,
    applyGiveUp: applyGiveUp,
    bookHintWindow: bookHintWindow,
    contextFor: contextFor,
    contextCanGrow: contextCanGrow,
    addRound: addRound,
    plain: plain,
    comparisonText: comparisonText,
    finishSession: finishSession,
  };
});
