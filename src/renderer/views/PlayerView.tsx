import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  // const [activeSegmentIndex, setActiveSegmentIndex] = useState(0); // REMOVED: Derived state used instead
  // const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false); // Replaced by global state
  const isProgrammaticScrollRef = useRef(false);
  const lastClickedIndexRef = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const allowInstantScrollRef = useRef(true);
  const [isTranscriptReady, setIsTranscriptReady] = useState(false);
  const [isRendering, setIsRendering] = useState(true);

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
    // Effect 3 will handle the actual scrolling and programmatic lock
  };

  // Effects
  // Local state for smooth scrubbing
  const [isDragging, setIsDragging] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false); // Debounce 'jump'
  const [dragValue, setDragValue] = useState(0);

  // Sync dragValue with effective time when not dragging
  useEffect(() => {
    if (!isDragging && !isSeeking && viewingEpisode) {
      const isPlayingCurrent = viewingEpisode.id === playingEpisode?.id;
      const effectiveTime = isPlayingCurrent ? currentTime : (viewingEpisode.current_position || 0);
      setDragValue(effectiveTime);
    }
  }, [currentTime, isDragging, isSeeking, playingEpisode?.id, viewingEpisode]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDragging(true);
    setDragValue(Number(e.target.value));
  };

  const handleSeekCommit = () => {
    setIsDragging(false);
    setIsSeeking(true);
    handleSeek(dragValue);

    // Optimistic: Hold the value for a bit to allow audio engine to catch up
    setTimeout(() => setIsSeeking(false), 250);
  };

  // 1. Load Transcript
  useEffect(() => {
    if (viewingEpisode) {
      loadTranscript();
    }
  }, [viewingEpisode, isTranscribing]);

  const isCurrentEpisodePlaying = viewingEpisode?.id === playingEpisode?.id;

  // 2. Derive active segment index directly (no effect delay)
  // This ensures the render pass knows EXACTLY which segment is active before paint.
  const activeSegmentIndex = isCurrentEpisodePlaying
    ? transcripts.findIndex(
      (segment) => currentTime >= segment.start_time && currentTime <= segment.end_time
    )
    : -1;

  // 3. Auto-scroll (ONLY if playing this episode)
  // useLayoutEffect ensures scrolling happens BEFORE the browser paints the screen.
  // This eliminates the visual "jump" from top to current position.
  useLayoutEffect(() => {
    if (!isAutoScrollEnabled || !isCurrentEpisodePlaying) return;

    // We target the active segment directly. 
    // Since activeSegmentIndex is derived above, the DOM will have the 'active' class 
    // in the same commit phase as this effect runs.
    const activeElement = document.querySelector('.transcript-segment.active');

    if (activeElement && scrollableContainerRef.current) {
      isProgrammaticScrollRef.current = true;

      // Use 'auto' (instant) if it's the first scroll, otherwise 'smooth'
      const behavior = allowInstantScrollRef.current ? 'auto' : 'smooth';
      activeElement.scrollIntoView({ behavior, block: 'center' });

      // Consume the instant scroll token logic
      if (allowInstantScrollRef.current) {
        allowInstantScrollRef.current = false;
      }

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 1000);

      // Reveal the transcript after the first scroll command
      requestAnimationFrame(() => {
        setIsTranscriptReady(true);
      });
    } else if (activeSegmentIndex === -1 && transcripts.length > 0) {
      // If we have transcripts but no active segment (e.g. paused at start), show it anyway
      setIsTranscriptReady(true);
    }
  }, [activeSegmentIndex, isAutoScrollEnabled, isCurrentEpisodePlaying]); // activeSegmentIndex is now a dependency to trigger scroll when it changes

  // Reset allowInstantScrollRef when viewingEpisode changes
  // This ensures that if we switch episodes, we get a fresh "instant scroll" to the new position
  useEffect(() => {
    allowInstantScrollRef.current = true;
    setIsTranscriptReady(false);
    setIsRendering(true);

    // Force 1.5s rendering state
    const timer = setTimeout(() => {
      setIsRendering(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [viewingEpisode?.id]);

  // 4. Handle user scroll to pause auto-scroll
  useEffect(() => {
    const container = scrollableContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;
      if (isAutoScrollEnabled) setIsAutoScrollEnabled(false);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [isAutoScrollEnabled]);

  // Ensure transcript is revealed if we are not auto-scrolling (e.g. user manually navigated here without auto-scroll, though usually we enable it)
  // Or if we are just "viewing" and paused? 
  // Actually, if auto-scroll is disabled, we might still want to see the transcript.
  // But strictly for the "Jump" case, we handle it in Effect 7.
  // For the case where user just switches to an episode and it's PAUSED:
  // Active segment index might be -1 or valid.
  // If valid, Effect 3 runs (if auto-scroll enabled).
  // If auto-scroll is disabled by default? (Store initializes to true).
  // If user disabled it?
  // We should fallback to revealing it after a safety timeout if it hasn't been revealed?
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTranscriptReady(true);
    }, 500); // Failsafe reveal
    return () => clearTimeout(timer);
  }, [viewingEpisode?.id]);

  // 5. Auto-dismiss toast
  useEffect(() => {
    if (showSaveToast) {
      const timer = setTimeout(() => setShowSaveToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSaveToast]);

  // 7. Handle Pending Scroll Target (Jump navigation)
  useEffect(() => {
    // If we have a pending target and transcripts are loaded
    const { pendingScrollTarget, setPendingScrollTarget } = useAppStore.getState();

    if (pendingScrollTarget !== null && transcripts.length > 0) {
      // Find the segment for the target time
      const targetSegment = transcripts.find(t =>
        pendingScrollTarget >= t.start_time && pendingScrollTarget <= t.end_time
      );

      if (targetSegment) {
        // Disable auto-scroll so we stick to this location
        setIsAutoScrollEnabled(false);

        // Use instant scroll behavior
        // We'll use a small timeout to let the list render if needed, or LayoutEffect handles it?
        // Let's force it manually here since it's a specific action.
        setTimeout(() => {
          const element = document.querySelectorAll('.transcript-segment')[transcripts.indexOf(targetSegment)];
          if (element) {
            element.scrollIntoView({ behavior: 'auto', block: 'center' });
            // Reveal after jump
            requestAnimationFrame(() => setIsTranscriptReady(true));
          }
        }, 50);

        // Clear the pending target so we don't jump again
        setPendingScrollTarget(null);
      }
    }
  }, [transcripts]); // Run when transcripts load/change

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
            <span className="time-label">{formatTime(isDragging || isSeeking ? dragValue : (isCurrentEpisodePlaying ? currentTime : (viewingEpisode.current_position || 0)))}</span>
            <input
              type="range"
              min="0"
              max={viewingEpisode.duration || 100}
              value={isDragging || isSeeking ? dragValue : (isCurrentEpisodePlaying ? currentTime : (viewingEpisode.current_position || 0))}
              onChange={handleSeekChange}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  handleSkip(-15);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  handleSkip(15);
                }
              }}
              className="progress-slider"
              disabled={!isCurrentEpisodePlaying}
              style={{
                opacity: isCurrentEpisodePlaying ? 1 : 0.6,
                cursor: isCurrentEpisodePlaying ? 'pointer' : 'not-allowed',
                '--progress': `${((isDragging || isSeeking ? dragValue : (isCurrentEpisodePlaying ? currentTime : (viewingEpisode.current_position || 0))) / (viewingEpisode.duration || 1)) * 100}%`
              } as React.CSSProperties}
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

        {/* Rendering Overlay */}
        <div className={`rendering-overlay ${!isRendering ? 'hidden' : ''}`}>
          <div className="transcript-skeleton-list">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="transcript-skeleton">
                <div className="skeleton-time"></div>
                <div className="skeleton-text-group">
                  <div className="skeleton-line" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
                  <div className="skeleton-line" style={{ width: `${Math.random() * 30 + 50}%` }}></div>
                  {i % 3 === 0 && <div className="skeleton-line" style={{ width: `${Math.random() * 20 + 40}%` }}></div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="transcript-container"
          ref={scrollableContainerRef}
        >
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
              <div
                className="transcript-segments"
                style={{ opacity: (isTranscriptReady && !isRendering) ? 1 : 0, transition: 'opacity 0.2s ease-in' }}
              >
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
              <div className="transcript-empty-content">
                <h3>Transcript not available.</h3>
                <p>A transcript is required to start taking notes.</p>
                <button className="generate-transcript-button" onClick={startTranscription}>
                  <Sparkles size={16} /> Generate Transcript
                </button>
              </div>
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
