export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "Rom 8,1–4" + 8 Oct 2026 → Rom-8-1-4_2026-10-08.json */
export function projectFilename(reference: string, date: Date, extension: 'json' | 'png' | 'svg' = 'json'): string {
  const slug = reference
    .trim()
    .replace(/[–—]/g, '-')
    .replace(/[,.:;]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^0-9A-Za-zÆØÅæøå-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'bibeltekst'}_${formatIsoDate(date)}.${extension}`;
}
