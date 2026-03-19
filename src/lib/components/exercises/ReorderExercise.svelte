<script lang="ts">
import type { OnAnswer, ReorderExercise } from '$lib/types';

let { exercise, onAnswer }: { exercise: ReorderExercise; onAnswer: OnAnswer } = $props();
let answer = $state('');

function submit(): void {
const normalized = answer.trim();
if (!normalized) return;
onAnswer({
exerciseId: exercise.id,
answerText: normalized,
isCorrect: normalized === exercise.correctOrder.join(' ')
});
}
</script>

<section class="card">
<h2>{exercise.title}</h2>
<p>{exercise.prompt}</p>
<p>Tokens: {exercise.tokens.join(' | ')}</p>
<input bind:value={answer} placeholder="Type correct order with spaces" />
<button class="btn btn-primary" type="button" onclick={submit}>Submit answer</button>
</section>
