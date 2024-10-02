"use server";

import {
  AutoProcessor,
  AutoTokenizer,
  WhisperModel,
} from "@xenova/transformers";
import fs from "fs";
import ytdl from "ytdl-core";

// In my function, remove audio.mp4 file after transcription is done

export async function transcribeYouTube(url: string) {
  try {
    // Download YouTube video audio
    const audioStream = ytdl(url, { filter: "audioonly" });
    const audioFile = fs.createWriteStream("audio.mp4");

    await new Promise((resolve, reject) => {
      audioStream.pipe(audioFile);
      audioStream.on("end", (args) => {
        console.log("Audio stream ended:", args);
        resolve(args);
      });
      audioStream.on("error", (args) => {
        console.log("Audio stream error:", args);
        reject(args);
      });
    });

    // Load Whisper model
    const model = await WhisperModel.from_pretrained("Xenova/whisper-tiny.en");
    const processor = await AutoProcessor.from_pretrained(
      "Xenova/whisper-tiny.en"
    );
    const tokenizer = await AutoTokenizer.from_pretrained(
      "Xenova/whisper-tiny.en"
    );

    // Read audio file
    const audioBuffer = await fs.promises.readFile("audio.mp4");

    // Transcribe audio
    const { transcription } = await model.transcribe(audioBuffer, {
      processor: processor,
      tokenizer: tokenizer,
      chunk_length_s: 30,
      stride_length_s: 5,
      language: "english",
      task: "transcribe",
    });

    // Clean up temporary file
    fs.unlinkSync("audio.mp4");

    return { transcription };
  } catch (error) {
    console.error(error);
    return { error: "An error occurred during transcription" };
  }
}
