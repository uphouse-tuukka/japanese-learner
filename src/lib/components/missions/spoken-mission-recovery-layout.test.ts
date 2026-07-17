import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function componentSource(name: string): string {
  return readFileSync(new URL(name, import.meta.url), 'utf8');
}

describe('Spoken Mission recovery narrow-layout contract', () => {
  it('constrains retry, skip, history, and incomplete-result content at 390 by 844', () => {
    const turn = componentSource('SpokenMissionTurn.svelte');
    const history = componentSource('SpokenMissionHistory.svelte');
    const result = componentSource('SpokenMissionResult.svelte');

    expect(turn).toMatch(/\.spoken-shell\s*{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(turn).toMatch(/\.retry-suggestion\s*{[^}]*min-width:\s*0;/s);
    expect(turn).toMatch(/\.retry-actions\s*{[^}]*min-width:\s*0;[^}]*flex-wrap:\s*wrap;/s);
    expect(turn).toMatch(
      /@media \(max-width: 37\.5rem\)[\s\S]*\.retry-actions :global\(\.btn\)[^{]*{[^}]*width:\s*100%;/,
    );

    expect(history).toMatch(/\.history-shell\s*{[^}]*min-width:\s*0;/s);
    expect(history).toContain('grid-template-columns: auto minmax(0, 1fr);');
    expect(history).toMatch(/\.history-content\s*{[^}]*min-width:\s*0;/s);
    expect(history).toMatch(
      /@media \(max-width: 37\.5rem\)[\s\S]*\.exchange\.with-server-line\s*{[^}]*grid-template-columns:\s*1fr;/,
    );

    expect(result).toMatch(/\.spoken-shell\s*{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(result).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(result).toMatch(
      /@media \(max-width: 37\.5rem\)[\s\S]*\.evidence-list\s*{[^}]*grid-template-columns:\s*1fr;/,
    );
    expect(result).toMatch(/\.result-actions :global\(\.btn\)\s*{[^}]*width:\s*100%;/s);
  });
});
