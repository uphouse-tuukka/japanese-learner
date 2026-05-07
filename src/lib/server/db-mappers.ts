import type {
  Exercise,
  Session,
  SessionMode,
  SessionStatus,
  TokenUsage,
  User,
  UserLevel,
} from '$lib/types';

function nowIso(): string {
  return new Date().toISOString();
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function toPercent(correctCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return Math.round((correctCount / totalCount) * 100);
}

export function asIso(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return nowIso();
}

export function parseExercise(contentJson: unknown): Exercise {
  if (typeof contentJson !== 'string' || !contentJson.trim()) {
    throw new Error('[db] Missing exercise content_json');
  }
  return JSON.parse(contentJson) as Exercise;
}

export function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: asString(row.id),
    name: asString(row.name),
    level: asString(row.level) as UserLevel,
    japaneseWritingEnabled:
      row.japanese_writing_enabled === 1 || row.japanese_writing_enabled === '1',
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    lastActiveAt: row.last_active_at ? asIso(row.last_active_at) : null,
    progressJournal: row.progress_journal ? asString(row.progress_journal) : null,
  };
}

export function mapSessionRow(row: Record<string, unknown>): Session {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    mode: asString(row.mode) as SessionMode,
    status: asString(row.status) as SessionStatus,
    model: row.model ? asString(row.model) : null,
    tokenInput: asNumber(row.token_input),
    tokenOutput: asNumber(row.token_output),
    summary: row.summary ? asString(row.summary) : null,
    createdAt: asIso(row.created_at),
    completedAt: row.completed_at ? asIso(row.completed_at) : null,
  };
}

export function mapTokenUsageRow(row: Record<string, unknown>): TokenUsage {
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    sessionId: row.session_id ? asString(row.session_id) : null,
    model: asString(row.model),
    tokensIn: asNumber(row.tokens_in),
    tokensOut: asNumber(row.tokens_out),
    tokensTotal: asNumber(row.tokens_total),
    createdAt: asIso(row.created_at),
  };
}

export type PortfolioSessionRow = {
  id: string;
  cookieId: string;
  ipHash: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  expiresAt: string;
  scenario: string | null;
  lesson: string | null;
  exercises: string | null;
  answers: string | null;
  currentStep: number;
  summary: string | null;
  supportsBrowserVoice: boolean;
};

export function mapPortfolioSessionRow(row: Record<string, unknown>): PortfolioSessionRow {
  return {
    id: asString(row.id),
    cookieId: asString(row.cookie_id),
    ipHash: asString(row.ip_hash),
    status: asString(row.status),
    startedAt: asIso(row.started_at),
    completedAt: row.completed_at ? asIso(row.completed_at) : null,
    expiresAt: asIso(row.expires_at),
    scenario: row.scenario ? asString(row.scenario) : null,
    lesson: row.lesson ? asString(row.lesson) : null,
    exercises: row.exercises ? asString(row.exercises) : null,
    answers: row.answers ? asString(row.answers) : null,
    currentStep: asNumber(row.current_step, 0),
    summary: row.summary ? asString(row.summary) : null,
    supportsBrowserVoice: row.supports_browser_voice === 1 || row.supports_browser_voice === '1',
  };
}
