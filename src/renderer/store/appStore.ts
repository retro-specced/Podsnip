import { create } from 'zustand';
import { Podcast, Episode, Transcript, Annotation, AppState } from '../../shared/types';

interface AppStore {
  // Current app state
  currentState: AppState;
  setCurrentState: (state: AppState) => void;

  // Podcasts
  podcasts: Podcast[];
  currentPodcast: Podcast | null;
  setPodcasts: (podcasts: Podcast[]) => void;
  setCurrentPodcast: (podcast: Podcast | null) => void;
  addPodcast: (podcast: Podcast) => void;
  removePodcast: (podcastId: number) => void;

  // Episodes
  episodes: Episode[];
  currentEpisode: Episode | null;
  setEpisodes: (episodes: Episode[]) => void;
  setCurrentEpisode: (episode: Episode | null) => void;

  // Transcripts
  transcripts: Transcript[];
  setTranscripts: (transcripts: Transcript[]) => void;

  // Annotations
  annotations: Annotation[];
  currentAnnotation: Annotation | null;
  setAnnotations: (annotations: Annotation[]) => void;
  setCurrentAnnotation: (annotation: Annotation | null) => void;

  // Playback
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;

  // UI state
  isLoading: boolean;
  error: string | null;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selected transcript for annotation
  selectedTranscript: Transcript | null;
  setSelectedTranscript: (transcript: Transcript | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  currentState: 'onboarding',
  podcasts: [],
  currentPodcast: null,
  episodes: [],
  currentEpisode: null,
  transcripts: [],
  annotations: [],
  currentAnnotation: null,
  isPlaying: false,
  currentTime: 0,
  playbackSpeed: 1.0,
  isLoading: false,
  error: null,
  selectedTranscript: null,

  // Actions
  setCurrentState: (state) => set({ currentState: state }),

  setPodcasts: (podcasts) => set({ podcasts }),
  setCurrentPodcast: (podcast) => set({ currentPodcast: podcast }),
  addPodcast: (podcast) => set((state) => ({ podcasts: [...state.podcasts, podcast] })),
  removePodcast: (podcastId) =>
    set((state) => ({
      podcasts: state.podcasts.filter((p) => p.id !== podcastId),
    })),

  setEpisodes: (episodes) => set({ episodes }),
  setCurrentEpisode: (episode) => set({ currentEpisode: episode }),

  setTranscripts: (transcripts) => set({ transcripts }),

  setAnnotations: (annotations) => set({ annotations }),
  setCurrentAnnotation: (annotation) => set({ currentAnnotation: annotation }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setSelectedTranscript: (transcript) => set({ selectedTranscript: transcript }),
}));
