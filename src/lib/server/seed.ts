import seedExercisesData from '$lib/data/seed-exercises.json';
import { countSeedExercises, upsertExercise } from '$lib/server/db';
import type { Exercise } from '$lib/types';

function isObject(value: unknown): value is Record<string, unknown> {
return value !== null && typeof value === 'object';
}

function isExercise(value: unknown): value is Exercise {
if (!isObject(value)) return false;
return (
typeof value.id === 'string' &&
typeof value.type === 'string' &&
typeof value.title === 'string' &&
typeof value.japanese === 'string' &&
typeof value.romaji === 'string' &&
typeof value.englishContext === 'string' &&
Array.isArray(value.tags) &&
typeof value.difficulty === 'number'
);
}

function validateSeedExercises(input: unknown[]): Exercise[] {
const exercises = input.filter(isExercise);
if (exercises.length < 50) {
throw new Error(`[seed] Expected at least 50 seed exercises, got ${exercises.length}`);
}

const invalidIds = exercises
.map((exercise) => exercise.id)
.filter((id, index) => {
const expected = `seed-${String(index + 1).padStart(3, '0')}`;
return id !== expected;
});
if (invalidIds.length > 0) {
throw new Error(`[seed] Seed IDs are not sequential seed-001.. format. First mismatch: ${invalidIds[0]}`);
}

return exercises;
}

export async function ensureSeedExercisesLoaded(): Promise<{ seeded: boolean; count: number }> {
	const result = await loadSeedExercises();
	return { seeded: result.inserted > 0, count: result.inserted + result.skipped };
}

export async function loadSeedExercises(): Promise<{ inserted: number; skipped: number }> {
	const existingSeedCount = await countSeedExercises();
	const validated = validateSeedExercises(seedExercisesData as unknown[]);
	if (existingSeedCount > 0) {
		console.info('[seed] seed exercises already loaded', { count: existingSeedCount });
		return { inserted: 0, skipped: validated.length };
	}

	let inserted = 0;
	for (const exercise of validated) {
		await upsertExercise(exercise, true, null);
		inserted += 1;
	}

	console.info('[seed] loaded seed exercises', { count: validated.length });
	return { inserted, skipped: validated.length - inserted };
}
