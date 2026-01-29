import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import { DatabaseService } from './database';

export class TranscriptionService {
  private apiKey: string | null = null;

  constructor() {
    // API key can be set later via settings
    this.apiKey = process.env.OPENAI_API_KEY || null;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async transcribeEpisode(episodeId: number, audioUrl: string, db: DatabaseService): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Transcription API key not configured. Please set your OpenAI API key in settings.');
    }

    let tempFilePath: string | null = null;

    try {
      // Check if transcript already exists
      const existing = db.getTranscript(episodeId);
      if (existing.length > 0) {
        console.log('Transcript already exists for episode', episodeId);
        return;
      }

      // Download audio file to temp location
      console.log('Downloading audio file for transcription...');
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minutes
        maxContentLength: 25 * 1024 * 1024, // 25MB limit (OpenAI max)
      });

      // Save to temporary file
      tempFilePath = path.join(os.tmpdir(), `podsnip-${episodeId}-${Date.now()}.mp3`);
      fs.writeFileSync(tempFilePath, Buffer.from(audioResponse.data));

      // Prepare form data for OpenAI API
      console.log('Calling Whisper API for transcription...');
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFilePath), {
        filename: 'audio.mp3',
        contentType: 'audio/mpeg',
      });
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      const transcriptionResponse = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 600000, // 10 minutes
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const result = transcriptionResponse.data;

      // Store transcript segments in database
      if (result.segments && result.segments.length > 0) {
        for (let i = 0; i < result.segments.length; i++) {
          const segment = result.segments[i];
          db.insertTranscript({
            episode_id: episodeId,
            segment_index: i,
            start_time: segment.start,
            end_time: segment.end,
            text: segment.text.trim(),
            confidence_score: segment.confidence || 0,
          });
        }
        console.log(`Transcription complete for episode ${episodeId}. ${result.segments.length} segments stored.`);
      } else {
        throw new Error('No transcript segments returned from API');
      }

      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (error: any) {
      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      console.error('Transcription error:', error);
      
      // Provide more specific error messages
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again, or check your OpenAI API usage limits.');
      } else if (error.response?.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key in Settings.');
      } else if (error.response?.status === 413) {
        throw new Error('Audio file too large. OpenAI Whisper has a 25MB file size limit.');
      } else if (error.response?.data?.error?.message) {
        throw new Error(`OpenAI API error: ${error.response.data.error.message}`);
      }
      
      throw new Error(`Failed to transcribe episode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Alternative: Local transcription using whisper.cpp (to be implemented)
  async transcribeLocally(episodeId: number, audioPath: string, db: DatabaseService): Promise<void> {
    // TODO: Implement local transcription using whisper.cpp
    // This would involve:
    // 1. Spawning a child process to run whisper.cpp
    // 2. Parsing the output
    // 3. Storing segments in the database
    throw new Error('Local transcription not yet implemented');
  }
}
