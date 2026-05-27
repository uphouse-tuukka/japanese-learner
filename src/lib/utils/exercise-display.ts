const JAPANESE_SCRIPT_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/u;
const FILL_BLANK_PLACEHOLDER = '____';
const FILL_BLANK_PLACEHOLDER_PATTERN =
  /(?:_{2,}|＿{2,}|\[\s*blank\s*\]|\{\{\s*blank\s*\}\}|\(\s*blank\s*\))/iu;
const FILL_BLANK_PLACEHOLDER_REPLACE_PATTERN =
  /(?:_{2,}|＿{2,}|\[\s*blank\s*\]|\{\{\s*blank\s*\}\}|\(\s*blank\s*\))/giu;
const COUNTERPART_SEPARATOR_PATTERN = /^(?<left>.+?)\s*(?:=|＝|→|->|–|—|:|：)\s*(?<right>.+)$/u;

type MultipleChoiceSourcePromptInput = {
  question: string;
  japanese: string;
  romaji?: string;
  choices: string[];
};

export function containsJapaneseScript(value: string): boolean {
  return JAPANESE_SCRIPT_PATTERN.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasVisibleFillBlankPlaceholder(value: string): boolean {
  return FILL_BLANK_PLACEHOLDER_PATTERN.test(value);
}

function isUsableAnswerCandidate(value: string | undefined): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !hasVisibleFillBlankPlaceholder(trimmed);
}

function replaceFirstAnswerCandidate(text: string, candidate: string): string | null {
  const trimmedCandidate = candidate.trim();
  if (!trimmedCandidate) return null;

  const match = new RegExp(escapeRegExp(trimmedCandidate), 'iu').exec(text);
  if (!match || match.index < 0) return null;

  return `${text.slice(0, match.index)}${FILL_BLANK_PLACEHOLDER}${text.slice(
    match.index + match[0].length,
  )}`;
}

export function formatFillBlankPromptText(input: {
  text: string;
  answer: string;
  blank?: string;
}): string {
  const text = input.text.trim();
  if (!text) return FILL_BLANK_PLACEHOLDER;

  if (hasVisibleFillBlankPlaceholder(text)) {
    return text.replace(FILL_BLANK_PLACEHOLDER_REPLACE_PATTERN, FILL_BLANK_PLACEHOLDER);
  }

  const answerCandidates = [input.answer, input.blank]
    .filter(isUsableAnswerCandidate)
    .sort((a, b) => b.trim().length - a.trim().length);

  for (const candidate of answerCandidates) {
    const replaced = replaceFirstAnswerCandidate(text, candidate);
    if (replaced) return replaced;
  }

  return `${text} ${FILL_BLANK_PLACEHOLDER}`;
}

export function formatFillBlankContextText(input: { text: string; fallbackText?: string }): string {
  const text = input.text.trim();
  const fallbackText = input.fallbackText?.trim() ?? '';

  if (text && !hasVisibleFillBlankPlaceholder(text)) return text;
  if (fallbackText && !hasVisibleFillBlankPlaceholder(fallbackText)) return fallbackText;

  return 'Fill the missing Japanese word or romaji.';
}

function splitCounterpartChoice(choice: string): { japanese: string; english: string } | null {
  const match = choice.trim().match(COUNTERPART_SEPARATOR_PATTERN);
  if (!match?.groups) return null;

  const left = match.groups.left.trim();
  const right = match.groups.right.trim();
  if (!left || !right) return null;

  const leftHasJapanese = containsJapaneseScript(left);
  const rightHasJapanese = containsJapaneseScript(right);

  if (leftHasJapanese && !rightHasJapanese) {
    return { japanese: left, english: right };
  }
  if (!leftHasJapanese && rightHasJapanese) {
    return { japanese: right, english: left };
  }
  return null;
}

function isQuestionAskingForJapanese(question: string): boolean {
  const trimmedQuestion = question.trim();
  return (
    /\b(?:in|into)\s+japanese\b/iu.test(trimmedQuestion) ||
    /\bjapanese\s+(?:for|phrase|translation|version)\b/iu.test(trimmedQuestion) ||
    /\bwhich\s+(?:japanese\s+)?phrase\s+means\b/iu.test(trimmedQuestion) ||
    /\bwhat\s+(?:would|do|should)\s+you\s+say\b/iu.test(trimmedQuestion)
  );
}

function isMeaningStyleQuestion(question: string): boolean {
  const trimmedQuestion = question.trim();
  if (isQuestionAskingForJapanese(trimmedQuestion)) return false;
  return (
    containsJapaneseScript(trimmedQuestion) &&
    /\b(?:what\s+does|mean|meaning|translate|translation)\b/iu.test(trimmedQuestion)
  );
}

function formatJapaneseWithRomaji(japanese: string, romaji: string | undefined): string {
  const japaneseText = japanese.trim();
  const romajiText = romaji?.trim() ?? '';
  if (!japaneseText || !romajiText) return japaneseText;

  const inlineRomajiPattern = new RegExp(`\\(${escapeRegExp(romajiText)}\\)`, 'iu');
  return inlineRomajiPattern.test(japaneseText) ? japaneseText : `${japaneseText} (${romajiText})`;
}

export function getMultipleChoiceOptionDisplay(input: {
  question: string;
  choice: string;
}): string {
  const choice = input.choice.trim();
  const counterpart = splitCounterpartChoice(choice);
  if (!counterpart) return choice;

  return isMeaningStyleQuestion(input.question) ? counterpart.english : counterpart.japanese;
}

export function getMultipleChoiceSourcePrompt(
  input: MultipleChoiceSourcePromptInput,
): { japanese: string; romaji: string } | null {
  const question = input.question.trim();
  if (!question || containsJapaneseScript(question) || isQuestionAskingForJapanese(question)) {
    return null;
  }

  const japanese = input.japanese.trim();
  if (!containsJapaneseScript(japanese)) return null;

  const displayedChoices = input.choices
    .map((choice) => getMultipleChoiceOptionDisplay({ question, choice }))
    .filter(Boolean);
  if (displayedChoices.length === 0) return null;
  if (displayedChoices.some((choice) => containsJapaneseScript(choice))) return null;

  return { japanese, romaji: input.romaji?.trim() ?? '' };
}

export function formatMultipleChoiceQuestionText(input: MultipleChoiceSourcePromptInput): string {
  const question = input.question.trim();
  const sourcePrompt = getMultipleChoiceSourcePrompt(input);
  if (!sourcePrompt) return question;

  return `Phrase: ${formatJapaneseWithRomaji(sourcePrompt.japanese, sourcePrompt.romaji)}. ${question}`;
}

export function normalizeMultipleChoiceOptions(input: {
  question: string;
  choices: string[];
  correctAnswer: string;
}): { choices: string[]; correctAnswer: string } {
  return {
    choices: input.choices
      .map((choice) => getMultipleChoiceOptionDisplay({ question: input.question, choice }))
      .filter(Boolean),
    correctAnswer: getMultipleChoiceOptionDisplay({
      question: input.question,
      choice: input.correctAnswer,
    }),
  };
}

export const VISIBLE_FILL_BLANK_PLACEHOLDER = FILL_BLANK_PLACEHOLDER;
