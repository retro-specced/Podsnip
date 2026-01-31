import { create } from 'zustand';
import { Podcast, Episode, Transcript, Annotation, AppState } from '../../shared/types';

interface HistorySnapshot {
  view: AppState;
  podcast: Podcast | null;
  episode: Episode | null; // This represents the VIEWING episode
  scrollPosition?: number;
  visibleCount?: number;
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
  restoredVisibleCount: number | null;
  setRestoredVisibleCount: (count: number | null) => void;

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
  // viewingEpisode: The episode shown in PlayerView (Details/Transcript)
  viewingEpisode: Episode | null;
  // playingEpisode: The episode currently producing audio
  playingEpisode: Episode | null;

  setEpisodes: (episodes: Episode[]) => void;
  setViewingEpisode: (episode: Episode | null) => void;
  setPlayingEpisode: (episode: Episode | null) => void;

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
  isAutoScrollEnabled: boolean;
  setIsAutoScrollEnabled: (enabled: boolean) => void;

  // Transcription State
  transcribingEpisode: Episode | null; // The episode currently being transcribed
  setTranscribingEpisode: (episode: Episode | null) => void;
  isTranscribing: boolean;
  transcriptionProgress: number;
  transcriptionStage: string;
  setIsTranscribing: (transcribing: boolean) => void;
  setTranscriptionProgress: (progress: number) => void;
  setTranscriptionStage: (stage: string) => void;


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
  history: [{ view: 'onboarding', podcast: null, episode: null, scrollPosition: 0, visibleCount: 20 }],
  historyIndex: 0,
  restoredScrollPosition: null,
  restoredVisibleCount: null,

  podcasts: [],
  currentPodcast: null,
  episodes: [],
  viewingEpisode: null,
  playingEpisode: null,
  transcripts: [],
  transcribingEpisode: null,
  annotations: [],
  currentAnnotation: null,
  isPlaying: false,
  currentTime: 0,
  playbackSpeed: 1.0,
  jumpToTime: null,
  isLoading: false,
  error: null,
  isAutoScrollEnabled: true,
  selectedSegments: [],
  showSaveToast: false,

  // Actions
  setIsAutoScrollEnabled: (enabled) => set({ isAutoScrollEnabled: enabled }),

  updateCurrentSnapshot: (updates) => set((state) => {
    const newHistory = [...state.history];
    newHistory[state.historyIndex] = { ...newHistory[state.historyIndex], ...updates };
    return { history: newHistory };
  }),

  setRestoredScrollPosition: (pos) => set({ restoredScrollPosition: pos }),
  setRestoredVisibleCount: (count) => set({ restoredVisibleCount: count }),

  navigateToView: (view, context = {}) => set((state) => {
    const newSnapshot: HistorySnapshot = {
      view,
      podcast: context.podcastId !== undefined
        ? (state.podcasts.find(p => p.id === context.podcastId) || null)
        : state.currentPodcast,
      episode: context.episodeId !== undefined
        ? (state.episodes.find(e => e.id === context.episodeId) || null)
        : state.viewingEpisode // Default to current viewing episode
    };

    let newHistory = [...state.history];
    // If replace is true, overwrite current entry
    if (context.replace) {
      newHistory[state.historyIndex] = newSnapshot;
      return {
        currentState: view,
        history: newHistory,
        currentPodcast: newSnapshot.podcast,
        viewingEpisode: newSnapshot.episode
      };
    }

    // Otherwise push new entry
    newHistory = newHistory.slice(0, state.historyIndex + 1);
    newHistory.push(newSnapshot);

    return {
      currentState: view,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      currentPodcast: newSnapshot.podcast,
      viewingEpisode: newSnapshot.episode,
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
        viewingEpisode: snapshot.episode,
        // playingEpisode remains untouched!
        restoredScrollPosition: snapshot.scrollPosition || 0,
        restoredVisibleCount: snapshot.visibleCount || 20,
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
        viewingEpisode: snapshot.episode,
        // playingEpisode remains untouched!
        restoredScrollPosition: snapshot.scrollPosition || 0,
        restoredVisibleCount: snapshot.visibleCount || 20,
      };
    }
    return {};
  }),

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,

  setCurrentState: (state) => set((s) => ({ ...s, currentState: state })),

  setPodcasts: (podcasts) => set({ podcasts }),
  setCurrentPodcast: (podcast) => set({ currentPodcast: podcast }),
  addPodcast: (podcast) => set((state) => ({ podcasts: [...state.podcasts, podcast] })),
  removePodcast: (podcastId) => set((state) => ({
    podcasts: state.podcasts.filter(p => p.id !== podcastId)
  })),

  setEpisodes: (episodes) => set({ episodes }),
  setViewingEpisode: (episode) => set({ viewingEpisode: episode }),
  setPlayingEpisode: (episode) => set({ playingEpisode: episode }),

  setTranscripts: (transcripts) => set({ transcripts }),

  setAnnotations: (annotations) => set({ annotations }),
  setCurrentAnnotation: (annotation) => set({ currentAnnotation: annotation }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setJumpToTime: (time) => set({ jumpToTime: time }),

  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setTranscribingEpisode: (episode) => set({ transcribingEpisode: episode }),
  setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),
  setTranscriptionProgress: (progress) => set({ transcriptionProgress: progress }),
  setTranscriptionStage: (stage) => set({ transcriptionStage: stage }),


  setSelectedSegments: (segments) => set({ selectedSegments: segments }),
  toggleSegmentSelection: (segment) => set((state) => {
    const exists = state.selectedSegments.find(s => s.id === segment.id);
    if (exists) {
      return { selectedSegments: state.selectedSegments.filter(s => s.id !== segment.id) };
    } else {
      return { selectedSegments: [...state.selectedSegments, segment] };
    }
  }),
  clearSelectedSegments: () => set({ selectedSegments: [] }),

  setShowSaveToast: (show) => set({ showSaveToast: show }),
}));
