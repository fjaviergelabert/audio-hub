"use server";

import PipelineSingleton from "@/lib/pipeline";
import ytdl from "@distube/ytdl-core";
import { path } from "@ffmpeg-installer/ffmpeg";

import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";
import { WaveFile } from "wavefile";

ffmpeg.setFfmpegPath(path);

export async function transcribe(url: string, onProgress: (data: any) => void) {
  try {
    const mp3Buffer = await downloadYoutube(url);
    const wavBuffer = await convertMp3ToWav(mp3Buffer);

    const wav = new WaveFile(wavBuffer);

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
      audioData = audioData[0];
    }

    const transcriber = await PipelineSingleton.getInstance();

    const time_precision =
      transcriber.processor.feature_extractor.config.chunk_length /
      transcriber.model.config.max_source_positions;

    const chunks_to_process = [{ tokens: [], finalised: false }];

    function chunk_callback(chunk) {
      const last = chunks_to_process[chunks_to_process.length - 1];
      Object.assign(last, chunk);
      last.finalised = true;

      if (!chunk.is_last) {
        chunks_to_process.push({ tokens: [], finalised: false });
      }

      let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
        time_precision,
        return_timestamps: true,
        force_full_sequences: false,
      });

      console.log("trasncription-chunk", data);
      onProgress(data[0]);
    }

    await transcriber(audioData, {
      top_k: 0,
      do_sample: false,
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      return_timestamps: true,
      force_full_sequences: false,
      chunk_callback,
    });
  } catch (error) {
    throw error;
  }
}

async function downloadYoutube(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dataChunks: Buffer[] = [];

    const audioStream = ytdl(url, { filter: "audioonly" });
    audioStream.on("data", (chunk) => dataChunks.push(chunk));
    audioStream.on("end", () => resolve(Buffer.concat(dataChunks)));
    audioStream.on("error", reject);
  });
}

async function convertMp3ToWav(mp3Buffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    inputStream.end(mp3Buffer);

    ffmpeg(inputStream)
      .toFormat("wav")
      .on("error", (err) => reject(err))
      .pipe(outputStream);

    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);
  });
}
