import { mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readable } from 'svelte/store';
import type { SessionSummary as SessionSummaryType, SessionXpBreakdown } from '$lib/types';

const mocks = vi.hoisted(() => ({
  invalidateAll: vi.fn(),
}));

vi.mock('$app/navigation', () => ({
  invalidateAll: mocks.invalidateAll,
}));

vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/learn') }),
}));

vi.mock('$lib/utils/tts', () => ({
  isSpeaking: vi.fn(() => false),
  speak: vi.fn(),
  stop: vi.fn(),
}));

import SessionSummary from './SessionSummary.svelte';

const summary: SessionSummaryType = {
  sessionId: 'session-1',
  userId: 'user-1',
  summary: 'Your recent sessions show consistent mastery.',
  strengths: ['Strong recall'],
  weaknesses: ['Keep expanding your range'],
  accuracy: 100,
  generatedAt: '2026-01-01T00:00:00.000Z',
  miniLesson: {
    kind: 'follow_up',
    japanese: 'もう一度お願いします',
    romaji: 'mou ichido onegaishimasu',
    english: 'One more time, please.',
    note: 'Use this when you need someone to repeat what they said.',
  },
  levelUpRecommendation: {
    recommendedLevel: 'elementary',
    reason: 'Recent sessions show consistent mastery above 80 percent.',
  },
};

const xpBreakdown: SessionXpBreakdown = {
  exerciseXp: 80,
  sessionBonusXp: 20,
  perfectBonusXp: 25,
  streakBonusXp: 10,
  comboBonusXp: 5,
  totalXp: 140,
  newMilestones: [
    {
      key: 'steady-progress',
      name: 'Steady Progress',
      nameJa: '着実な進歩',
      description: 'Keep building your travel Japanese.',
      xpThreshold: 100,
    },
  ],
};

function expectBefore(earlier: Element, later: Element): void {
  expect(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === label,
  );
  expect(button, `Expected a visible "${label}" button`).toBeDefined();
  return button!;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await tick();
  await Promise.resolve();
  await tick();
}

describe('SessionSummary promotion flow', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('shows an available promotion before milestones and session exit actions', async () => {
    const component = mount(SessionSummary, {
      target: document.body,
      props: { summary, xpBreakdown },
    });

    try {
      await tick();
      const unlock = document.querySelector('[aria-label="Today’s unlock"]');
      const promotion = document.querySelector('[aria-label="Level up recommendation"]');
      const milestone = document.querySelector('.milestone-card');
      const exitActions = document.querySelector('[aria-label="Session actions"]');

      expect(unlock).not.toBeNull();
      expect(promotion).not.toBeNull();
      expect(milestone).not.toBeNull();
      expect(exitActions).not.toBeNull();
      expectBefore(unlock!, promotion!);
      expectBefore(promotion!, milestone!);
      expectBefore(promotion!, exitActions!);
      expect(promotion!.classList.contains('stagger-3')).toBe(true);
      expect(exitActions!.classList.contains('stagger-5')).toBe(true);
    } finally {
      await unmount(component);
    }
  });

  it('accepts an available promotion through the profile level API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, level: 'elementary' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const component = mount(SessionSummary, {
      target: document.body,
      props: { summary, xpBreakdown },
    });

    try {
      findButton('Accept Promotion').click();
      await settle();

      expect(fetchMock).toHaveBeenCalledWith('/api/user/level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-1', level: 'elementary' }),
      });
      expect(document.body.textContent).toContain('Level updated successfully.');
    } finally {
      await unmount(component);
    }
  });
});
