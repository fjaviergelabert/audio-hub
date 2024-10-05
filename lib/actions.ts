"use server";

import ytdl from "@distube/ytdl-core";
import { pipeline } from "@xenova/transformers";
import fs from "fs";
import { WaveFile } from "wavefile";

const FILE_NAME = "audio";

export async function downloadYoutube(url: string) {
  const fileName = FILE_NAME + "-" + Date.now() + ".mp4";
  const filePath = `./public/${fileName}`;
  let audioFile: fs.WriteStream;
  try {
    audioFile = fs.createWriteStream(filePath);

    const audioStream = ytdl(url, { filter: "audioonly" });
    await new Promise((resolve, reject) => {
      audioStream.pipe(audioFile);
      audioStream.on("end", resolve);
      audioStream.on("error", reject);
    });

    return { success: true, filePath, fileName };
  } catch (error) {
    console.error(error);
    return { error: "An error occurred during audio download" };
  } finally {
    audioFile!.close();
    setTimeout(() => {
      fs.unlinkSync(filePath);
    }, 30000);
  }
}

export async function transcribe(wavBuffer: Uint8Array, fileName: string) {
  try {
    console.log("wavBuffer", wavBuffer);
    const wav = new WaveFile(wavBuffer);
    wav.toBitDepth("32f"); // Pipeline expects input as a Float32Array
    wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
      if (audioData.length > 1) {
        const SCALING_FACTOR = Math.sqrt(2);

        // Merge channels (into first channel to save memory)
        for (let i = 0; i < audioData[0].length; ++i) {
          audioData[0][i] =
            (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
        }
      }

      // Select first channel
      audioData = audioData[0];
    }

    const transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en"
    );
    const output = await transcriber(audioData, {
      language: "english",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    return { transcription: output?.text };
  } catch (error) {
    console.error(error);
    return { error: "An error occurred during transcription" };
  } finally {
    fs.unlinkSync(fileName);
  }
}
