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
    const mp3Buffer = await downloadYoutube(url, onProgress);
    const wavBuffer = await convertMp3ToWav(mp3Buffer, onProgress);
    onProgress({ type: "conversion", status: "completed", progress: 100 });

    onProgress({ type: "wav-processing", status: "started", progress: 0 });
    const audioData = processWav(wavBuffer, onProgress);
    onProgress({ type: "wav-processing", status: "completed", progress: 100 });

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

        onProgress(data[0]);
        onProgress({
          type: "transcription",
          status: "in-progress",
          data: data[0],
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
  return audioData;
}

async function downloadYoutube(
  url: string,
  onProgress: (data: TranscriptionProgress) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dataChunks: Buffer[] = [];
    const audioStream = ytdl(url, { filter: "audioonly" });

    let totalSize = 0;
    let downloadedSize = 0;

    audioStream.on("info", (info) => {
      totalSize = info.player_response.videoDetails.lengthSeconds * 128 * 1024; // Rough estimate of file size
    });

    audioStream.on("data", (chunk) => {
      dataChunks.push(chunk);
      downloadedSize += chunk.length;
      onProgress({
        type: "download",
        status: "in-progress",
        progress: Math.floor((downloadedSize / totalSize) * 100),
      });
    });

    audioStream.on("end", () => {
      onProgress({ type: "download", status: "completed", progress: 100 });
      resolve(Buffer.concat(dataChunks));
    });

    audioStream.on("error", reject);
  });
}

async function convertMp3ToWav(
  mp3Buffer: Buffer,
  onProgress: (data: TranscriptionProgress) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];
    let processedSize = 0;

    inputStream.end(mp3Buffer);

    ffmpeg(inputStream)
      .toFormat("wav")
      .on("progress", (progress) => {
        processedSize =
          progress.frames && mp3Buffer.length
            ? Math.floor((progress.frames / mp3Buffer.length) * 100)
            : processedSize;
        onProgress({
          type: "conversion",
          status: "in-progress",
          progress: processedSize,
        });
      })
      .on("error", (err) => reject(err))
      .pipe(outputStream);

    outputStream.on("data", (chunk) => chunks.push(chunk));

    outputStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    outputStream.on("error", reject);
  });
}
