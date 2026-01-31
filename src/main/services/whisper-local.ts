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

  async transcribeEpisode(
    episodeId: number,
    audioUrl: string,
    db: DatabaseService,
    audioDir: string,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Whisper.cpp not installed. ' + this.getInstallInstructions());
    }

    let tempWavPath: string | null = null;
    let permanentAudioPath: string | null = null;

    try {
      // Check if transcript already exists
      const existing = db.getTranscript(episodeId);
      if (existing.length > 0) {
        console.log('Transcript already exists for episode', episodeId);
        if (onProgress) onProgress(100, 'Complete (already transcribed)');
        return;
      }

      // Check if we already have a local copy of the audio
      const episode = db.getEpisode(episodeId);
      if (episode?.local_path && fs.existsSync(episode.local_path)) {
        console.log('Using existing local audio file:', episode.local_path);
        permanentAudioPath = episode.local_path;
      } else {
        // Download audio file to permanent location
        if (onProgress) onProgress(5, 'Downloading audio');
        console.log('Downloading audio file...');

        // Ensure audio directory exists
        if (!fs.existsSync(audioDir)) {
          fs.mkdirSync(audioDir, { recursive: true });
        }

        const audioResponse = await axios.get(audioUrl, {
          responseType: 'arraybuffer',
          timeout: 300000,
        });

        // Save to permanent location (so playback uses same file as transcript)
        permanentAudioPath = path.join(audioDir, `episode-${episodeId}.mp3`);
        fs.writeFileSync(permanentAudioPath, Buffer.from(audioResponse.data));

        // Update database with local path
        db.updateEpisodeLocalPath(episodeId, permanentAudioPath);
        console.log('Audio saved to:', permanentAudioPath);
      }

      // Find model
      const modelPath = this.findModel();
      if (!modelPath) {
        throw new Error('No Whisper model found. Please download a model first.');
      }

      console.log(`Using model: ${modelPath}`);

      // Convert to WAV format (required by whisper.cpp)
      if (onProgress) onProgress(15, 'Converting audio format');
      console.log('Converting audio to WAV format...');
      tempWavPath = await this.convertToWav(permanentAudioPath);

      // Get audio duration for accurate progress tracking
      let audioDuration = 0;
      try {
        audioDuration = await this.getAudioDuration(tempWavPath);
        console.log(`Audio duration: ${audioDuration} seconds`);
      } catch (err) {
        console.warn('Could not get audio duration, using fallback progress');
      }

      // Run whisper.cpp transcription
      if (onProgress) onProgress(20, 'Transcribing audio');
      console.log('Transcribing audio (this may take a while)...');
      const transcript = await this.runWhisper(tempWavPath, modelPath, audioDuration, (progress, stage) => {
        // Map whisper progress (0-100) to our range (20-95)
        const mappedProgress = 20 + (progress * 0.75);
        if (onProgress) onProgress(Math.round(mappedProgress), stage);
      });

      // Parse and store results
      if (onProgress) onProgress(95, 'Saving transcript');
      this.parseAndStore(transcript, episodeId, db);

      // Cleanup WAV file only (keep permanent audio)
      if (tempWavPath && fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);

      if (onProgress) onProgress(100, 'Complete');
      console.log(`Local transcription complete for episode ${episodeId}`);
    } catch (error: any) {
      // Cleanup temp WAV file on error (keep permanent audio if it was downloaded)
      if (tempWavPath && fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);

      console.error('Local transcription error:', error);
      throw new Error(`Failed to transcribe locally: ${error.message}`);
    }
  }

  private findModel(): string | null {
    // Check multiple possible whisper.cpp locations
    const possibleDirs = [
      path.join(os.homedir(), 'whisper.cpp/models'),
      path.join(os.homedir(), 'Documents/Projects/Models/whisper.cpp/models'),
      '/usr/local/share/whisper.cpp/models',
    ];

    const models = [
      'ggml-base.bin',
      'ggml-base.en.bin',
      'ggml-small.bin',
      'ggml-small.en.bin',
      'ggml-tiny.bin',
      'ggml-tiny.en.bin',
      'ggml-medium.bin',
      'ggml-medium.en.bin',
    ];

    for (const dir of possibleDirs) {
      for (const model of models) {
        const modelPath = path.join(dir, model);
        if (fs.existsSync(modelPath)) {
          return modelPath;
        }
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

  private getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        audioPath
      ]);

      let output = '';
      let errorOutput = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          const duration = parseFloat(output.trim());
          if (!isNaN(duration)) {
            resolve(duration);
          } else {
            reject(new Error('Failed to parse audio duration'));
          }
        } else {
          reject(new Error(`FFprobe failed: ${errorOutput}`));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`FFprobe error: ${err.message}`));
      });
    });
  }

  private runWhisper(
    audioPath: string,
    modelPath: string,
    audioDuration: number,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let lastProgressUpdate = Date.now();
      let currentProgress = 0;
      let lastReportedProgress = 0;
      let hasReached100 = false;
      let lastTimestampSeconds = 0;

      const whisper = spawn(this.whisperPath!, [
        '-m', modelPath,
        '-f', audioPath,
        '--output-txt',
        '--print-progress',  // Enable progress output
      ]);

      let output = '';
      let errorOutput = '';

      // Helper function to format time remaining based on actual elapsed and progress
      const formatTimeRemaining = (progress: number): string => {
        if (progress <= 0 || progress >= 100) return '';

        // Use actual elapsed time for more accurate estimate
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = elapsedMs / 1000;

        if (progress >= 85) {
          return 'finishing up';
        }

        // Estimate remaining time
        const estimatedTotalSeconds = (elapsedSeconds / progress) * 100;
        const remainingSeconds = Math.max(0, estimatedTotalSeconds - elapsedSeconds);

        if (remainingSeconds < 60) {
          const secs = Math.ceil(remainingSeconds);
          return secs <= 10 ? 'almost done' : `${secs} seconds remaining`;
        } else {
          const minutes = Math.ceil(remainingSeconds / 60);
          return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
        }
      };

      // Simulate progress if no real progress is detected (less aggressive now)
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - lastProgressUpdate;

        // Only use fallback if we're stuck for a long time
        if (elapsed > 5000 && currentProgress < 99) {
          // Small increment to show we're still working
          const incrementAmount = currentProgress >= 90 ? 0.5 : 0.3;
          currentProgress = Math.min(currentProgress + incrementAmount, 99);

          if (Math.floor(currentProgress) > Math.floor(lastReportedProgress)) {
            lastReportedProgress = currentProgress;
            if (onProgress) {
              const timeMsg = formatTimeRemaining(currentProgress);
              onProgress(Math.floor(currentProgress), `Transcribing audio${timeMsg ? ' - ' + timeMsg : ''}`);
            }
          }
          lastProgressUpdate = Date.now();
        }
      }, 2000);

      whisper.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('Whisper stdout:', text.trim());

        // Parse timestamps from stdout for accurate progress
        // Format: [00:01:23.456 --> 00:01:25.678]
        const timestampMatch = text.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/);
        if (timestampMatch && audioDuration > 0) {
          // Use the end timestamp for progress
          const endHours = parseInt(timestampMatch[5]);
          const endMinutes = parseInt(timestampMatch[6]);
          const endSeconds = parseInt(timestampMatch[7]);
          const endMs = parseInt(timestampMatch[8]);
          const endTotalSeconds = endHours * 3600 + endMinutes * 60 + endSeconds + endMs / 1000;

          if (endTotalSeconds > lastTimestampSeconds) {
            lastTimestampSeconds = endTotalSeconds;

            // Calculate progress based on actual audio duration
            const timestampProgress = Math.min(99, Math.floor((endTotalSeconds / audioDuration) * 100));

            if (timestampProgress > currentProgress) {
              currentProgress = timestampProgress;
              lastReportedProgress = currentProgress;
              if (onProgress) {
                const timeMsg = formatTimeRemaining(currentProgress);
                onProgress(currentProgress, `Transcribing audio${timeMsg ? ' - ' + timeMsg : ''}`);
              }
              lastProgressUpdate = Date.now();
            }
          }
        }
      });

      whisper.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;

        // Check for whisper's own progress callback (as backup)
        const progressMatch = text.match(/progress\s*=\s*(\d+)%/);
        if (progressMatch) {
          const whisperProgress = parseInt(progressMatch[1]);

          // When whisper reports 100%, update to 95% and let it finish
          if (whisperProgress >= 100) {
            if (!hasReached100) {
              hasReached100 = true;
              currentProgress = 95;
              lastReportedProgress = currentProgress;
              if (onProgress) {
                onProgress(95, 'Transcribing audio - finishing up');
              }
              lastProgressUpdate = Date.now();
            }
          }
        }

        // Log all stderr output for debugging
        console.log('Whisper stderr:', text.trim());
      });

      whisper.on('close', (code) => {
        clearInterval(progressInterval);
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Whisper transcription failed (exit code ${code}): ${errorOutput}`));
        }
      });

      whisper.on('error', (err) => {
        clearInterval(progressInterval);
        reject(new Error(`Failed to run whisper: ${err.message}`));
      });
    });
  }

  private parseAndStore(output: string, episodeId: number, db: DatabaseService): void {
    try {
      // Parse SRT format: [HH:MM:SS.mmm --> HH:MM:SS.mmm]   text
      const lines = output.split('\n');

      // First pass: collect all raw segments with timing
      interface RawSegment {
        startTime: number;
        endTime: number;
        text: string;
      }
      const rawSegments: RawSegment[] = [];

      for (const line of lines) {
        const match = line.match(/^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.+)$/);
        if (match) {
          const [, startH, startM, startS, startMs, endH, endM, endS, endMs, text] = match;

          // Convert to seconds
          const startTime = parseInt(startH) * 3600 + parseInt(startM) * 60 + parseInt(startS) + parseInt(startMs) / 1000;
          const endTime = parseInt(endH) * 3600 + parseInt(endM) * 60 + parseInt(endS) + parseInt(endMs) / 1000;

          // Strip ANSI color codes and clean text
          const cleanText = text.replace(/\u001b\[\d+(;\d+)*m/g, '').trim();

          if (cleanText) {
            rawSegments.push({ startTime, endTime, text: cleanText });
          }
        }
      }

      if (rawSegments.length === 0) {
        console.error('No segments found in output:', output.substring(0, 500));
        throw new Error('No transcript segments were extracted');
      }

      // Second pass: merge into sentences
      // A sentence ends with . ? ! followed by space or end of text
      const sentences: RawSegment[] = [];
      let currentSentence = {
        startTime: rawSegments[0].startTime,
        endTime: rawSegments[0].endTime,
        text: ''
      };

      for (const segment of rawSegments) {
        // Add space between segments if needed
        if (currentSentence.text && !currentSentence.text.endsWith(' ')) {
          currentSentence.text += ' ';
        }
        currentSentence.text += segment.text;
        currentSentence.endTime = segment.endTime;

        // Check if this segment ends with sentence-ending punctuation
        const endsWithSentence = /[.!?][\s]*$/.test(segment.text);

        if (endsWithSentence) {
          // Finalize this sentence
          sentences.push({
            startTime: currentSentence.startTime,
            endTime: currentSentence.endTime,
            text: currentSentence.text.trim()
          });

          // Start new sentence (will use next segment's start time)
          currentSentence = {
            startTime: segment.endTime,
            endTime: segment.endTime,
            text: ''
          };
        }
      }

      // Don't forget the last sentence if it doesn't end with punctuation
      if (currentSentence.text.trim()) {
        sentences.push({
          startTime: currentSentence.startTime,
          endTime: currentSentence.endTime,
          text: currentSentence.text.trim()
        });
      }

      // Store sentences as transcript segments
      let segmentIndex = 0;
      for (const sentence of sentences) {
        db.insertTranscript({
          episode_id: episodeId,
          segment_index: segmentIndex++,
          start_time: sentence.startTime,
          end_time: sentence.endTime,
          text: sentence.text,
          confidence_score: 0.9,
        });
      }

      console.log(`Stored ${segmentIndex} sentence-level transcript segments (from ${rawSegments.length} raw segments)`);
    } catch (error) {
      console.error('Failed to parse whisper output:', output.substring(0, 500));
      throw new Error(`Failed to parse transcription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
