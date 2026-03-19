<script lang="ts">
import type { OnAnswer, ReadingExercise } from '$lib/types';

let { exercise, onAnswer }: { exercise: ReadingExercise; onAnswer: OnAnswer } = $props();
let answer = $state('');

function submit(): void {
const normalized = answer.trim();
if (!normalized) return;
onAnswer({
exerciseId: exercise.id,
answerText: normalized,
isCorrect: normalized.toLowerCase() === exercise.answer.toLowerCase()
});
}
</script>

<section class="card">
<h2>{exercise.title}</h2>
<p class="text-japanese">{exercise.passage}</p>
<p>{exercise.question}</p>
<textarea bind:value={answer} rows="3" placeholder="Type your answer"></textarea>
<button class="btn btn-primary" type="button" onclick={submit}>Submit answer</button>
</section>
