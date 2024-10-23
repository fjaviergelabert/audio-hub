import { pipeline, Pipeline } from "@xenova/transformers";

type WorkerMessage = {
  audioBlob: Blob;
};

type ProgressMessage = {
  status: "progress";
  progress: number;
};

type CompleteMessage = {
  status: "complete";
  transcript: string;
};

export type WorkerResponse = ProgressMessage | CompleteMessage;

let transcriber: Pipeline | null = null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (!transcriber) {
    transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en"
    );
  }

  const { audioBlob } = event.data;
  const audioArrayBuffer = await audioBlob.arrayBuffer();

  const result = await transcriber(audioArrayBuffer, {
    callback_function: (progress: { progress: number }) => {
      (self as DedicatedWorkerGlobalScope).postMessage({
        status: "progress",
        progress: progress.progress * 100,
      } as ProgressMessage);
    },
  });

  (self as DedicatedWorkerGlobalScope).postMessage({
    status: "complete",
    transcript: result.text,
  } as CompleteMessage);
};
