/* Bibel-quiz rules. No DOM. Loaded as a classic script and as a CommonJS module. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BibelQuiz = api;
})(typeof window !== 'undefined' ? window : null, function () {
  var START_POINTS = 4;
  var MAX_HINTS = 3;

  function newRound() {
    return {
      points: START_POINTS,
      hints: 0,
      wrongs: 0,
      radius: 0,
      status: 'play',
      feedback: '',
      awarded: 0,
    };
  }

  function canHint(round) {
    return round.status === 'play' && round.hints < MAX_HINTS && round.points > 1 && round.radius < MAX_HINTS;
  }

  function lossValue(hints, wrongs) {
    var spent = hints + wrongs;
    return spent > 0 ? -spent : 0;
  }

  function applyHint(round) {
    if (!canHint(round)) return round;
    return {
      points: round.points - 1,
      hints: round.hints + 1,
      wrongs: round.wrongs,
      radius: round.radius + 1,
      status: 'play',
      feedback: round.feedback,
      awarded: 0,
    };
  }

  function judge(target, guess) {
    if (guess.bookIndex !== target.bookIndex) return 'book';
    if (guess.chapter !== target.chapter) return 'chapter';
    if (guess.key !== target.key) return 'verse';
    return 'correct';
  }

  function feedbackFor(kind) {
    if (kind === 'book') return 'Feil bok';
    if (kind === 'chapter') return 'Riktig bok';
    if (kind === 'verse') return 'Riktig kapittel';
    return '';
  }

  function applyGuess(round, kind) {
    if (round.status !== 'play') return round;
    if (kind === 'correct') {
      return {
        points: round.points,
        hints: round.hints,
        wrongs: round.wrongs,
        radius: round.radius,
        status: 'correct',
        feedback: 'Riktig',
        awarded: round.points,
      };
    }
    var feedback = feedbackFor(kind);
    if (round.points <= 1) {
      var wrongs = round.wrongs + 1;
      return {
        points: 0,
        hints: round.hints,
        wrongs: wrongs,
        radius: round.radius,
        status: 'revealed',
        feedback: feedback,
        awarded: lossValue(round.hints, wrongs),
      };
    }
    return {
      points: round.points - 1,
      hints: round.hints,
      wrongs: round.wrongs + 1,
      radius: Math.min(MAX_HINTS, round.radius + 1),
      status: 'play',
      feedback: feedback,
      awarded: 0,
    };
  }

  function applyGiveUp(round) {
    if (round.status !== 'play') return round;
    return {
      points: 0,
      hints: round.hints,
      wrongs: round.wrongs,
      radius: round.radius,
      status: 'revealed',
      feedback: 'Tap',
      awarded: lossValue(round.hints, round.wrongs),
    };
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
    MAX_HINTS: MAX_HINTS,
    newRound: newRound,
    canHint: canHint,
    lossValue: lossValue,
    applyHint: applyHint,
    judge: judge,
    applyGuess: applyGuess,
    applyGiveUp: applyGiveUp,
    contextFor: contextFor,
    addRound: addRound,
    plain: plain,
    comparisonText: comparisonText,
    finishSession: finishSession,
  };
});
