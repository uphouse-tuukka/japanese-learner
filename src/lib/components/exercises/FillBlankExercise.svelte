<script lang="ts">
import type { FillBlankExercise, OnAnswer } from '$lib/types';

let { exercise, onAnswer }: { exercise: FillBlankExercise; onAnswer: OnAnswer } = $props();
let answer = $state('');

function submit(): void {
const normalized = answer.trim();
if (!normalized) return;
onAnswer({
exerciseId: exercise.id,
answerText: normalized,
isCorrect:
normalized === exercise.answer ||
normalized.toLowerCase() === exercise.answerRomaji.toLowerCase()
});
}
</script>

<section class="card">
<h2>{exercise.title}</h2>
<p class="text-japanese">{exercise.sentence}</p>
<p>{exercise.sentenceEnglish}</p>
<div class="answer-area">
<input bind:value={answer} placeholder="Fill the blank" />
<button class="btn btn-primary" type="button" onclick={submit}>Submit answer</button>
</div>
</section>

<style>
.answer-area {
display: grid;
gap: var(--space-3);
margin-top: var(--space-3);
}
</style>
