#!/usr/bin/env python3
"""Bygg kompakte NT-JSON-filer til Bibel-quiz.

Laster ned to kilder og skriver quiz/data/noblb.json og quiz/data/norsk1930.json.

1. En Levende Bok (eBible id noblb), USFX:
   https://ebible.org/Scriptures/noblb_usfx.zip
2. Bibelen 1930, CrossWire SWORD-modul Norsk (public domain, KJV-versifisering).
   Filnavnet på speilet er Norsk.zip (norsk.zip svarer 404):
   https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Norsk.zip

Krever pysword (se requirements.txt). Fotnoter, henvisninger og overskrifter
fjernes. Verseteksten beholdes. Tomme vers tas ikke med.

    python3 quiz/tools/build_texts.py
    python3 quiz/tools/build_texts.py --refresh
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CACHE = Path(__file__).resolve().parent / ".cache"
UA = "bibel-quiz-build/0.1 (+https://github.com/thomtarzan/bibel-canvas)"

NOBLB_URL = "https://ebible.org/Scriptures/noblb_usfx.zip"
NORSK_URLS = (
    "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/norsk.zip",
    "https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/Norsk.zip",
)

# Canonical NT order. UI names live in the app; ids are shared with the JSON.
BOOKS = (
    ("MAT", "mat", "Matt"),
    ("MRK", "mrk", "Mark"),
    ("LUK", "luk", "Luke"),
    ("JHN", "joh", "John"),
    ("ACT", "apg", "Acts"),
    ("ROM", "rom", "Rom"),
    ("1CO", "1kor", "1Cor"),
    ("2CO", "2kor", "2Cor"),
    ("GAL", "gal", "Gal"),
    ("EPH", "efe", "Eph"),
    ("PHP", "fil", "Phil"),
    ("COL", "kol", "Col"),
    ("1TH", "1tess", "1Thess"),
    ("2TH", "2tess", "2Thess"),
    ("1TI", "1tim", "1Tim"),
    ("2TI", "2tim", "2Tim"),
    ("TIT", "tit", "Titus"),
    ("PHM", "flm", "Phlm"),
    ("HEB", "heb", "Heb"),
    ("JAS", "jak", "Jas"),
    ("1PE", "1pet", "1Pet"),
    ("2PE", "2pet", "2Pet"),
    ("1JN", "1joh", "1John"),
    ("2JN", "2joh", "2John"),
    ("3JN", "3joh", "3John"),
    ("JUD", "jud", "Jude"),
    ("REV", "aap", "Rev"),
)
USFX_TO_ID = {usfx: qid for usfx, qid, _osis in BOOKS}
OSIS_TO_ID = {osis: qid for _usfx, qid, osis in BOOKS}
CANON_IDS = [qid for _usfx, qid, _osis in BOOKS]

KEY_RE = re.compile(r"^(\d+)(?:-(\d+))?$")
NOTE_RE = re.compile(r"<(?:note|title)\b[^>]*>.*?</(?:note|title)>", re.IGNORECASE | re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")
SPACE_RE = re.compile(r"\s+")
SKIP_DEEP = {"f", "x", "note", "fig", "fr", "ft", "fq", "fqa", "fk", "xk", "xo", "xt", "fv"}
SKIP_HEAD = {"s", "h", "toc", "ms", "d", "sp", "periph", "id", "rem"}


def download(urls: tuple[str, ...] | str, dest: Path, refresh: bool) -> str:
    if isinstance(urls, str):
        urls = (urls,)
    if dest.exists() and not refresh:
        print(f"bruker cache {dest.name}")
        return urls[0]
    dest.parent.mkdir(parents=True, exist_ok=True)
    errors: list[str] = []
    for url in urls:
        try:
            print(f"laster ned {url}")
            request = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(request, timeout=180) as response:
                dest.write_bytes(response.read())
            print(f"  {dest.stat().st_size} byte")
            return url
        except Exception as exc:  # noqa: BLE001 - try the next mirror name
            errors.append(f"{url} ({exc})")
    raise SystemExit("Nedlasting feilet:\n" + "\n".join(errors))


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def normalize(text: str) -> str:
    text = text.replace("\u200b", "").replace("\ufeff", "")
    text = SPACE_RE.sub(" ", text).strip()
    return text


def clean_osis(raw: str) -> str:
    text = NOTE_RE.sub("", raw or "")
    text = TAG_RE.sub("", text)
    text = html.unescape(text)
    return normalize(text)


class UsfxParser:
    def __init__(self) -> None:
        self.books: list[dict] = []
        self.book_id: str | None = None
        self.chapter = 0
        self.chapters: dict[int, list[list[str]]] = {}
        self.current: dict | None = None
        self.empty = 0

    def parse(self, xml_bytes: bytes) -> list[dict]:
        root = ElementTree.fromstring(xml_bytes)
        for child in root:
            if local(child.tag) == "book":
                self.book(child)
        return self.books

    def book(self, elem: ElementTree.Element) -> None:
        usfx = elem.get("id") or ""
        self.book_id = USFX_TO_ID.get(usfx)
        if not self.book_id:
            raise SystemExit(f"Ukjent bok i USFX: {usfx}")
        self.chapter = 0
        self.chapters = {}
        self.current = None
        for child in elem:
            self.walk(child)
        self.end_verse()
        max_ch = max(self.chapters) if self.chapters else 0
        chapters = [dedupe(self.chapters.get(n, [])) for n in range(1, max_ch + 1)]
        self.books.append({"id": self.book_id, "chapters": chapters})
        self.book_id = None

    def walk(self, elem: ElementTree.Element) -> None:
        tag = local(elem.tag)
        if tag in SKIP_DEEP or tag in SKIP_HEAD:
            # Footnotes and headings drop their own text. Text after them
            # still belongs to the open verse.
            if self.current is not None and elem.tail:
                self.current["parts"].append(elem.tail)
            return
        if tag == "c":
            self.end_verse()
            self.chapter = int(elem.get("id") or "0")
        elif tag == "v":
            self.end_verse()
            self.current = {"id": elem.get("id") or "", "parts": []}
        elif tag == "ve":
            self.end_verse()
        elif tag == "lb":
            if self.current is not None:
                self.current["parts"].append(" ")
        elif self.current is not None and elem.text:
            self.current["parts"].append(elem.text)
        for child in list(elem):
            self.walk(child)
        if self.current is not None and elem.tail:
            self.current["parts"].append(elem.tail)

    def end_verse(self) -> None:
        if not self.current:
            return
        text = normalize("".join(self.current["parts"]))
        key = self.current["id"]
        self.current = None
        if not KEY_RE.match(key):
            raise SystemExit(f"Uventet vers-id {key!r} i {self.book_id}")
        if not text:
            self.empty += 1
            return
        if "<" in text:
            raise SystemExit(f"Markup igjen i {self.book_id} {self.chapter}:{key}")
        self.chapters.setdefault(self.chapter, []).append([key, text])


def dedupe(verses: list[list[str]]) -> list[list[str]]:
    out: list[list[str]] = []
    for key, text in verses:
        if out and out[-1][0] == key:
            out[-1][1] = normalize(out[-1][1] + " " + text)
        else:
            out.append([key, text])
    return out


def parse_key(key: str) -> tuple[int, int]:
    match = KEY_RE.match(key)
    if not match:
        raise SystemExit(f"Ugyldig versnøkkel {key}")
    start = int(match.group(1))
    end = int(match.group(2) or start)
    return start, end


def coverage(book: dict) -> tuple[int, int]:
    entries = 0
    numbers = 0
    for chapter in book["chapters"]:
        for key, _text in chapter:
            start, end = parse_key(key)
            entries += 1
            numbers += end - start + 1
    return entries, numbers


def order_books(books: list[dict]) -> list[dict]:
    found = {book["id"]: book for book in books}
    missing = [qid for qid in CANON_IDS if qid not in found]
    if missing or len(found) != 27:
        raise SystemExit(f"Forventet 27 NT-bøker, mangler {missing}")
    return [found[qid] for qid in CANON_IDS]


def find_text(data: dict, book_id: str, chapter: int, verse: int) -> str:
    book = next(item for item in data["books"] if item["id"] == book_id)
    for key, text in book["chapters"][chapter - 1]:
        start, end = parse_key(key)
        if start <= verse <= end:
            return text
    raise SystemExit(f"Mangler {book_id} {chapter},{verse}")


def require_phrase(label: str, text: str, phrase: str) -> None:
    if phrase not in text:
        raise SystemExit(f"{label} mangler {phrase!r}:\n{text}")
    print(f"  {label}: {text}")


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"skrev {path} ({path.stat().st_size} byte)")


def summarize(data: dict) -> tuple[int, int]:
    entries = numbers = 0
    print(f"{data['id']}: {data['name']}")
    for book in data["books"]:
        entry_count, number_count = coverage(book)
        entries += entry_count
        numbers += number_count
        print(f"  {book['id']:5} {entry_count:4} oppføringer, {number_count:4} versnummer, {len(book['chapters']):2} kapitler")
    print(f"  sum {entries} oppføringer, {numbers} versnummer dekket")
    if not 7500 <= entries <= 8200:
        raise SystemExit(f"Uventet antall versoppføringer: {entries}")
    return entries, numbers


def build_noblb(refresh: bool) -> dict:
    url = download(NOBLB_URL, CACHE / "noblb_usfx.zip", refresh)
    with zipfile.ZipFile(CACHE / "noblb_usfx.zip") as archive:
        xml_bytes = archive.read("noblb_usfx.xml")
    parser = UsfxParser()
    books = order_books(parser.parse(xml_bytes))
    if parser.empty:
        print(f"  tomme vers hoppet over: {parser.empty}")
    return {
        "id": "noblb",
        "name": "En Levende Bok",
        "source": url,
        "books": books,
    }


def build_norsk(refresh: bool) -> dict:
    try:
        from pysword.modules import SwordModules
    except ImportError as exc:
        raise SystemExit("pysword mangler. Installer med: pip install -r quiz/tools/requirements.txt") from exc

    url = download(NORSK_URLS, CACHE / "Norsk.zip", refresh)
    modules = SwordModules(str(CACHE / "Norsk.zip"))
    modules.parse_modules()
    bible = modules.get_bible_from_module("Norsk")
    structure = bible.get_structure().get_books()["nt"]
    by_osis = {book.osis_name: book for book in structure}
    books = []
    for _usfx, qid, osis in BOOKS:
        book = by_osis.get(osis)
        if book is None:
            raise SystemExit(f"SWORD-modulen mangler {osis}")
        texts = list(bible.get_iter(books=book.name, clean=False))
        expected = sum(book.chapter_lengths)
        if len(texts) != expected:
            raise SystemExit(f"{osis}: fikk {len(texts)} vers, ventet {expected}")
        chapters = []
        index = 0
        for length in book.chapter_lengths:
            verses = []
            for verse_no in range(1, length + 1):
                text = clean_osis(texts[index])
                index += 1
                if not text:
                    continue
                if "<" in text:
                    raise SystemExit(f"Markup igjen i {osis} {len(chapters)+1},{verse_no}")
                verses.append([str(verse_no), text])
            chapters.append(verses)
        books.append({"id": qid, "chapters": chapters})
    return {
        "id": "norsk1930",
        "name": "Bibelen 1930",
        "source": url,
        "books": books,
    }


def spot_check(noblb: dict, norsk: dict) -> None:
    print("stikkprøver")
    require_phrase("ELB Joh 3,16", find_text(noblb, "joh", 3, 16), "elsket")
    require_phrase("ELB Rom 8,28", find_text(noblb, "rom", 8, 28), "elsker")
    require_phrase("1930 Joh 3,16", find_text(norsk, "joh", 3, 16), "elsket verden")
    require_phrase("1930 Rom 8,28", find_text(norsk, "rom", 8, 28), "elsker Gud")
    matt = find_text(noblb, "mat", 1, 1)
    if "Messias" in matt or "<" in matt:
        raise SystemExit(f"Fotnote lekket inn i Matt 1,1: {matt}")
    acts = find_text(norsk, "apg", 9, 36)
    if "hind" in acts or "note" in acts:
        raise SystemExit(f"Fotnote lekket inn i Apg 9,36: {acts}")
    cor = find_text(norsk, "1kor", 11, 1)
    if "1KO" in cor:
        raise SystemExit(f"Vershenvisning lekket inn i 1 Kor 11,1: {cor}")
    print("  fotnoter er fjernet i stikkprøvene")


def main() -> None:
    argument_parser = argparse.ArgumentParser(description="Bygg NT-JSON til Bibel-quiz")
    argument_parser.add_argument("--refresh", action="store_true", help="last ned kildene på nytt")
    args = argument_parser.parse_args()
    noblb = build_noblb(args.refresh)
    norsk = build_norsk(args.refresh)
    noblb_entries, _noblb_numbers = summarize(noblb)
    norsk_entries, _norsk_numbers = summarize(norsk)
    noblb["verseCount"] = noblb_entries
    norsk["verseCount"] = norsk_entries
    spot_check(noblb, norsk)
    write_json(DATA / "noblb.json", noblb)
    write_json(DATA / "norsk1930.json", norsk)


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
