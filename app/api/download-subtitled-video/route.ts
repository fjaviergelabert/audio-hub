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
    const srtSubtitles = createSRT(transcription);

    // Create a temporary file for subtitles
    const subtitlesPath = `${tmpdir()}/subtitles_${Date.now()}.srt`;
    writeFileSync(subtitlesPath, srtSubtitles);
    console.log("Generated SRT file:", srtSubtitles);

    const tempVideoPath = join(tmpdir(), `video_${Date.now()}.mp4`);
    const tempAudioPath = join(tmpdir(), `audio_${Date.now()}.mp4`);
    const tempOutputPath = join(tmpdir(), `output_${Date.now()}.mp4`);

    // Download video and audio streams
    const downloadVideo = new Promise<void>((resolve, reject) => {
      const videoStream = ytdl(url, { quality: "highestvideo" });
      const videoFileStream = createWriteStream(tempVideoPath);
      videoStream.pipe(videoFileStream);
      videoFileStream.on("finish", resolve);
      videoFileStream.on("error", reject);
    });

    const downloadAudio = new Promise<void>((resolve, reject) => {
      const audioStream = ytdl(url, { quality: "highestaudio" });
      const audioFileStream = createWriteStream(tempAudioPath);
      audioStream.pipe(audioFileStream);
      audioFileStream.on("finish", resolve);
      audioFileStream.on("error", reject);
    });

    // After both downloads finish, combine them using ffmpeg
    await Promise.all([downloadVideo, downloadAudio])
      .then(() => {
        return new Promise<void>((resolve, reject) => {
          ffmpeg()
            .input(tempVideoPath)
            .input(tempAudioPath)
            .audioCodec("aac")
            .videoCodec("copy")
            .format("mp4")
            // .input(subtitlesPath) // Input subtitles file
            // .inputFormat("srt") // Specify the input format
            // .outputOptions("-c:v", "libx264", "-c:a", "aac", "-c:s", "mov_text") // Encoding options
            .output(tempOutputPath)
            .on("end", () => {
              // When processing is complete, read the combined file and send it back
              // const fileBuffer = readFileSync(tempOutputPath);
              // response.body = fileBuffer; // Assign the processed file to the response body
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
      // ! UNLINKING TOO FAST!
      // ! UNLINKING TOO FAST!
      // ! UNLINKING TOO FAST!
      // ! UNLINKING TOO FAST!
      // ! UNLINKING TOO FAST!
      console.log("VIDEO CLOSE.");
      unlinkSync(tempVideoPath);
      unlinkSync(tempAudioPath);
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

    // const stream = ytdl(url, {
    //   filter: (format) => format.container === "mp4",
    // })
    //   .on("data", (chunk) => {
    //     dataChunks.push(chunk);
    //   })
    //   .on("end", () => {
    //     Buffer.concat(dataChunks);
    //   });

    // const outputVideoPath = join(tmpdir(), `output_video_${Date.now()}.mp4`);

    // // Start FFmpeg processing, inputting the video stream and subtitles
    // await new Promise<void>((resolve, reject) => {
    //   ffmpeg(stream)
    //     .input(subtitlesPath) // Input subtitles file
    //     .inputFormat("srt") // Specify the input format
    //     .outputOptions("-c:v", "libx264", "-c:a", "aac", "-c:s", "mov_text") // Encoding options
    //     .output(outputVideoPath) // Output file path
    //     .on("start", (commandLine) => {
    //       console.log("FFmpeg command:", commandLine); // Log FFmpeg command
    //     })
    //     .on("stderr", (stderr) => {
    //       console.error("FFmpeg stderr:", stderr); // Capture stderr output
    //     })
    //     .on("error", (err) => {
    //       console.error("FFmpeg error:", err);
    //       reject(new Error("Error during FFmpeg processing"));
    //     })
    //     .on("end", () => {
    //       console.log("FFmpeg processing completed successfully.");
    //       // unlinkSync(subtitlesPath); // Remove subtitle file
    //       // unlinkSync(outputVideoPath); // Remove output video file
    //       resolve();
    //     })
    //     .run(); // Execute FFmpeg command
    // });

    // // After processing, serve the video to the client
    // const videoStream = createReadStream(outputVideoPath);

    // // Clean up the temporary files after serving the response
    // videoStream.on("close", () => {
    //   // ! UNLINKING TOO FAST!
    //   // ! UNLINKING TOO FAST!
    //   // ! UNLINKING TOO FAST!
    //   // ! UNLINKING TOO FAST!
    //   // ! UNLINKING TOO FAST!
    //   console.log("VIDEO CLOSE.");
    //   unlinkSync(subtitlesPath); // Remove subtitle file
    //   unlinkSync(outputVideoPath); // Remove output video file
    // });

    // return new NextResponse(videoStream, {
    //   headers: {
    //     "Content-Type": "video/mp4",
    //     "Content-Disposition": 'attachment; filename="video.mp4"',
    //     "Cache-Control": "no-cache",
    //     "Accept-Ranges": "bytes",
    //     "Transfer-Encoding": "chunked",
    //     Connection: "keep-alive",
    //   },
    // });
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
