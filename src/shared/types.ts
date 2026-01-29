// Shared type definitions for Podsnip

export interface Podcast {
  id: number;
  feed_url: string;
  title: string;
  description: string;
  author: string;
  artwork_url: string;
  last_updated: string;
}

export interface Episode {
  id: number;
  podcast_id: number;
  title: string;
  description: string;
  audio_url: string;
  duration: number;
  published_date: string;
  download_status: 'none' | 'downloading' | 'downloaded' | 'failed';
  local_path: string | null;
}

export interface Transcript {
  id: number;
  episode_id: number;
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
  confidence_score: number;
}

export interface Annotation {
  id: number;
  transcript_id: number;
  note_text: string;
  created_at: string;
  updated_at: string;
  tags: string;
}

export interface PlaybackState {
  episode_id: number;
  current_position: number;
  playback_speed: number;
  last_played: string;
  completed: boolean;
}

export interface Settings {
  theme: 'light' | 'dark';
  accentColor: string;
  fontSize: number;
  defaultPlaybackSpeed: number;
  skipForwardInterval: number;
  skipBackwardInterval: number;
  autoPlayNext: boolean;
  transcriptionProvider: 'openai' | 'local';
  openaiApiKey?: string;
}

export type AppState = 
  | 'onboarding'
  | 'browsing'
  | 'player'
  | 'annotation'
  | 'notes'
  | 'settings';

declare global {
  interface Window {
    api: {
      podcast: {
        add: (feedUrl: string) => Promise<Podcast>;
        list: () => Promise<Podcast[]>;
        get: (podcastId: number) => Promise<Podcast>;
        delete: (podcastId: number) => Promise<void>;
        refresh: (podcastId: number) => Promise<void>;
      };
      episode: {
        list: (podcastId: number) => Promise<Episode[]>;
        get: (episodeId: number) => Promise<Episode>;
      };
      transcription: {
        get: (episodeId: number) => Promise<Transcript[]>;
        create: (episodeId: number, audioUrl: string) => Promise<void>;
        checkLocal: () => Promise<{ available: boolean; instructions: string }>;
      };
      annotation: {
        create: (data: { transcriptId: number; noteText: string; tags?: string[] }) => Promise<number>;
        list: (episodeId?: number) => Promise<Annotation[]>;
        update: (annotationId: number, noteText: string, tags?: string[]) => Promise<void>;
        delete: (annotationId: number) => Promise<void>;
      };
      settings: {
        get: (key: string) => Promise<string | undefined>;
        set: (key: string, value: string) => Promise<void>;
      };
      playback: {
        get: (episodeId: number) => Promise<PlaybackState | undefined>;
        save: (episodeId: number, position: number, speed: number) => Promise<void>;
      };
    };
  }
}
