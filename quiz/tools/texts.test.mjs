import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const IDS = ['mat', 'mrk', 'luk', 'joh', 'apg', 'rom', '1kor', '2kor', 'gal', 'efe', 'fil', 'kol', '1tess', '2tess', '1tim', '2tim', 'tit', 'flm', 'heb', 'jak', '1pet', '2pet', '1joh', '2joh', '3joh', 'jud', 'aap'];

function load(name) {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
}

function verse(data, bookId, chapter, number) {
  const book = data.books.find((item) => item.id === bookId);
  assert.ok(book, bookId);
  for (const [key, text] of book.chapters[chapter - 1]) {
    const [start, end] = key.split('-').map(Number);
    if (number >= start && number <= (end || start)) return { key, text };
  }
  return null;
}

function count(data) {
  return data.books.reduce((sum, book) => sum + book.chapters.reduce((inner, chapter) => inner + chapter.length, 0), 0);
}

test('both translations cover the New Testament and the known verses', () => {
  const noblb = load('noblb.json');
  const norsk = load('norsk1930.json');

  for (const data of [noblb, norsk]) {
    assert.deepEqual(data.books.map((book) => book.id), IDS);
    for (const book of data.books) {
      for (const chapter of book.chapters) {
        for (const [key, text] of chapter) {
          assert.match(key, /^\d+(?:-\d+)?$/);
          assert.equal(text.includes('<'), false);
          assert.ok(text.trim().length > 0);
        }
      }
    }
  }

  assert.equal(count(noblb), 7748);
  assert.equal(count(norsk), 7957);

  assert.equal(
    verse(noblb, 'joh', 3, 16).text,
    'Gud elsket jo menneskene så høyt at han ga sin eneste Sønn, for at alle som tror på ham, ikke skal gå fortapt, men ha evig liv.',
  );
  assert.equal(
    verse(noblb, 'rom', 8, 28).text,
    'Vi vet at Gud kan bruke alt som skjer, til noe godt for dem som elsker ham, de som i trå med hans plan får tilhøre ham.',
  );
  assert.equal(verse(noblb, 'joh', 3, 1).key, '1-2');
  assert.equal(verse(noblb, 'mat', 1, 1).text.startsWith('Dette er forfedrene til Jesus Kristus'), true);
  assert.equal(verse(noblb, 'mat', 1, 1).text.includes('Messias'), false);

  assert.equal(
    verse(norsk, 'joh', 3, 16).text,
    'For så har Gud elsket verden at han gav sin Sønn, den enbårne, forat hver den som tror på ham, ikke skal fortapes, men ha evig liv;',
  );
  assert.equal(
    verse(norsk, 'rom', 8, 28).text,
    'Og vi vet at alle ting tjener dem til gode som elsker Gud, dem som efter hans råd er kalt.',
  );
  assert.equal(verse(norsk, 'apg', 9, 36).text.includes('hind'), false);
  assert.equal(verse(norsk, '1kor', 11, 1).text.includes('1KO'), false);
  assert.equal(verse(norsk, 'mat', 1, 1).text.startsWith('Jesu Kristi'), true);
});
