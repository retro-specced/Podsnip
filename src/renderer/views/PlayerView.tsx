import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Transcript } from '../../shared/types';
import { Play, Pause, RotateCcw, RotateCw, PenTool, ArrowDown, Check, Sparkles } from 'lucide-react';
import '../styles/PlayerView.css';

function PlayerView() {
  const {
    viewingEpisode, // The episode we are LOOKING at
    playingEpisode, // The episode we are LISTENING to
    transcripts,
    currentTime,
    isPlaying,
    playbackSpeed,
    setTranscripts,
    setSelectedSegments,
    toggleSegmentSelection,
    clearSelectedSegments,
    selectedSegments,
    setCurrentState,
    setError,
    showSaveToast,
    setShowSaveToast,
    isTranscribing,
    transcriptionProgress,
    transcriptionStage,
    setIsTranscribing,
    setTranscriptionProgress,
    setTranscriptionStage,
    setPlayingEpisode, // To switch audio
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    setTranscribingEpisode,
    transcribingEpisode, // Added to check for active transcription
    navigateToView // Added for navigation
  } = useAppStore();

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const scrollableContainerRef = useRef<HTMLDivElement>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  // const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false); // Replaced by global state
  const isProgrammaticScrollRef = useRef(false);
  const lastClickedIndexRef = useRef<number | null>(null);

  // Helper functions
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isSegmentSelected = (segmentId: number) => {
    return selectedSegments.some(s => s.id === segmentId);
  };

  const handleTakeNote = () => {
    if (selectedSegments.length === 0) return;
    navigateToView('annotation');
  };

  const handleSegmentClick = (segment: Transcript, index: number, event: React.MouseEvent) => {
    setIsAutoScrollEnabled(false);
    if (event.shiftKey && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const rangeSegments = transcripts.slice(start, end + 1);
      setSelectedSegments(rangeSegments);
    } else {
      toggleSegmentSelection(segment);
      lastClickedIndexRef.current = index;
    }
  };

  const handleResumeAutoScroll = () => {
    setIsAutoScrollEnabled(true);
    isProgrammaticScrollRef.current = true;
    const activeElement = document.querySelector('.transcript-segment.active');
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 500);
  };

  // Effects
  // 1. Load Transcript
  useEffect(() => {
    if (viewingEpisode) {
      loadTranscript();
    }
  }, [viewingEpisode, isTranscribing]);

  const isCurrentEpisodePlaying = viewingEpisode?.id === playingEpisode?.id;

  // 2. Identify active segment (ONLY if playing this episode)
  useEffect(() => {
    if (!isCurrentEpisodePlaying) return;

    const activeIndex = transcripts.findIndex(
      (segment) => currentTime >= segment.start_time && currentTime <= segment.end_time
    );
    if (activeIndex !== -1) {
      setActiveSegmentIndex(activeIndex);
    }
  }, [currentTime, transcripts, isCurrentEpisodePlaying]);

  // 3. Auto-scroll (ONLY if playing this episode)
  useEffect(() => {
    if (!isAutoScrollEnabled || !isCurrentEpisodePlaying) return;
    const activeElement = document.querySelector('.transcript-segment.active');
    if (activeElement && scrollableContainerRef.current) {
      isProgrammaticScrollRef.current = true;
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => isProgrammaticScrollRef.current = false, 500);
    }
  }, [activeSegmentIndex, isAutoScrollEnabled, isCurrentEpisodePlaying]);

  // 4. Handle user scroll to pause auto-scroll
  useEffect(() => {
    const container = scrollableContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      if (isAutoScrollEnabled) setIsAutoScrollEnabled(false);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isAutoScrollEnabled]);

  // 5. Auto-dismiss toast
  useEffect(() => {
    if (showSaveToast) {
      const timer = setTimeout(() => setShowSaveToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSaveToast]);

  // 6. Initial Scroll on Mount (scrolling to active segment even if auto-scroll is paused)
  useEffect(() => {
    if (!isCurrentEpisodePlaying) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const activeElement = document.querySelector('.transcript-segment.active');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isCurrentEpisodePlaying]);

  // Refactor PlayerView to rely on global state
  // We remove audioRef, local playback effects, and duplicate logic.
  // We keep transcription listeners? No, global controller handles progress updates.
  // But we might want to listen for specific things if needed.
  // Actually, GlobalAudioController handles 'onProgress' updates to store.
  // So PlayerView just reads from store.

  // We can remove the auto-save interval as GlobalAudioController handles it.

  // We keep scroll handling for transcript sync.

  // We keep user interactions (click segment, take note).

  const loadTranscript = async () => {
    if (!viewingEpisode) return;
    try {
      const existingTranscript = await window.api.transcription.get(viewingEpisode.id);
      setTranscripts(existingTranscript || []); // Default to empty array
    } catch (error) {
      console.error('Failed to load transcript:', error);
      setTranscripts([]);
    }
  };

  const startTranscription = async () => {
    // Delegate to global action or duplicated here? 
    // Ideally we trigger the same flow.
    // Since logic is simple, we can keep it here or use the one in PersistentPlayerBar.
    // Let's call the API and update store.
    if (!viewingEpisode) return;
    setTranscribingEpisode(viewingEpisode); // Set global transcription target
    setIsTranscribing(true);
    setTranscriptionProgress(0);
    setTranscriptionStage('Starting...');
    setError(null);

    try {
      await window.api.transcription.create(viewingEpisode.id, viewingEpisode.audio_url);
      const newT = await window.api.transcription.get(viewingEpisode.id);
      setTranscripts(newT || []); // Default to empty array
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsTranscribing(false);
      setTranscribingEpisode(null);
    }
  };

  // Render
  if (!viewingEpisode) {
    return (
      <div className="player-view">
        <div className="empty-state">No episode selected</div>
      </div>
    );
  }

  // Handlers for local controls (proxying to global/store)
  const handlePlayPause = () => {
    const { setIsPlaying, isPlaying } = useAppStore.getState();
    setIsPlaying(!isPlaying);
  };

  const handleSwitchEpisode = () => {
    // User wants to play THIS viewing episode
    setPlayingEpisode(viewingEpisode);
    useAppStore.getState().setIsPlaying(true);
  };

  const handleSkip = (seconds: number) => {
    const { currentTime, setJumpToTime } = useAppStore.getState();
    const newTime = Math.max(0, Math.min(Number(viewingEpisode.duration) || 0, currentTime + seconds));
    setJumpToTime(newTime);
    // Optimistic update? GlobalAudioController handles it.
  };

  const handleSeek = (time: number) => {
    useAppStore.getState().setJumpToTime(time);
  };

  const handleSpeedChange = (speed: number) => {
    useAppStore.getState().setPlaybackSpeed(speed);
  };


  return (
    <div className="player-view">
      <div className="player-left">
        <div className="player-container">
          {viewingEpisode && viewingEpisode.artwork_url && (
            <img
              src={viewingEpisode.artwork_url}
              alt="Episode artwork"
              className="player-artwork"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}

          <h2 className="player-episode-title">{viewingEpisode.title}</h2>

          {/* Controls Restored */}

          <div className="playback-controls">
            {!isCurrentEpisodePlaying ? (
              <button className="control-button-large play-button" onClick={handleSwitchEpisode}>
                <Play size={20} fill="currentColor" /> Play This Episode
              </button>
            ) : (
              <>
                <button className="control-button" onClick={() => handleSkip(-15)}>
                  <RotateCcw size={24} />
                </button>
                <button className="control-button-large" onClick={handlePlayPause}>
                  {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" />}
                </button>
                <button className="control-button" onClick={() => handleSkip(15)}>
                  <RotateCw size={24} />
                </button>
              </>
            )}
          </div>

          <div className="playback-progress">
            <span className="time-label">{formatTime(isCurrentEpisodePlaying ? currentTime : (viewingEpisode.current_position || 0))}</span>
            <input
              type="range"
              min="0"
              max={viewingEpisode.duration || 100}
              value={isCurrentEpisodePlaying ? currentTime : (viewingEpisode.current_position || 0)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="progress-slider"
              disabled={!isCurrentEpisodePlaying}
              style={{ opacity: isCurrentEpisodePlaying ? 1 : 0.6, cursor: isCurrentEpisodePlaying ? 'pointer' : 'not-allowed' }}
            />
            <span className="time-label">{formatTime(viewingEpisode.duration)}</span>
          </div>

          <div className="playback-speed">
            <label>Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="speed-select"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="1.75">1.75x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
      </div>

      <div className="player-right" ref={transcriptContainerRef}>
        {isCurrentEpisodePlaying && !isAutoScrollEnabled && (
          <button className="resume-scroll-button" onClick={handleResumeAutoScroll}>
            <span><ArrowDown size={14} /></span> Enable Auto-Scroll
          </button>
        )}

        <div className="transcript-container" ref={scrollableContainerRef}>
          {isTranscribing && transcribingEpisode?.id === viewingEpisode.id ? (
            <div className="transcript-loading">
              <div className="spinner"></div>
              <p>Generating transcript...</p>
              <div className="transcription-progress">
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${transcriptionProgress}%` }}></div>
                </div>
                <span>{transcriptionProgress}% - {transcriptionStage}</span>
              </div>
            </div>
          ) : transcripts.length > 0 ? (
            <>
              <div className="transcript-segments">
                {transcripts.map((segment, index) => {
                  const isActive = isCurrentEpisodePlaying && currentTime >= segment.start_time && currentTime <= segment.end_time;
                  // We need to maintain activeSegmentIndex state derived from currentTime or store?
                  // Calculated on render is fine.
                  return (
                    <div
                      key={segment.id}
                      className={`transcript-segment ${isActive ? 'active' : ''} ${isSegmentSelected(segment.id) ? 'selected' : ''}`}
                      onClick={(e) => handleSegmentClick(segment, index, e)}
                    >
                      <span className="segment-time">{formatTime(segment.start_time)}</span>
                      <span className="segment-text">{segment.text}</span>
                    </div>
                  );
                })}
              </div>
              {/* Selection Toolbar */}
              {selectedSegments.length > 0 && (
                <div className="selection-toolbar">
                  <span className="selection-count">{selectedSegments.length} selected</span>
                  <button className="clear-selection-button" onClick={clearSelectedSegments}>Clear</button>
                  <button className="take-note-button" onClick={handleTakeNote}><PenTool size={14} /> Take Note</button>
                </div>
              )}
            </>
          ) : (
            <div className="transcript-empty">
              <p>No transcript available.</p>
              <button className="generate-transcript-button" onClick={startTranscription}>Generate Transcript</button>
            </div>
          )}
        </div>
      </div>
      {showSaveToast && (
        <div className="save-toast">
          <div className="save-toast-icon"><Check size={18} /></div>
          <div className="save-toast-text">Note saved!</div>
        </div>
      )}
    </div>
  );
}

export default PlayerView;
