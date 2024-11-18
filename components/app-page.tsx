"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TranscriptionChunk, TranscriptionProgress } from "@/lib/types";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { TranscriptCards } from "./transcript-cards";

// TODO: MAkle this below a key value paired object
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
  const { startStreamDownload } = useReader({
    url: "/api/transcribe",
    body: { url },
    onStream: progressState.handleProgressUpdate,
    setLoading,
  });

  return (
    <main className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-4">
      <section className="flex-1">
        <article className="max-w-md mx-auto shadow-sm bg-white p-6 rounded-lg">
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
                await startStreamDownload();
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
          <div className="mt-6 flex justify-end">
            <DownloadButton url={url} transcription={transcription} />
          </div>
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

function useProgressSteps({
  onTranscriptionUpdate,
}: {
  onTranscriptionUpdate: (chunks: TranscriptionChunk[]) => void;
}) {
  const [progressSteps, setProgressSteps] = useState(INITIAL_PROGRESS_STEPS);

  function handleProgressUpdate(serverProgress: Uint8Array) {
    const data = new TextDecoder("utf-8").decode(serverProgress);
    const handleLine = (line: string): void => {
      try {
        const progressUpdate = JSON.parse(line);

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
      } catch (e) {
        console.error("Error parsing progress update:", e);
      }
    };

    data.split("\n").filter(Boolean).forEach(handleLine);
  }
  return { progressSteps, setProgressSteps, handleProgressUpdate };
}

function useReader({
  url,
  body,
  onStream,
  setLoading,
  onDone = () => {},
}: {
  url: string;
  body: any;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  onStream: (data: Uint8Array) => void;
  onDone?: () => void;
}) {
  async function startStreamDownload() {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch((error) => {
      console.error("Error processing stream:", error);
      setLoading(false);
    });

    if (!response.ok) {
      console.error("Failed to start transcription");
      setLoading(false);
      return;
    }

    const reader = response.body!.getReader();

    const stream = createStream(reader);

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

  function createStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
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
              onDone();
              controller.close();
              setLoading(false);
              return;
            }

            onStream(value);

            controller.enqueue(value);
            push();
          }
        }
      },
    });
  }

  return { startStreamDownload };
}

function DownloadButton({
  url,
  transcription,
}: {
  url: string;
  transcription: TranscriptionChunk[];
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [chunks, setChunks] = useState<BlobPart[]>([]);
  const [error, setError] = useState("");

  const { startStreamDownload } = useReader({
    url: "/api/download-subtitled-video",
    body: { url, transcription },
    onStream: (progressUpdate) => {
      console.log("progressUpdate", progressUpdate);
      setChunks((prevChunks) => [...prevChunks, progressUpdate]);
    },
    onDone: () => {
      setIsLoading(false);
      const videoBlob = new Blob(chunks, { type: "video/mp4" });
      const videoURL = URL.createObjectURL(videoBlob);
      const a = document.createElement("a");
      a.href = videoURL;
      a.download = "video.mp4";
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(videoURL);
    },
    setLoading: setIsLoading,
  });

  const handleDownload = async () => {
    setIsLoading(true);
    setProgress(0);
    setError("");
    setChunks([]);

    startStreamDownload();
  };

  return (
    <>
      <Button onClick={handleDownload} className="mr-2" disabled={isLoading}>
        {isLoading ? "Downloading..." : "Download Video"}
      </Button>
      {progress > 0 && <p>Progress: {progress}%</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </>
  );
}
