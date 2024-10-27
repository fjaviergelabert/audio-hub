// types.ts
export interface TranscriptionProgress {
  type: "download" | "conversion" | "wav-processing" | "transcription";
  status: "idle" | "started" | "in-progress" | "completed" | "error";
  progress: number;
  data?: string;
}
