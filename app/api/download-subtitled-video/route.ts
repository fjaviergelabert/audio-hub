import { TranscriptionChunk } from "@/lib/types";
import ytdl from "@distube/ytdl-core";
import { path } from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import {
  createReadStream,
  createWriteStream,
  unlinkSync,
  writeFileSync,
} from "fs";
import { NextRequest, NextResponse } from "next/server";
import { tmpdir } from "os";
import { join } from "path";

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
    const srtSubtitles = generateSubtitles(transcription);

    // Create a temporary file for subtitles
    const subtitlesPath = `${tmpdir()}/subtitles_${Date.now()}.srt`;
    writeFileSync(subtitlesPath, srtSubtitles);
    console.log("Generated SRT file:", srtSubtitles);
    const tempVideoPath = join(tmpdir(), `video_${Date.now()}.mp4`);
    const tempOutputPath = join(tmpdir(), `output_${Date.now()}.mp4`);

    // Download video and audio streams
    const downloadVideo = new Promise<void>((resolve, reject) => {
      const videoStream = ytdl(url, { filter: "videoandaudio" });
      const videoFileStream = createWriteStream(tempVideoPath);
      videoStream.pipe(videoFileStream);
      videoFileStream.on("finish", resolve);
      videoFileStream.on("error", reject);
    });

    await Promise.all([downloadVideo])
      .then(() => {
        return new Promise<void>((resolve, reject) => {
          ffmpeg()
            .input(tempVideoPath)
            .input(subtitlesPath) // Input subtitles file
            .inputFormat("srt") // Specify the input format
            .outputOptions("-c:v", "libx264", "-c:a", "aac", "-c:s", "mov_text") // Encoding options
            .output(tempOutputPath)
            .on("end", () => {
              resolve(); // Resolve the ffmpeg promise
            })
            .on("error", (err) => {
              console.error("Error processing video:", err);
              reject(
                new NextResponse("Internal server error", { status: 500 })
              );
            })
            .run(); // Start the ffmpeg process
        });
      })
      .catch((err) => {
        console.error("Error downloading video or audio:", err);
        return new NextResponse("Internal server error", { status: 500 });
      });

    const videoStream = createReadStream(tempOutputPath);
    videoStream.on("close", () => {
      console.log("VIDEO CLOSE.", subtitlesPath);
      unlinkSync(tempVideoPath);
      unlinkSync(subtitlesPath);
      unlinkSync(tempOutputPath);
    });

    return new NextResponse(videoStream, {
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

/**
 * Converts an array of TranscriptionChunk objects to SRT format.
 * @param chunks - Array of TranscriptionChunk objects
 * @returns A string in SRT format
 */
function generateSubtitles(chunks: TranscriptionChunk[]): string {
  // Helper function to convert seconds to SRT timestamp format
  const formatTimestamp = (seconds: number | null): string => {
    if (seconds === null) return "00:00:00,000";
    const date = new Date(seconds * 1000);
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const secs = String(date.getUTCSeconds()).padStart(2, "0");
    const milliseconds = String(date.getUTCMilliseconds()).padStart(3, "0");
    return `${hours}:${minutes}:${secs},${milliseconds}`;
  };

  // Filter and map the chunks into SRT format
  return chunks
    .map((chunk, index) => {
      const [start, end] = chunk.timestamp;
      const startTime = formatTimestamp(start ?? 0);
      const endTime = formatTimestamp(end ?? 0);

      return `${index + 1}
${startTime} --> ${endTime}
${chunk.text.trim()}`;
    })
    .join("\n\n"); // SRT subtitles are separated by double newlines
}
