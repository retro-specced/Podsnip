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
  jumpToTime: number | null; // Used for jumping from notes
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setJumpToTime: (time: number | null) => void;

  // UI state
  isLoading: boolean;
  error: string | null;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selected segments for annotation (supports multi-selection)
  selectedSegments: Transcript[];
  setSelectedSegments: (segments: Transcript[]) => void;
  toggleSegmentSelection: (segment: Transcript) => void;
  clearSelectedSegments: () => void;

  // Toast notifications
  showSaveToast: boolean;
  setShowSaveToast: (show: boolean) => void;
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
  jumpToTime: null,
  isLoading: false,
  error: null,
  selectedSegments: [],
  showSaveToast: false,

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
  setJumpToTime: (time) => set({ jumpToTime: time }),

  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setSelectedSegments: (segments) => set({ selectedSegments: segments }),
  toggleSegmentSelection: (segment) => set((state) => {
    const isSelected = state.selectedSegments.some(s => s.id === segment.id);
    if (isSelected) {
      return { selectedSegments: state.selectedSegments.filter(s => s.id !== segment.id) };
    } else {
      // Add segment and sort by start_time to maintain order
      const newSelection = [...state.selectedSegments, segment].sort((a, b) => a.start_time - b.start_time);
      return { selectedSegments: newSelection };
    }
  }),
  clearSelectedSegments: () => set({ selectedSegments: [] }),
  setShowSaveToast: (show) => set({ showSaveToast: show }),
}));

