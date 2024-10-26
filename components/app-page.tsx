"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import React, { useState } from "react";

export function TranscribePage() {
  const [url, setUrl] = useState("");
  const [transcription, setTranscription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTranscription("");

    try {
      await startTranscription(url);
    } catch (error) {
      setError("An error occurred during transcription: " + error);
      setLoading(false);
    }
  };

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

    const stream = new ReadableStream({
      start(controller) {
        function push() {
          reader
            .read()
            .then(({ done, value }) => {
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
                    const progressUpdate = JSON.parse(line);
                    console.log("PROGRESS", progressUpdate);
                    if (
                      progressUpdate.type === "transcription" &&
                      progressUpdate.data
                    ) {
                      setTranscription(progressUpdate.data);
                    }
                  } catch (e) {
                    console.error("Error parsing progress update:", e);
                  }
                });

              controller.enqueue(value);
              push();
            })
            .catch((error) => {
              console.error("Stream reading error:", error);
              controller.error(error);
              setLoading(false);
            });
        }

        push();
      },
    });

    new Response(stream)
      .text()
      .then((result) => {
        setLoading(false);
        console.log("Final result:", result);
      })
      .catch((error) => {
        console.error("Error processing stream:", error);
        setLoading(false);
      });
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            YouTube Transcriber (Whisper AI)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter YouTube URL"
              required
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
          {error && <p className="mt-4 text-red-600">{error}</p>}
          {transcription && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Transcription:</h2>
              <p className="whitespace-pre-wrap">{transcription}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
