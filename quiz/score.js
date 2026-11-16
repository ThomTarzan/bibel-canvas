/* Scoring for Bibel-quiz v0.4. No DOM. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BibelScore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  var LEVEL_BY_TRY = [45, 30, 20, 10, 5];
  var FIVE_ROW = [-25, -15, -15, -15, -15, -10, -10, -10, -10, -10, -10, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, 0, 0, 0, 5];
  var CONTEXT_COST = 2;

  function pointsForTry(tryNumber) {
    if (tryNumber < 1 || tryNumber > LEVEL_BY_TRY.length) return 0;
    return LEVEL_BY_TRY[tryNumber - 1];
  }

  function pointsAfterWrongs(wrongCount) {
    return pointsForTry(wrongCount + 1);
  }

  function multiplier(streak) {
    if (streak >= 3) return 2;
    if (streak === 2) return 1.5;
    return 1;
  }

  function drawFiveRow(rng) {
    var roll = rng();
    var index = Math.floor(roll * FIVE_ROW.length);
    if (index < 0) index = 0;
    if (index >= FIVE_ROW.length) index = FIVE_ROW.length - 1;
    return { index: index, value: FIVE_ROW[index] };
  }

  function completeVerse(verse) {
    var perfect = !verse.gaveUp && !verse.helpUsed
      && verse.bookDone && verse.chapterDone && verse.verseDone
      && verse.bookWrongs === 0 && verse.chapterWrongs === 0 && verse.verseWrongs === 0;
    var streak = perfect ? verse.streak + 1 : 0;
    var mult = perfect ? multiplier(streak) : 1;
    var total = verse.guessing * mult;
    return {
      perfect: perfect,
      streak: streak,
      multiplier: mult,
      bonus: total - verse.guessing,
      total: total,
    };
  }

  return {
    LEVEL_BY_TRY: LEVEL_BY_TRY,
    FIVE_ROW: FIVE_ROW,
    CONTEXT_COST: CONTEXT_COST,
    pointsForTry: pointsForTry,
    pointsAfterWrongs: pointsAfterWrongs,
    multiplier: multiplier,
    drawFiveRow: drawFiveRow,
    completeVerse: completeVerse,
  };
});
