const CONTRACTION_MAP: Record<string, string> = {
  "it's": 'it is',
  "don't": 'do not',
  "doesn't": 'does not',
  "can't": 'cannot',
  "won't": 'will not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "i'm": 'i am',
  "you're": 'you are',
  "they're": 'they are',
  "we're": 'we are',
  "he's": 'he is',
  "she's": 'she is',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "where's": 'where is',
  "who's": 'who is',
  "let's": 'let us',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "we'll": 'we will',
  "they'll": 'they will',
  "i'd": 'i would',
  "you'd": 'you would',
  "he'd": 'he would',
  "she'd": 'she would',
  "we'd": 'we would',
  "they'd": 'they would',
};

const contractionPattern = new RegExp(
  `\\b(${Object.keys(CONTRACTION_MAP)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\b`,
  'gi',
);

export function normalizeForComparison(text: string): string {
  return text
    .replace(/[’]/g, "'")
    .replace(contractionPattern, (match) => CONTRACTION_MAP[match.toLowerCase()] ?? match)
    .replace(/[.?!,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
