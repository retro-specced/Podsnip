import { create } from 'zustand';
import { Podcast, Episode, Transcript, Annotation, AppState } from '../../shared/types';

interface HistorySnapshot {
  view: AppState;
  podcast: Podcast | null;
  episode: Episode | null;
  scrollPosition?: number;
}

interface AppStore {
  // Current app state (from history)
  currentState: AppState;

  // Navigation History
  history: HistorySnapshot[];
  historyIndex: number;

  // Unified Navigation Action
  navigateToView: (view: AppState, context?: { podcastId?: number | null, episodeId?: number | null, replace?: boolean }) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;

  // Snapshot Update
  updateCurrentSnapshot: (updates: Partial<HistorySnapshot>) => void;
  // Scroll Restoration
  restoredScrollPosition: number | null;
  setRestoredScrollPosition: (pos: number | null) => void;

  // Compatibility / Simple Setters
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
  jumpToTime: number | null;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setJumpToTime: (time: number | null) => void;

  // UI state
  isLoading: boolean;
  error: string | null;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selected segments
  selectedSegments: Transcript[];
  setSelectedSegments: (segments: Transcript[]) => void;
  toggleSegmentSelection: (segment: Transcript) => void;
  clearSelectedSegments: () => void;

  // Toast
  showSaveToast: boolean;
  setShowSaveToast: (show: boolean) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  currentState: 'onboarding',
  history: [{ view: 'onboarding', podcast: null, episode: null, scrollPosition: 0 }],
  historyIndex: 0,
  restoredScrollPosition: null,

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
  updateCurrentSnapshot: (updates) => set((state) => {
    const newHistory = [...state.history];
    newHistory[state.historyIndex] = { ...newHistory[state.historyIndex], ...updates };
    return { history: newHistory };
  }),

  setRestoredScrollPosition: (pos) => set({ restoredScrollPosition: pos }),

  navigateToView: (view, context = {}) => set((state) => {
    const newSnapshot: HistorySnapshot = {
      view,
      podcast: context.podcastId !== undefined
        ? (state.podcasts.find(p => p.id === context.podcastId) || null)
        : state.currentPodcast,
      episode: context.episodeId !== undefined
        ? (state.episodes.find(e => e.id === context.episodeId) || null)
        : state.currentEpisode,
      scrollPosition: 0,
    };

    if (context.replace) {
      const newHistory = [...state.history];
      newHistory[state.historyIndex] = newSnapshot;
      return {
        currentState: view,
        history: newHistory,
        currentPodcast: newSnapshot.podcast,
        currentEpisode: newSnapshot.episode,
      };
    }

    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newSnapshot);

    return {
      currentState: view,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      currentPodcast: newSnapshot.podcast,
      currentEpisode: newSnapshot.episode,
    };
  }),

  navigateBack: () => set((state) => {
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];
      return {
        historyIndex: newIndex,
        currentState: snapshot.view,
        currentPodcast: snapshot.podcast,
        currentEpisode: snapshot.episode,
        restoredScrollPosition: snapshot.scrollPosition || 0,
      };
    }
    return {};
  }),

  navigateForward: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const snapshot = state.history[newIndex];
      return {
        historyIndex: newIndex,
        currentState: snapshot.view,
        currentPodcast: snapshot.podcast,
        currentEpisode: snapshot.episode,
        restoredScrollPosition: snapshot.scrollPosition || 0,
      };
    }
    return {};
  }),

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,

  setCurrentState: (state) => get().navigateToView(state),

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
      return { selectedSegments: [...state.selectedSegments, segment] };
    }
  }),
  clearSelectedSegments: () => set({ selectedSegments: [] }),

  setShowSaveToast: (show) => set({ showSaveToast: show }),
}));
