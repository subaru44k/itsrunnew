import japaneseNames from './competition-names-ja.json';

// Keep source names intact for provenance, search and race classification.
// Exact keys prevent partial replacements from leaking English venue suffixes.
export function competitionLabel(name: string): string {
  return (japaneseNames as Record<string, string>)[name] ?? name;
}
