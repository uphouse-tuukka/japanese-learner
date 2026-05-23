export type RecordingStopIntent = 'submit' | 'cancel';

export function shouldSubmitStoppedRecording(
  intent: RecordingStopIntent,
  audioSize: number,
): boolean {
  return intent === 'submit' && audioSize > 0;
}
