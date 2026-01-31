import { create } from 'zustand';
import { Podcast, Episode, Transcript, Annotation, AppState } from '../../shared/types';

interface HistorySnapshot {
  view: AppState;
  podcastId: number | null;
  episodeId: number | null;
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

  // ... (rest of store)

  // Replaced simple setters with internal logic or deprecated them for navigation purposes
  setCurrentState: (state: AppState) => void; // Keeping for compatibility but internally it should use navigation logic if possible

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

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  currentState: 'onboarding',
  history: [{ view: 'onboarding', podcastId: null, episodeId: null }],
  historyIndex: 0,

  podcasts: [],
  currentPodcast: null,
  episodes: [],
  currentEpisode: null,
  // ... (rest of initial state)
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

  // Unified Navigation
  navigateToView: (view, context = {}) => set((state) => {
    // If we are just updating the current view with SAME context, maybe replace?
    // But usually navigateToView implies a user action.

    // Construct new snapshot
    const newSnapshot: HistorySnapshot = {
      view,
      podcastId: context.podcastId !== undefined ? context.podcastId : state.currentPodcast?.id || null,
      episodeId: context.episodeId !== undefined ? context.episodeId : state.currentEpisode?.id || null,
    };

    // If replace is true, replace current history entry
    if (context.replace) {
      const newHistory = [...state.history];
      newHistory[state.historyIndex] = newSnapshot;
      return {
        currentState: view,
        history: newHistory,
        // Also update context if provided
        currentPodcast: context.podcastId ? state.podcasts.find(p => p.id === context.podcastId) || null : (context.podcastId === null ? null : state.currentPodcast),
        currentEpisode: context.episodeId ? state.episodes.find(e => e.id === context.episodeId) || null : (context.episodeId === null ? null : state.currentEpisode),
      };
    }

    // Otherwise push new entry and truncate forward history
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newSnapshot);

    return {
      currentState: view,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      // Update context
      currentPodcast: context.podcastId !== undefined ? (state.podcasts.find(p => p.id === context.podcastId) || null) : state.currentPodcast,
      currentEpisode: context.episodeId !== undefined ? (state.episodes.find(e => e.id === context.episodeId) || null) : state.currentEpisode,
    };
  }),

  navigateBack: () => set((state) => {
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const snapshot = state.history[newIndex];
      return {
        historyIndex: newIndex,
        currentState: snapshot.view,
        currentPodcast: snapshot.podcastId ? state.podcasts.find(p => p.id === snapshot.podcastId) || null : null,
        currentEpisode: snapshot.episodeId ? state.episodes.find(e => e.id === snapshot.episodeId) || null : null,
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
        currentPodcast: snapshot.podcastId ? state.podcasts.find(p => p.id === snapshot.podcastId) || null : null,
        currentEpisode: snapshot.episodeId ? state.episodes.find(e => e.id === snapshot.episodeId) || null : null,
      };
    }
    return {};
  }),

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,

  // Compatibility / Simple Setters
  setCurrentState: (state) => get().navigateToView(state),

  // ... (rest of setters)
  setPodcasts: (podcasts) => set({ podcasts }),
  setCurrentPodcast: (podcast) => set({ currentPodcast: podcast }),
  addPodcast: (podcast) => set((state) => ({ podcasts: [...state.podcasts, podcast] })),
  removePodcast: (podcastId) =>
    set((state) => ({
      podcasts: state.podcasts.filter((p) => p.id !== podcastId),
    })),

  setEpisodes: (episodes) => set({ episodes }),
  setCurrentEpisode: (episode) => set({ currentEpisode: episode }),
  // ...


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

