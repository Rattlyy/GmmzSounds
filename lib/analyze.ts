import MusicTempo from "music-tempo";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

const execAsync = promisify(exec);

export interface WaveformBin {
  low: number;
  mid: number;
  high: number;
}

export interface AnalyzeResult {
  bpm: number;
  waveform: WaveformBin[];
}

export async function analyzeAudio(
  filePath: string,
  targetDowntempoRatio = 120
): Promise<AnalyzeResult> {
  const tempFile = path.join(os.tmpdir(), `analyze-${Date.now()}-${Math.random().toString(36).slice(2)}.raw`);
  try {
    // 22.05kHz mono f32le raw pcm
    await execAsync(`ffmpeg -v quiet -y -i "${filePath}" -f f32le -ac 1 -ar 22050 "${tempFile}"`);
    const buffer = await fs.readFile(tempFile);
    
    // Node Buffer to Float32Array (copy or slice carefully)
    const floatArray = new Float32Array(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    );
    
    // BPM
    const mt = new MusicTempo(floatArray);
    const bpm = Math.round(Number(mt.tempo));

    // Waveform
    const waveform: WaveformBin[] = [];
    const binSize = Math.floor(floatArray.length / targetDowntempoRatio);
    for (let i = 0; i < targetDowntempoRatio; i++) {
        const start = i * binSize;
        const end = Math.min((i + 1) * binSize, floatArray.length);
        
        let sum = 0;
        let diffSum = 0; 
        for (let j = start; j < end - 1; j++) {
            sum += Math.abs(floatArray[j]);
            diffSum += Math.abs(floatArray[j + 1] - floatArray[j]);
        }
        
        const count = end - start;
        const avgAmp = sum / count;
        const avgDiff = diffSum / count;
        
        const normalizedAmp = Math.min((avgAmp * 15), 1.0); // Boosted
        const highVal = Math.min((avgDiff * 25), 1.0);
        
        waveform.push({
            low: normalizedAmp * 0.9,
            mid: normalizedAmp * 0.6,
            high: normalizedAmp * 0.2 + highVal * 0.8
        });
    }

    return { bpm, waveform };
  } finally {
    try {
      await fs.unlink(tempFile);
    } catch {}
  }
}
