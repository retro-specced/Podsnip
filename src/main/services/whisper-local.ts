import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { DatabaseService } from './database';

export class LocalWhisperService {
  private whisperPath: string | null = null;
  private modelPath: string | null = null;

  constructor() {
    // Check if whisper.cpp is installed
    this.checkWhisperInstallation();
  }

  private checkWhisperInstallation(): void {
    // Check common installation paths
    const possiblePaths = [
      '/usr/local/bin/whisper-cpp',
      '/usr/bin/whisper-cpp',
      path.join(os.homedir(), '.local/bin/whisper-cpp'),
      path.join(os.homedir(), 'whisper.cpp/main'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.whisperPath = p;
        break;
      }
    }
  }

  isAvailable(): boolean {
    return this.whisperPath !== null;
  }

  getInstallInstructions(): string {
    return `
To use local transcription, you need to install whisper.cpp:

1. Install dependencies:
   sudo dnf install -y git make gcc g++ ffmpeg

2. Clone and build whisper.cpp:
   cd ~
   git clone https://github.com/ggerganov/whisper.cpp.git
   cd whisper.cpp
   make

3. Download a model (base model recommended for balance of speed/accuracy):
   bash ./models/download-ggml-model.sh base

4. Create a symlink:
   sudo ln -s ~/whisper.cpp/main /usr/local/bin/whisper-cpp

5. Restart Podsnip

Model sizes:
- tiny: Fastest, least accurate (~75MB)
- base: Good balance (~142MB) - RECOMMENDED
- small: Better accuracy (~466MB)
- medium: High accuracy (~1.5GB, slower)
- large: Best accuracy (~2.9GB, very slow)
`;
  }

  async transcribeEpisode(episodeId: number, audioUrl: string, db: DatabaseService): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Whisper.cpp not installed. ' + this.getInstallInstructions());
    }

    let tempAudioPath: string | null = null;
    let tempWavPath: string | null = null;

    try {
      // Check if transcript already exists
      const existing = db.getTranscript(episodeId);
      if (existing.length > 0) {
        console.log('Transcript already exists for episode', episodeId);
        return;
      }

      // Find model
      const modelPath = this.findModel();
      if (!modelPath) {
        throw new Error('No Whisper model found. Please download a model first.');
      }

      console.log(`Using model: ${modelPath}`);

      // Download audio file
      console.log('Downloading audio file...');
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 300000,
      });

      tempAudioPath = path.join(os.tmpdir(), `podsnip-${episodeId}-${Date.now()}.mp3`);
      fs.writeFileSync(tempAudioPath, Buffer.from(audioResponse.data));

      // Convert to WAV format (required by whisper.cpp)
      console.log('Converting audio to WAV format...');
      tempWavPath = await this.convertToWav(tempAudioPath);

      // Run whisper.cpp transcription
      console.log('Transcribing audio (this may take a while)...');
      const transcript = await this.runWhisper(tempWavPath, modelPath);

      // Parse and store results
      this.parseAndStore(transcript, episodeId, db);

      // Cleanup
      if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (tempWavPath && fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);

      console.log(`Local transcription complete for episode ${episodeId}`);
    } catch (error: any) {
      // Cleanup on error
      if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (tempWavPath && fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);

      console.error('Local transcription error:', error);
      throw new Error(`Failed to transcribe locally: ${error.message}`);
    }
  }

  private findModel(): string | null {
    const whisperDir = path.join(os.homedir(), 'whisper.cpp/models');
    const models = ['ggml-base.bin', 'ggml-small.bin', 'ggml-tiny.bin', 'ggml-medium.bin'];

    for (const model of models) {
      const modelPath = path.join(whisperDir, model);
      if (fs.existsSync(modelPath)) {
        return modelPath;
      }
    }

    return null;
  }

  private convertToWav(inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace(/\.\w+$/, '.wav');
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ar', '16000', // 16kHz sample rate
        '-ac', '1',      // Mono
        '-c:a', 'pcm_s16le', // 16-bit PCM
        '-y',            // Overwrite
        outputPath
      ]);

      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg conversion failed: ${errorOutput}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      });
    });
  }

  private runWhisper(audioPath: string, modelPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const whisper = spawn(this.whisperPath!, [
        '-m', modelPath,
        '-f', audioPath,
        '--output-csv',
        '--print-progress',
      ]);

      let output = '';
      let errorOutput = '';

      whisper.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('Whisper:', text.trim());
      });

      whisper.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      whisper.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Whisper transcription failed (exit code ${code}): ${errorOutput}`));
        }
      });

      whisper.on('error', (err) => {
        reject(new Error(`Failed to run whisper: ${err.message}`));
      });
    });
  }

  private parseAndStore(output: string, episodeId: number, db: DatabaseService): void {
    const lines = output.split('\n').filter(line => line.trim());
    let segmentIndex = 0;

    for (const line of lines) {
      // Parse CSV format: start,end,text
      const match = line.match(/^(\d+),(\d+),(.+)$/);
      if (match) {
        const [, startMs, endMs, text] = match;
        const startTime = parseInt(startMs) / 1000; // Convert to seconds
        const endTime = parseInt(endMs) / 1000;

        if (text.trim()) {
          db.insertTranscript({
            episode_id: episodeId,
            segment_index: segmentIndex++,
            start_time: startTime,
            end_time: endTime,
            text: text.trim(),
            confidence_score: 0.9, // Local whisper doesn't provide confidence
          });
        }
      }
    }

    if (segmentIndex === 0) {
      throw new Error('No transcript segments were extracted');
    }
  }
}
