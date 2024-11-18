import { TranscriptionChunk } from "@/lib/types";
import ytdl from "@distube/ytdl-core";
import { path } from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { NextRequest, NextResponse } from "next/server";

ffmpeg.setFfmpegPath(path);

export async function POST(req: NextRequest) {
  const { url, transcription } = await req.json();

  if (!url || !ytdl.validateURL(url)) {
    return new NextResponse("Invalid or missing URL parameter", {
      status: 400,
    });
  }
  if (!transcription) {
    return new NextResponse("Transcription not provided", { status: 400 });
  }

  try {
    const stream = ytdl(url, {
      filter: (format) => format.container === "mp4",
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="video.mp4"',
        "Cache-Control": "no-cache",
        "Accept-Ranges": "bytes",
        "Transfer-Encoding": "chunked",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error creating readable stream or sending response:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

// Helper function to convert transcription array to SRT format in memory
function createSRT(transcription: TranscriptionChunk[]) {
  return transcription
    .map((chunk, index) => {
      const start = chunk.timestamp[0] ?? 0;
      const end = chunk.timestamp[1] ?? start + 2; // default duration if end is missing
      const startTime = new Date(start * 1000).toISOString().substr(11, 8);
      const endTime = new Date(end * 1000).toISOString().substr(11, 8);
      return `${index + 1}\n${startTime} --> ${endTime}\n${chunk.text}\n`;
    })
    .join("\n");
}
