// types.ts
export interface TranscriptionProgress {
  type: "download" | "conversion" | "wav-processing" | "transcription";
  status: "idle" | "started" | "in-progress" | "completed" | "error";
  progress: number;
  data?: TranscriptionData;
}

type TranscriptionData = [string, Chunks];

export type TranscriptionChunk = {
  timestamp: [number | null, number | null] | []; // The timestamp can be a tuple or an empty array
  text: string;
};

type Chunks = {
  chunks: TranscriptionChunk[];
};
