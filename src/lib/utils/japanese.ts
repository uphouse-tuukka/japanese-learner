export type Segment =
  | { type: 'text'; content: string }
  | {
      type: 'japanese';
      content: string;
      japanese: string;
      romaji: string | null;
    };

const JAPANESE_CHAR_CLASS =
  '[\\u3040-\\u309F\\u30A0-\\u30FF\\u31F0-\\u31FF\\u3400-\\u4DBF\\u4E00-\\u9FFF]';
const JAPANESE_CHAR_REGEX = new RegExp(JAPANESE_CHAR_CLASS, 'u');
const JAPANESE_CHAR_GLOBAL_REGEX = new RegExp(JAPANESE_CHAR_CLASS, 'gu');

// Keep phrases together when punctuation or spacing appears between Japanese characters.
const JAPANESE_INTERNAL_JOINER_CLASS =
  '[\\u3000\\u3001\\u3002\\u30FB\\u300C\\u300D\\u300E\\u300F\\uFF08\\uFF09\\u3010\\u3011\\u3008\\u3009\\u300A\\u300B\\u301C\\u2026\\uFF01\\uFF1F\\u30FC]';
const JAPANESE_PHRASE_PATTERN = `${JAPANESE_CHAR_CLASS}(?:${JAPANESE_INTERNAL_JOINER_CLASS}*${JAPANESE_CHAR_CLASS})*`;
const JAPANESE_SEGMENT_REGEX = new RegExp(`(${JAPANESE_PHRASE_PATTERN})(?: \\(([^)]+)\\))?`, 'gu');

export function containsJapanese(text: string): boolean {
  return JAPANESE_CHAR_REGEX.test(text);
}

export function parseJapaneseSegments(text: string): Segment[] {
  if (text.length === 0) {
    return [];
  }

  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(JAPANESE_SEGMENT_REGEX)) {
    const fullMatch = match[0];
    const japanese = match[1] ?? '';
    const romaji = match[2] ?? null;
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, matchIndex),
      });
    }

    segments.push({
      type: 'japanese',
      content: fullMatch,
      japanese,
      romaji,
    });

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  if (segments.length === 0) {
    return [{ type: 'text', content: text }];
  }

  return segments;
}

export function extractJapaneseText(text: string): string {
  return text.match(JAPANESE_CHAR_GLOBAL_REGEX)?.join('') ?? '';
}
