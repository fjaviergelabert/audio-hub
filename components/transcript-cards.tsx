"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptionChunk } from "@/lib/types";
import { useEffect, useRef } from "react";

export function TranscriptCards({ chunks }: { chunks: TranscriptionChunk[] }) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastEntryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastEntryRef.current) {
      lastEntryRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chunks]);

  function formatTime(seconds: number) {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    // Format using padStart to ensure two digits for minutes and seconds
    if (hours > 0) {
      return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(secs).padStart(2, "0"),
      ].join(":");
    } else {
      return [
        String(minutes).padStart(2, "0"),
        String(secs).padStart(2, "0"),
      ].join(":");
    }
  }

  return (
    <>
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">
        Transcript
      </h2>
      <ScrollArea ref={scrollAreaRef} className="h-[500px] pr-4">
        {chunks.map((entry, index) => {
          const timestamp = `${formatTime(entry.timestamp[0] || 0)}`;
          return (
            <div
              key={index}
              className="flex mb-4 last:mb-0 animate-fadeIn"
              ref={index === chunks.length - 1 ? lastEntryRef : null}
            >
              <div className="flex-shrink-0 w-24 pr-4 text-right text-base font-semibold text-gray-500 dark:text-gray-400">
                {timestamp}
              </div>
              <Card className="flex-grow">
                <CardContent className="p-3">
                  <p>{entry.text}</p>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </ScrollArea>
    </>
  );
}
