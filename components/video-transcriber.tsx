"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FileAudio, FileText, Loader2, Youtube } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// You'll need to install these packages:
// npm install ytdl-core @ffmpeg/ffmpeg @ffmpeg/util @xenova/transformers

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import ytdl from "ytdl-core";

type Step = {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  completed: boolean;
  progress: number;
};

export function VideoTranscriberComponent() {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [steps, setSteps] = useState<Step[]>([
    {
      title: "Download Video",
      icon: <Youtube />,
      loading: false,
      completed: false,
      progress: 0,
    },
    {
      title: "Convert to WAV",
      icon: <FileAudio />,
      loading: false,
      completed: false,
      progress: 0,
    },
    {
      title: "Transcribe Audio",
      icon: <FileText />,
      loading: false,
      completed: false,
      progress: 0,
    },
  ]);
  const ffmpegRef = useRef<FFmpeg>();

  useEffect(() => {
    const loadFFmpeg = async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
      ffmpegRef.current = ffmpeg;
    };
    loadFFmpeg();
  }, []);

  const updateStepStatus = (
    index: number,
    loading: boolean,
    completed: boolean,
    progress: number
  ) => {
    setSteps((prevSteps) =>
      prevSteps.map((step, i) =>
        i === index ? { ...step, loading, completed, progress } : step
      )
    );
  };

  const downloadYouTubeVideo = async (videoUrl: string) => {
    updateStepStatus(0, true, false, 0);
    const info = await ytdl.getInfo(videoUrl);
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    const response = await fetch(format.url);
    const data = await response.arrayBuffer();
    updateStepStatus(0, false, true, 100);
    return new Uint8Array(data);
  };

  const convertToWav = async (videoData: Uint8Array) => {
    updateStepStatus(1, true, false, 0);
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error("FFmpeg not loaded");

    await ffmpeg.writeFile("input.mp4", videoData);
    await ffmpeg.exec([
      "-i",
      "input.mp4",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "output.wav",
    ]);
    const data = await ffmpeg.readFile("output.wav");
    updateStepStatus(1, false, true, 100);
    return new Blob([data], { type: "audio/wav" });
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    updateStepStatus(2, true, false, 0);
    const worker = new Worker(new URL("./whisper-worker.ts", import.meta.url));

    return new Promise<string>((resolve, reject) => {
      worker.onmessage = (event) => {
        if (event.data.status === "progress") {
          updateStepStatus(2, true, false, event.data.progress);
        } else if (event.data.status === "complete") {
          updateStepStatus(2, false, true, 100);
          resolve(event.data.transcript);
        }
      };
      worker.onerror = reject;
      worker.postMessage({ audioBlob });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const videoData = await downloadYouTubeVideo(url);
      const wavBlob = await convertToWav(videoData);
      const result = await transcribeAudio(wavBlob);
      setTranscript(result);
    } catch (error) {
      console.error("Error processing video:", error);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Video Transcriber</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Enter YouTube URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-grow"
            />
            <Button type="submit">
              <Youtube className="mr-2 h-4 w-4" />
              Process
            </Button>
          </div>
        </form>
        <div className="mt-6 space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center space-x-4">
                <div
                  className={`p-2 rounded-full ${
                    step.completed ? "bg-green-500" : "bg-gray-200"
                  }`}
                >
                  {step.loading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  ) : (
                    <div className="h-6 w-6 text-white">{step.icon}</div>
                  )}
                </div>
                <div className="flex-grow">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-sm text-gray-500">
                    {step.loading
                      ? "Processing..."
                      : step.completed
                      ? "Completed"
                      : "Waiting"}
                  </p>
                </div>
              </div>
              <Progress value={step.progress} className="w-full" />
            </div>
          ))}
        </div>
        {transcript && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Transcript:</h3>
            <p className="whitespace-pre-wrap">{transcript}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
