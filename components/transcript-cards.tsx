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
    <ScrollArea ref={scrollAreaRef} className="h-[500px] pr-4">
      {chunks.map((entry, index) => {
        const timestamp = `${formatTime(entry.timestamp[0] || 0)}`;
        return (
          <div
            key={index}
            className="flex mb-4 last:mb-0 animate-fadeIn flex-col md:flex-row"
            ref={index === chunks.length - 1 ? lastEntryRef : null}
          >
            <div className="flex-shrink-0 w-full md:w-24 pr-4 text-right text-base font-semibold text-gray-500 dark:text-gray-400">
              {timestamp}
            </div>
            <Card className="flex-grow w-full">
              <CardContent className="p-3">
                <p className="text-sm md:text-base">{entry.text}</p>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </ScrollArea>
  );
}
