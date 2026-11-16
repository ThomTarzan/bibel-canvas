import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const S = require('../score.js');

test('each level pays by try and never goes below zero', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(S.pointsForTry), [45, 30, 20, 10, 5, 0, 0]);
  assert.equal(S.pointsAfterWrongs(0), 45);
  assert.equal(S.pointsAfterWrongs(4), 5);
  assert.equal(S.pointsAfterWrongs(5), 0);
  assert.equal(S.pointsForTry(1) * 3, 135);
});

test('the streak multiplier caps at 2 and only rewards a clean verse', () => {
  assert.equal(S.multiplier(1), 1);
  assert.equal(S.multiplier(2), 1.5);
  assert.equal(S.multiplier(3), 2);
  assert.equal(S.multiplier(8), 2);
  const clean = {
    gaveUp: false,
    helpUsed: false,
    bookDone: true,
    chapterDone: true,
    verseDone: true,
    bookWrongs: 0,
    chapterWrongs: 0,
    verseWrongs: 0,
    guessing: 135,
    streak: 1,
  };
  const second = S.completeVerse(clean);
  assert.equal(second.perfect, true);
  assert.equal(second.streak, 2);
  assert.equal(second.multiplier, 1.5);
  assert.equal(second.total, 202.5);
  const third = S.completeVerse(Object.assign({}, clean, { streak: 2 }));
  assert.equal(third.total, 270);
  const helped = S.completeVerse(Object.assign({}, clean, { helpUsed: true, streak: 4 }));
  assert.equal(helped.perfect, false);
  assert.equal(helped.streak, 0);
  assert.equal(helped.total, 135);
  const missed = S.completeVerse(Object.assign({}, clean, { chapterWrongs: 1, guessing: 120, streak: 2 }));
  assert.equal(missed.streak, 0);
  assert.equal(missed.total, 120);
  const quit = S.completeVerse(Object.assign({}, clean, { gaveUp: true, verseDone: false, guessing: 45, streak: 3 }));
  assert.equal(quit.streak, 0);
  assert.equal(quit.total, 45);
});

test('5 på rad draws uniformly from the published list', () => {
  assert.equal(S.FIVE_ROW.length, 27);
  assert.deepEqual(S.FIVE_ROW, [-25, -15, -15, -15, -15, -10, -10, -10, -10, -10, -10, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, 0, 0, 0, 5]);
  const seen = new Array(27).fill(0);
  for (let i = 0; i < 27; i += 1) {
    const draw = S.drawFiveRow(() => (i + 0.5) / 27);
    assert.equal(draw.index, i);
    assert.equal(draw.value, S.FIVE_ROW[i]);
    seen[draw.index] += 1;
  }
  assert.deepEqual(seen, new Array(27).fill(1));
  assert.equal(S.drawFiveRow(() => 0).index, 0);
  assert.equal(S.drawFiveRow(() => 0.999999).index, 26);
  assert.equal(S.CONTEXT_COST, 2);
});
