"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TranscriptionChunk, TranscriptionProgress } from "@/lib/types";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { TranscriptCards } from "./transcript-cards";

const INITIAL_PROGRESS_STEPS: Array<
  TranscriptionProgress & { message: string }
> = [
  {
    type: "download",
    progress: 0,
    status: "idle",
    message: "Download audio",
  },
  {
    type: "conversion",
    progress: 0,
    status: "idle",
    message: "Convert to WAV format",
  },
  {
    type: "wav-processing",
    progress: 0,
    status: "idle",
    message: "Process WAV data",
  },
  {
    type: "transcription",
    progress: 0,
    status: "idle",
    message: "Transcribe audio",
  },
];

export function TranscribePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transcription, setTranscription] = useState<TranscriptionChunk[]>([]);
  const progressState = useProgressSteps({
    onTranscriptionUpdate: setTranscription,
  });
  const transcriptionState = useTranscription({
    onProgress: progressState.handleProgressUpdate,
    setLoading,
  });

  return (
    <main className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-4">
      <section className="flex-1 mb-4 md:mb-0">
        <article className="max-w-md mx-auto shadow-sm bg-white p-6 rounded-lg flex flex-col md:flex-row">
          <header className="mb-4">
            <h1 className="text-2xl font-bold text-center">
              YouTube Transcriber (Whisper AI)
            </h1>
          </header>
          <URLInput
            onSubmit={async (e: React.FormEvent) => {
              e.preventDefault();
              setLoading(true);
              setError("");
              setTranscription([]);

              progressState.setProgressSteps(
                progressState.progressSteps.map((step) => ({
                  ...step,
                  status: "idle",
                  progress: 0,
                }))
              );

              try {
                await transcriptionState.startTranscription(url);
              } catch (error) {
                setError("An error occurred during transcription: " + error);
                setLoading(false);
              }
            }}
            url={url}
            setUrl={setUrl}
            loading={loading}
          />
          {error && <p className="mt-4 text-red-600">{error}</p>}
          <ProgressSteps progressSteps={progressState.progressSteps} />
        </article>
      </section>
      {transcription.length > 0 && (
        <section className="flex-1">
          <article className="max-w-3xl mx-auto shadow-sm bg-white p-6 rounded-lg">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
              Transcript
            </h2>
            <TranscriptCards chunks={transcription} />
          </article>
        </section>
      )}
    </main>
  );
}

function ProgressSteps({
  progressSteps,
}: React.PropsWithChildren<{
  progressSteps: Array<TranscriptionProgress & { message: string }>;
}>) {
  return (
    <ol className="mt-6 space-y-4">
      {progressSteps.map((step, index) => (
        <li key={index}>
          <Card className="transition-transform bg-white shadow-sm">
            <CardHeader>
              <div className="flex items-center">
                <span
                  role="status"
                  aria-label={
                    step.status === "completed"
                      ? "Step completed"
                      : step.status === "in-progress"
                      ? "Step in progress"
                      : step.status === "error"
                      ? "Step error"
                      : "Step idle"
                  }
                  className={`flex justify-center items-center h-8 w-8 rounded-full text-white
                          ${step.status === "completed" ? "bg-green-500" : ""}
                          ${step.status === "in-progress" ? "bg-blue-500" : ""}
                          ${step.status === "error" ? "bg-red-500" : ""}
                          ${step.status === "idle" ? "bg-gray-400" : ""}`}
                >
                  {step.status === "completed" && <span>✔</span>}
                  {step.status === "in-progress" && (
                    <Loader2 className="animate-spin" />
                  )}
                  {step.status === "error" && <span>✖</span>}
                  {step.status === "idle" && <span>○</span>}
                </span>
                <CardTitle className="ml-4 text-lg font-semibold">
                  {step.message}
                </CardTitle>
              </div>
            </CardHeader>
            {step.status === "in-progress" && (
              <CardContent>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-400 h-2.5 rounded-full"
                    style={{
                      width: `${step.progress > 100 ? 100 : step.progress}%`,
                    }}
                  ></div>
                </div>
              </CardContent>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}

function URLInput({
  onSubmit,
  url,
  setUrl,
  loading,
}: {
  onSubmit: (e: React.FormEvent) => Promise<void>;
  url: string;
  setUrl: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter YouTube URL"
        required
        className="w-full"
      />
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Transcribing...
          </>
        ) : (
          "Transcribe"
        )}
      </Button>
    </form>
  );
}

function useTranscription({
  onProgress,
  setLoading,
}: {
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  onProgress: (data: TranscriptionProgress) => void;
}) {
  async function startTranscription(url: string) {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      console.error("Failed to start transcription");
      setLoading(false);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder("utf-8");

    const stream = createStream(reader, decoder);

    new Response(stream)
      .text()
      .then(() => {
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error processing stream:", error);
        setLoading(false);
      });
  }

  function createStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder
  ) {
    return new ReadableStream({
      start(controller) {
        push();

        function push() {
          reader
            .read()
            .then(handleStream)
            .catch((error) => {
              console.error("Stream reading error:", error);
              controller.error(error);
              setLoading(false);
            });

          function handleStream({
            done,
            value,
          }: ReadableStreamReadResult<Uint8Array>): void {
            if (done) {
              controller.close();
              setLoading(false);
              return;
            }

            const data = decoder.decode(value, { stream: true });
            data
              .split("\n")
              .filter(Boolean)
              .forEach((line) => {
                try {
                  onProgress(JSON.parse(line));
                } catch (e) {
                  console.error("Error parsing progress update:", e);
                }
              });

            controller.enqueue(value);
            push();
          }
        }
      },
    });
  }

  return { startTranscription };
}

function useProgressSteps({
  onTranscriptionUpdate,
}: {
  onTranscriptionUpdate: (chunks: TranscriptionChunk[]) => void;
}) {
  const [progressSteps, setProgressSteps] = useState(INITIAL_PROGRESS_STEPS);

  function handleProgressUpdate(progressUpdate: TranscriptionProgress) {
    setProgressSteps((prevSteps) =>
      prevSteps.map((step) => {
        if (step.type === progressUpdate.type) {
          return {
            ...step,
            progress: progressUpdate.progress,
            status: progressUpdate.status,
          };
        }
        return step;
      })
    );

    if (progressUpdate.type === "transcription" && progressUpdate.data) {
      const chunks = progressUpdate.data[1].chunks;
      const chunk = chunks[chunks.length - 1];
      const timestamp = chunk?.timestamp[0];

      if (typeof timestamp !== "number") {
        return;
      }

      onTranscriptionUpdate(chunks);
    }
  }
  return { progressSteps, setProgressSteps, handleProgressUpdate };
}
