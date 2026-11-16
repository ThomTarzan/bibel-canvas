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

test('a correct verse with no help awards 4', () => {
  const done = Q.applyCorrect(Q.newRound());
  assert.equal(done.status, 'correct');
  assert.equal(done.awarded, 4);
});

test('the book hint costs one point and can be used again', () => {
  let round = Q.applyBookHint(Q.newRound());
  assert.equal(round.points, 3);
  assert.equal(round.bookHints, 1);
  round = Q.applyBookHint(round);
  assert.equal(round.points, 2);
  assert.equal(round.bookHints, 2);
});

test('a wrong guess costs one point and does not end the round', () => {
  let round = Q.newRound();
  for (let i = 0; i < 6; i += 1) round = Q.applyWrong(round);
  assert.equal(round.status, 'play');
  assert.equal(round.points, -2);
  assert.equal(round.wrongs, 6);
  const won = Q.applyCorrect(round);
  assert.equal(won.status, 'correct');
  assert.equal(won.awarded, -2);
});

test('extra help costs a point and widens the context one step', () => {
  const round = Q.applyExtra(Q.newRound());
  assert.equal(round.points, 3);
  assert.equal(round.extra, 1);
  assert.equal(round.radius, 1);
});

test('giving up with help and misses is negative, and a clean give-up is zero', () => {
  let round = Q.applyBookHint(Q.newRound());
  round = Q.applyWrong(round);
  const lost = Q.applyGiveUp(round);
  assert.equal(lost.status, 'revealed');
  assert.equal(lost.awarded, -2);
  assert.equal(Q.applyGiveUp(Q.newRound()).awarded, 0);
});

test('the five-book window always contains the answer and is clamped', () => {
  assert.deepEqual(Q.bookHintWindow(27, 0, 0), { start: 0, end: 4 });
  assert.deepEqual(Q.bookHintWindow(27, 0, 0.99), { start: 0, end: 4 });
  assert.deepEqual(Q.bookHintWindow(27, 26, 0), { start: 22, end: 26 });
  assert.deepEqual(Q.bookHintWindow(27, 26, 0.99), { start: 22, end: 26 });
  const early = Q.bookHintWindow(27, 10, 0);
  const late = Q.bookHintWindow(27, 10, 0.999);
  assert.deepEqual(early, { start: 6, end: 10 });
  assert.deepEqual(late, { start: 10, end: 14 });
  assert.notEqual(early.start, late.start);
  for (let roll = 0; roll < 1; roll += 0.05) {
    const window = Q.bookHintWindow(27, 10, roll);
    assert.equal(window.end - window.start, 4);
    assert.ok(window.start <= 10 && 10 <= window.end);
  }
});

test('context stays inside the book and can grow until the edge', () => {
  assert.deepEqual(keys(Q.contextFor(verses, { chapter: 1, key: '1' }, 0)), ['1:1*']);
  assert.deepEqual(keys(Q.contextFor(verses, { chapter: 1, key: '1' }, 2)), ['1:1*', '1:2', '2:1']);
  assert.deepEqual(keys(Q.contextFor(verses, { chapter: 2, key: '2-3' }, 3)), ['1:1', '1:2', '2:1', '2:2-3*']);
  assert.equal(Q.contextCanGrow(verses, { chapter: 1, key: '1' }, 0), true);
  assert.equal(Q.contextCanGrow(verses, { chapter: 1, key: '1' }, 20), false);
});

test('the session total can be negative and is compared at the end', () => {
  let session = { score: 0, rounds: 0 };
  session = Q.addRound(session, 4);
  session = Q.addRound(session, -2);
  assert.deepEqual(session, { score: 2, rounds: 2 });
  const first = Q.finishSession(session, null);
  assert.equal(first.text, 'Sum 2. Dette er den første økten.');
  const better = Q.finishSession({ score: 5, rounds: 3 }, first.nextPrevious);
  assert.equal(better.text, 'Sum 5 er høyere enn forrige gang (2).');
  const worse = Q.finishSession({ score: -3, rounds: 2 }, { score: 5, rounds: 3 });
  assert.equal(worse.text, 'Sum −3 er lavere enn forrige gang (5).');
  assert.equal(Q.finishSession({ score: 0, rounds: 0 }, null).ok, false);
});
