import PipelineSingleton from "@/lib/pipeline";
import { TranscriptionProgress } from "@/lib/types";
import ytdl from "@distube/ytdl-core";
import { path } from "@ffmpeg-installer/ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "stream";
import { WaveFile } from "wavefile";

ffmpeg.setFfmpegPath(path);

export async function transcribe(
  url: string,
  onProgress: (data: TranscriptionProgress) => void
) {
  try {
    const mp3Buffer = await downloadYoutube(url, onProgress, {
      filter: "audioonly",
    });
    const wavBuffer = await convertFile(mp3Buffer, onProgress, () => {}, "wav");
    onProgress({ type: "conversion", status: "completed", progress: 100 });

    const audioData = processWav(wavBuffer, onProgress);

    const transcriber = await PipelineSingleton.getInstance();

    const chunks_to_process = [{ tokens: [], finalised: false }];
    const totalChunks = Math.ceil(audioData.length / (30 * 16000)); // Estimate total chunks based on audio length

    let processedChunks = 0;

    await transcriber(audioData, {
      top_k: 0,
      do_sample: false,
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      return_timestamps: true,
      force_full_sequences: false,
      chunk_callback: (chunk) => {
        const last = chunks_to_process[chunks_to_process.length - 1];
        Object.assign(last, chunk);
        last.finalised = true;

        if (!chunk.is_last) {
          chunks_to_process.push({ tokens: [], finalised: false });
        }

        // Calculate and report progress for each processed chunk
        processedChunks++;
      },
      callback_function: (item) => {
        const last = chunks_to_process[chunks_to_process.length - 1];
        last.tokens = [...item[0].output_token_ids];

        const data = transcriber.tokenizer._decode_asr(chunks_to_process, {
          time_precision:
            transcriber.processor.feature_extractor.config.chunk_length /
            transcriber.model.config.max_source_positions,
          return_timestamps: true,
          force_full_sequences: false,
        });

        onProgress({
          type: "transcription",
          status: "in-progress",
          data: data,
          progress: Math.floor((processedChunks / totalChunks) * 100),
        });
      },
    });

    onProgress({ type: "transcription", status: "completed", progress: 100 });
  } catch (error) {
    throw error;
  }
}

function processWav(
  wavBuffer: Buffer,
  onProgress: (data: TranscriptionProgress) => void
) {
  onProgress({ type: "wav-processing", status: "started", progress: 0 });

  const wav = new WaveFile(wavBuffer);
  wav.toBitDepth("32f");
  wav.toSampleRate(16000);
  let audioData = wav.getSamples();

  if (Array.isArray(audioData) && audioData.length > 1) {
    const SCALING_FACTOR = Math.sqrt(2);
    for (let i = 0; i < audioData[0].length; ++i) {
      audioData[0][i] =
        (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
      if (i % Math.floor(audioData[0].length / 100) === 0) {
        onProgress({
          type: "wav-processing",
          status: "in-progress",
          progress: Math.floor((i / audioData[0].length) * 100),
        });
      }
    }
    audioData = audioData[0];
  }
  onProgress({ type: "wav-processing", status: "completed", progress: 100 });

  return audioData;
}

export async function downloadYoutube(
  url: string,
  onProgress: (data: TranscriptionProgress) => void,
  filter: ytdl.downloadOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dataChunks: Buffer[] = [];
    const stream = ytdl(url, filter);

    let totalSize = 0;
    let downloadedSize = 0;

    stream.on("info", (info) => {
      totalSize = info.player_response.videoDetails.lengthSeconds * 128 * 1024; // Rough estimate of file size
    });

    stream.on("data", (chunk) => {
      dataChunks.push(chunk);
      downloadedSize += chunk.length;
      onProgress({
        type: "download",
        status: "in-progress",
        progress: Math.floor((downloadedSize / totalSize) * 100),
        data: chunk,
      });
    });

    stream.on("end", () => {
      onProgress({ type: "download", status: "completed", progress: 100 });
      resolve(Buffer.concat(dataChunks));
    });

    stream.on("error", reject);
  });
}
export async function convertFile(
  buffer: Buffer,
  onProgress: (data: TranscriptionProgress) => void,
  onData: (data: Buffer) => void,
  format: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];
    inputStream.end(buffer);

    ffmpeg(inputStream)
      .toFormat(format)
      .on("progress", (progress) => {
        onProgress({
          type: "conversion",
          status: "in-progress",
          progress: progress.percent || 0,
        });
      })
      .on("end", () => {})
      .on("error", (err) => {
        reject(err);
      })
      .pipe(outputStream);

    outputStream.on("data", (chunk) => {
      onData(chunk);
      return chunks.push(chunk);
    });
    outputStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    outputStream.on("error", reject);
  });
}
