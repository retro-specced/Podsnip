import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Podcast, Episode, Transcript, Annotation, AppState } from '../../shared/types';

interface HistorySnapshot {
  view: AppState;
  podcast: Podcast | null;
  episode: Episode | null; // This represents the VIEWING episode
  scrollPosition?: number;
  visibleCount?: number;
  // Notes View State
  notesViewMode?: 'masonry' | 'podcasts';
  notesSelectedPodcastId?: number | null;
}

interface AppStore {
  // Current app state (from history)
  currentState: AppState;

  // Navigation History
  history: HistorySnapshot[];
  historyIndex: number;

  // Unified Navigation Action
  navigateToView: (view: AppState, context?: {
    podcastId?: number | null,
    episodeId?: number | null,
    replace?: boolean,
    notesViewMode?: 'masonry' | 'podcasts',
    notesSelectedPodcastId?: number | null
  }) => void;
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

  // Transcript Toast (Actionable)
  transcriptToast: { show: boolean; episodeId: number; } | null;
  setTranscriptToast: (toast: { show: boolean; episodeId: number; } | null) => void;

  // Notes View State
  notesViewMode: 'masonry' | 'podcasts';
  notesSelectedPodcastId: number | null;
  setNotesViewMode: (mode: 'masonry' | 'podcasts') => void;
  setNotesSelectedPodcastId: (id: number | null) => void;
  // Annotation Source & Return Logic
  annotationSource: {
    view: AppState;
    episodeId: number | null;
    previousAutoScrollEnabled: boolean;
    captureTime: number;
    // We could store more context if needed
  } | null;
  setAnnotationSource: (source: AppStore['annotationSource']) => void;

  // Pending Scroll Target (for restoring position or jumping from note)
  pendingScrollTarget: number | null;
  setPendingScrollTarget: (time: number | null) => void;

  // Sidebar Search & Sort
  podcastSortOrder: 'recentlyAdded' | 'lastUpdated' | 'alphabeticalAZ' | 'alphabeticalZA';
  setPodcastSortOrder: (order: 'recentlyAdded' | 'lastUpdated' | 'alphabeticalAZ' | 'alphabeticalZA') => void;
  podcastSearchQuery: string;
  setPodcastSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
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
      isTranscribing: false,
      transcriptionProgress: 0,
      transcriptionStage: '',
      selectedSegments: [],
      showSaveToast: false,
      transcriptToast: null,

      notesViewMode: 'masonry',
      notesSelectedPodcastId: null,

      annotationSource: null,
      pendingScrollTarget: null,

      // Actions
      setAnnotationSource: (source) => set({ annotationSource: source }),
      setPendingScrollTarget: (target) => set({ pendingScrollTarget: target }),

      podcastSortOrder: 'recentlyAdded',
      setPodcastSortOrder: (order) => set({ podcastSortOrder: order }),
      podcastSearchQuery: '',
      setPodcastSearchQuery: (query) => set({ podcastSearchQuery: query }),

      setIsAutoScrollEnabled: (enabled) => set({ isAutoScrollEnabled: enabled }),

      updateCurrentSnapshot: (updates) => set((state) => {
        const newHistory = [...state.history];
        newHistory[state.historyIndex] = { ...newHistory[state.historyIndex], ...updates };
        return { history: newHistory };
      }),

      setRestoredScrollPosition: (pos) => set({ restoredScrollPosition: pos }),
      setRestoredVisibleCount: (count) => set({ restoredVisibleCount: count }),

      setNotesViewMode: (mode) => set({ notesViewMode: mode }),
      setNotesSelectedPodcastId: (id) => set({ notesSelectedPodcastId: id }),

      navigateToView: (view, context: { podcastId?: number | null, episodeId?: number | null, replace?: boolean, notesViewMode?: 'masonry' | 'podcasts', notesSelectedPodcastId?: number | null } = {}) => set((state) => {
        // 1. Transient View: Annotation
        // If navigating TO annotation, just switch state. Do NOT touch history.
        if (view === 'annotation') {
          return { currentState: 'annotation' };
        }

        const newSnapshot: HistorySnapshot = {
          view,
          podcast: context.podcastId !== undefined
            ? (state.podcasts.find(p => p.id === context.podcastId) || null)
            : state.currentPodcast,
          episode: context.episodeId !== undefined
            ? (state.episodes.find(e => e.id === context.episodeId) ||
              (state.playingEpisode?.id === context.episodeId ? state.playingEpisode : null) ||
              (state.viewingEpisode?.id === context.episodeId ? state.viewingEpisode : null)
            )
            : state.viewingEpisode, // Default to current viewing episode

          // Capture current Notes state if we are navigating FROM notes (or just snapshotting generically?)
          // Actually, we should snapshot the DESTINATION state if we are pushing?
          // No, the snapshot represents the state related to that history entry.
          // If we are navigating TO 'notes', we use context or defaults.
          notesViewMode: view === 'notes' ? (context.notesViewMode || 'masonry') : undefined,
          notesSelectedPodcastId: view === 'notes' ? (context.notesSelectedPodcastId || null) : undefined
        };

        let newHistory = [...state.history];
        // If replace is true, overwrite current entry
        if (context.replace) {
          newHistory[state.historyIndex] = newSnapshot;
          return {
            currentState: view,
            history: newHistory,
            currentPodcast: newSnapshot.podcast,
            viewingEpisode: newSnapshot.episode,
            notesViewMode: newSnapshot.notesViewMode || 'masonry',
            notesSelectedPodcastId: newSnapshot.notesSelectedPodcastId || null
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
          notesViewMode: newSnapshot.notesViewMode || 'masonry',
          notesSelectedPodcastId: newSnapshot.notesSelectedPodcastId || null
        };
      }),

      navigateBack: () => set((state) => {
        // 1. Transient View: Annotation
        // If currently in annotation, just "close" it by restoring the current snapshot view.
        if (state.currentState === 'annotation') {
          const currentSnapshot = state.history[state.historyIndex];
          return {
            currentState: currentSnapshot.view
          };
        }

        // 2. Standard Back with Onboarding Bypass
        if (state.historyIndex > 0) {
          let newIndex = state.historyIndex - 1;
          let snapshot = state.history[newIndex];

          // Bypass Onboarding: If target is onboarding, try to go back one more
          if (snapshot.view === 'onboarding' && newIndex > 0) {
            newIndex--;
            snapshot = state.history[newIndex];
          }
          // If we are stuck at onboarding (newIndex === 0) AND it is onboarding,
          // and we don't want to be there?
          // Well, if the app started there, we can't really go back further.
          // But typically, we replace onboarding history when entering browsing.
          // So this check is just a safety net.

          return {
            historyIndex: newIndex,
            currentState: snapshot.view,
            currentPodcast: snapshot.podcast,
            viewingEpisode: snapshot.episode,
            // playingEpisode remains untouched!
            restoredScrollPosition: snapshot.scrollPosition || 0,
            restoredVisibleCount: snapshot.visibleCount || 20,
            notesViewMode: snapshot.notesViewMode || 'masonry',
            notesSelectedPodcastId: snapshot.notesSelectedPodcastId || null
          };
        }
        return {};
      }),

      navigateForward: () => set((state) => {
        // If we are in annotation view, 'Forward' shouldn't fundamentally allow leaving it 
        // to go to the "next" history state unless we treat annotation as part of the previous state.
        // Actually, if we are in annotation, we are "on top" of the current history index.
        // So forward logic should probably just behave normally (and thus exit annotation)?
        // Or should it be disabled?
        // Let's assume standard behavior: move index forward + restore state.

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
            notesViewMode: snapshot.notesViewMode || 'masonry',
            notesSelectedPodcastId: snapshot.notesSelectedPodcastId || null
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
      setTranscriptToast: (toast) => set({ transcriptToast: toast }),
    }),
    {
      name: 'podsnip-storage',
      // Explicitly select what to persist
      partialize: (state) => ({
        playingEpisode: state.playingEpisode,
        currentTime: state.currentTime,
        playbackSpeed: state.playbackSpeed,
        history: state.history,
        historyIndex: state.historyIndex,
        // Also helpful to persist the current view/context if we want to restore *exactly*
        currentState: state.currentState,
        viewingEpisode: state.viewingEpisode,
        currentPodcast: state.currentPodcast,
        podcastSortOrder: state.podcastSortOrder, // Persist sort order
      }),
      // We do NOT persist isPlaying, so it defaults to false (paused)
    }
  )
);
