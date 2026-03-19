<script lang="ts">
import type { MultipleChoiceExercise, OnAnswer } from '$lib/types';

let { exercise, onAnswer }: { exercise: MultipleChoiceExercise; onAnswer: OnAnswer } = $props();
let selected = $state('');

function submit(): void {
if (!selected) return;
onAnswer({
exerciseId: exercise.id,
answerText: selected,
isCorrect: selected === exercise.correctAnswer
});
}
</script>

<section class="card">
<h2>{exercise.title}</h2>
<p class="text-japanese text-japanese-lg">{exercise.japanese}</p>
<p>{exercise.question}</p>
<div class="choices">
{#each exercise.choices as choice}
<button type="button" class:selected={selected === choice} onclick={() => (selected = choice)}>{choice}</button>
{/each}
</div>
<button class="btn btn-primary" type="button" onclick={submit}>Submit answer</button>
</section>

<style>
.choices {
display: grid;
gap: var(--space-2);
margin-bottom: var(--space-3);
}
.selected {
border-color: var(--accent-shu);
background: var(--accent-shu-wash);
}
</style>
