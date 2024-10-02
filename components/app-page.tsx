"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { transcribeYouTube } from "@/lib/actions";
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
      console.log("url", url);
      const result = await transcribeYouTube(url);
      if ("error" in result) {
        setError(result.error);
      } else {
        setTranscription(result.transcription);
      }
    } catch (error) {
      setError("An error occurred during transcription: " + error);
    } finally {
      setLoading(false);
    }
  };

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
