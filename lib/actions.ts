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

    const time_precision =
      transcriber.processor.feature_extractor.config.chunk_length /
      transcriber.model.config.max_source_positions;

    // Storage for chunks to be processed. Initialise with an empty chunk.
    const chunks_to_process = [
      {
        tokens: [],
        finalised: false,
      },
    ];

    // TODO: Storage for fully-processed and merged chunks
    // let decoded_chunks = [];

    function chunk_callback(chunk) {
      const last = chunks_to_process[chunks_to_process.length - 1];

      // Overwrite last chunk with new info
      Object.assign(last, chunk);
      last.finalised = true;

      // Create an empty chunk after, if it not the last chunk
      if (!chunk.is_last) {
        chunks_to_process.push({
          tokens: [],
          finalised: false,
        });
      }

      let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
        time_precision: time_precision,
        return_timestamps: true,
        force_full_sequences: false,
      });

      console.clear();
      console.log("data", data[0]);
    }

    // Inject custom callback function to handle merging of chunks
    function callback_function(item) {
      // let last = chunks_to_process[chunks_to_process.length - 1];
      // // Update tokens of last chunk
      // last.tokens = [...item[0].output_token_ids];
      // // Merge text chunks
      // // TODO optimise so we don't have to decode all chunks every time
      // let data = transcriber.tokenizer._decode_asr(chunks_to_process, {
      //   time_precision: time_precision,
      //   return_timestamps: true,
      //   force_full_sequences: false,
      // });
      // console.clear();
      // console.log("data", data[0]);
    }

    // Actually run transcription
    const output = await transcriber(audioData, {
      // Greedy
      top_k: 0,
      do_sample: false,

      // Sliding window
      chunk_length_s: 30,
      stride_length_s: 5,

      // Language and task
      // language: language,
      task: "transcribe",

      // Return timestamps
      return_timestamps: true,
      force_full_sequences: false,

      // Callback functions
      callback_function: callback_function, // after each generation step
      chunk_callback: chunk_callback, // after each chunk is processed
    }).catch((error) => {
      console.log("error", error);
      return null;
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
