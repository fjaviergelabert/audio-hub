"use server";

import PipelineSingleton from "@/lib/pipeline";
import ytdl from "@distube/ytdl-core";
import { path } from "@ffmpeg-installer/ffmpeg";
import fs, { promises as fsPromises } from "fs";

import { AutomaticSpeechRecognitionPipelineType } from "@xenova/transformers";
import ffmpeg from "fluent-ffmpeg";
import { WaveFile } from "wavefile";

ffmpeg.setFfmpegPath(path);

export async function downloadYoutube(url: string) {
  const FILE_NAME = "audio";
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

export async function transcribe(filePath: string) {
  const wavFilePath = filePath.replace(/\.[^/.]+$/, ".wav"); // Replace any extension with .wav

  try {
    await convertMp3ToWav(filePath, wavFilePath);

    const wavFileBuffer = await fsPromises.readFile(wavFilePath); // Read WAV file into a buffer
    const wav = new WaveFile(wavFileBuffer);

    wav.toBitDepth("32f");
    wav.toSampleRate(16000);
    let audioData = wav.getSamples();
    if (Array.isArray(audioData)) {
      if (audioData.length > 1) {
        const SCALING_FACTOR = Math.sqrt(2);
        for (let i = 0; i < audioData[0].length; ++i) {
          audioData[0][i] =
            (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
        }
      }
      audioData = audioData[0]; // Use the first channel
    }

    const transcriber: AutomaticSpeechRecognitionPipelineType =
      await PipelineSingleton.getInstance();

    const output = await transcriber(audioData, {
      top_k: 0,
      do_sample: false,
      // language: "spanish",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      chunk_callback: (...args) => {
        console.log("chunk", ...args);
      },
      // force_full_sequences: false,
      // threshold: 0.5,
    });

    return { transcription: output };
  } catch (error) {
    console.trace(error);
    return { error: "An error occurred during transcription" };
  } finally {
    setTimeout(() => {
      fs.unlinkSync(wavFilePath);
    }, 30000);
  }
}

export async function convertMp3ToWav(
  mp3FilePath: string,
  outputWavPath: string
) {
  return new Promise((resolve, reject) => {
    ffmpeg(mp3FilePath)
      .toFormat("wav")
      .on("end", () => {
        resolve({ success: true, outputFilePath: outputWavPath });
      })
      .on("error", (error) => {
        reject({
          error: "An error occurred during conversion",
          details: error.message,
        });
      })
      .save(outputWavPath);
  });
}
