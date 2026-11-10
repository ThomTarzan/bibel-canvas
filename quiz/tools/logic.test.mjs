import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Q = require('../logic.js');

const verses = [
  { chapter: 1, key: '1', text: 'første' },
  { chapter: 1, key: '2', text: 'andre' },
  { chapter: 2, key: '1', text: 'neste kapittel' },
  { chapter: 2, key: '2-3', text: 'slått sammen' },
];

function keys(list) {
  return list.map((item) => `${item.chapter}:${item.key}${item.target ? '*' : ''}`);
}

test('a correct answer with no help awards 4', () => {
  const done = Q.applyGuess(Q.newRound(), 'correct');
  assert.equal(done.status, 'correct');
  assert.equal(done.awarded, 4);
});

test('each hint costs a point and grows the context, and stops at 3', () => {
  let round = Q.newRound();
  round = Q.applyHint(round);
  round = Q.applyHint(round);
  round = Q.applyHint(round);
  assert.equal(round.points, 1);
  assert.equal(round.radius, 3);
  assert.equal(round.hints, 3);
  assert.equal(Q.canHint(round), false);
  const again = Q.applyHint(round);
  assert.equal(again, round);
  const won = Q.applyGuess(round, 'correct');
  assert.equal(won.awarded, 1);
});

test('wrong answers use the same cost and the specified feedback', () => {
  let round = Q.applyGuess(Q.newRound(), 'book');
  assert.equal(round.feedback, 'Feil bok');
  assert.equal(round.points, 3);
  assert.equal(round.radius, 1);
  assert.equal(round.status, 'play');

  round = Q.applyGuess(round, 'chapter');
  assert.equal(round.feedback, 'Riktig bok');
  assert.equal(round.points, 2);

  round = Q.applyGuess(round, 'verse');
  assert.equal(round.feedback, 'Riktig kapittel');
  assert.equal(round.points, 1);
  assert.equal(Q.canHint(round), false);

  const lost = Q.applyGuess(round, 'verse');
  assert.equal(lost.status, 'revealed');
  assert.equal(lost.awarded, -4);
  assert.equal(lost.feedback, 'Riktig kapittel');
});

test('hints together with a loss give a negative score', () => {
  let round = Q.newRound();
  round = Q.applyHint(round);
  round = Q.applyHint(round);
  const givenUp = Q.applyGiveUp(round);
  assert.equal(givenUp.status, 'revealed');
  assert.equal(givenUp.awarded, -2);

  let hinted = Q.applyHint(Q.applyHint(Q.applyHint(Q.newRound())));
  const missed = Q.applyGuess(hinted, 'book');
  assert.equal(missed.awarded, -4);
  assert.equal(missed.feedback, 'Feil bok');
});

test('giving up before any hint or miss scores zero', () => {
  const givenUp = Q.applyGiveUp(Q.newRound());
  assert.equal(givenUp.awarded, 0);
  assert.equal(givenUp.status, 'revealed');
});

test('judge compares book, then chapter, then verse', () => {
  const target = { bookIndex: 3, chapter: 3, key: '16' };
  assert.equal(Q.judge(target, { bookIndex: 0, chapter: 3, key: '16' }), 'book');
  assert.equal(Q.judge(target, { bookIndex: 3, chapter: 4, key: '16' }), 'chapter');
  assert.equal(Q.judge(target, { bookIndex: 3, chapter: 3, key: '17' }), 'verse');
  assert.equal(Q.judge(target, { bookIndex: 3, chapter: 3, key: '16' }), 'correct');
});

test('context stays inside the book and crosses chapters', () => {
  const only = Q.contextFor(verses, { chapter: 1, key: '1' }, 0);
  assert.deepEqual(keys(only), ['1:1*']);

  const start = Q.contextFor(verses, { chapter: 1, key: '1' }, 2);
  assert.deepEqual(keys(start), ['1:1*', '1:2', '2:1']);

  const end = Q.contextFor(verses, { chapter: 2, key: '2-3' }, 3);
  assert.deepEqual(keys(end), ['1:1', '1:2', '2:1', '2:2-3*']);

  const across = Q.contextFor(verses, { chapter: 2, key: '1' }, 1);
  assert.deepEqual(keys(across), ['1:2', '2:1*', '2:2-3']);
});

test('the session total can be negative and is compared at the end', () => {
  let session = { score: 0, rounds: 0 };
  session = Q.addRound(session, 4);
  session = Q.addRound(session, -2);
  assert.deepEqual(session, { score: 2, rounds: 2 });

  const first = Q.finishSession(session, null);
  assert.equal(first.ok, true);
  assert.equal(first.text, 'Sum 2. Dette er den første økten.');
  assert.deepEqual(first.nextSession, { score: 0, rounds: 0 });

  const better = Q.finishSession({ score: 5, rounds: 3 }, first.nextPrevious);
  assert.equal(better.text, 'Sum 5 er høyere enn forrige gang (2).');

  const worse = Q.finishSession({ score: -3, rounds: 2 }, { score: 5, rounds: 3 });
  assert.equal(worse.text, 'Sum −3 er lavere enn forrige gang (5).');

  const same = Q.finishSession({ score: 5, rounds: 1 }, { score: 5, rounds: 3 });
  assert.equal(same.text, 'Sum 5 er den samme som forrige gang.');

  assert.equal(Q.finishSession({ score: 0, rounds: 0 }, null).ok, false);
});
