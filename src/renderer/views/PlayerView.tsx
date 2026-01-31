import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { Transcript } from '../../shared/types';
import '../styles/PlayerView.css';

// Module-level to persist across remounts
let lastKnownEpisodeId: number | null = null;
let lastKnownTime: number = 0;

function PlayerView() {
  const {
    currentEpisode,
    transcripts,
    isPlaying,
    currentTime,
    playbackSpeed,
    jumpToTime,
    setTranscripts,
    setIsPlaying,
    setCurrentTime,
    setPlaybackSpeed,
    setJumpToTime,
    selectedSegments,
    toggleSegmentSelection,
    clearSelectedSegments,
    setSelectedSegments,
    setCurrentState,
    setCurrentEpisode,
    setError,
    showSaveToast,
    setShowSaveToast,
  } = useAppStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const scrollableContainerRef = useRef<HTMLDivElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionStage, setTranscriptionStage] = useState('');
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isLoadingJump, setIsLoadingJump] = useState(false);
  const [isLoadingEpisode, setIsLoadingEpisode] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const hasJumpedRef = useRef(false);
  const lastClickedIndexRef = useRef<number | null>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    if (currentEpisode) {
      const isNewEpisode = lastKnownEpisodeId !== currentEpisode.id;
      const isReturningFromAnnotation = !isNewEpisode && lastKnownTime > 0;

      // Update module-level tracking
      lastKnownEpisodeId = currentEpisode.id;

      if (isReturningFromAnnotation) {
        // Coming back from annotation view - restore audio position
        loadTranscript();
        if (audioRef.current) {
          audioRef.current.currentTime = lastKnownTime;
        }
        return;
      }

      // New episode - full setup
      setAudioError(null);
      setIsLoadingEpisode(true);
      loadTranscript();

      // Only reset currentTime if we're not in the middle of a jump from notes
      if (pendingSeekTimeRef.current === null) {
        setCurrentTime(0);
        setIsPlaying(false);
        lastKnownTime = 0;
      }

      loadPlaybackState();
      hasJumpedRef.current = false;

      // Load the new audio
      if (audioRef.current) {
        audioRef.current.load();
      }
    }
  }, [currentEpisode]);

  // Save playback state periodically
  useEffect(() => {
    if (!currentEpisode) return;

    const interval = setInterval(() => {
      if (currentTime > 0) {
        window.api.playback.save(currentEpisode.id, currentTime, playbackSpeed);
      }
    }, 5000); // Save every 5 seconds

    return () => clearInterval(interval);
  }, [currentEpisode, currentTime, playbackSpeed]);

  // Auto-dismiss save toast
  useEffect(() => {
    if (showSaveToast) {
      const timer = setTimeout(() => {
        setShowSaveToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSaveToast]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Handle seeking when jumpToTime is set (e.g., from jump to podcast)
  useEffect(() => {
    if (!hasJumpedRef.current && jumpToTime !== null && jumpToTime > 0) {
      // Store the pending seek time
      pendingSeekTimeRef.current = jumpToTime;
      setIsLoadingJump(true);
      hasJumpedRef.current = true; // Mark that we've initiated a jump
      // Clear the jumpToTime after we've processed it
      setJumpToTime(null);
    }
  }, [jumpToTime]);

  // Listen for transcription progress updates
  useEffect(() => {
    window.api.transcription.onProgress((data) => {
      if (currentEpisode && data.episodeId === currentEpisode.id) {
        setTranscriptionProgress(data.progress);
        setTranscriptionStage(data.stage);
      }
    });

    return () => {
      window.api.transcription.removeProgressListener();
    };
  }, [currentEpisode]);

  // Handle user scroll - pause auto-scroll until user clicks resume
  useEffect(() => {
    const container = scrollableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Ignore programmatic scrolls (from auto-scroll)
      if (isProgrammaticScrollRef.current) return;

      // Pause auto-scroll when user manually scrolls
      if (!isAutoScrollPaused) {
        setIsAutoScrollPaused(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isAutoScrollPaused]);

  // Resume auto-scroll handler
  const handleResumeAutoScroll = () => {
    setIsAutoScrollPaused(false);
    // Immediately scroll to active segment (mark as programmatic)
    isProgrammaticScrollRef.current = true;
    const activeElement = document.querySelector('.transcript-segment.active');
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Reset flag after scroll animation completes
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 500);
  };

  useEffect(() => {
    // Auto-scroll to active segment (only if not paused)
    if (isAutoScrollPaused) return;

    const activeElement = document.querySelector('.transcript-segment.active');
    if (activeElement && scrollableContainerRef.current) {
      // Mark as programmatic scroll to avoid triggering pause
      isProgrammaticScrollRef.current = true;
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Reset flag after scroll animation completes
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
    }
  }, [activeSegmentIndex, isAutoScrollPaused]);

  const loadTranscript = async () => {
    if (!currentEpisode) return;

    try {
      const existingTranscript = await window.api.transcription.get(currentEpisode.id);

      // Always set transcripts (even if empty) to clear old transcripts when switching episodes
      setTranscripts(existingTranscript);
    } catch (error) {
      console.error('Failed to load transcript:', error);
      // Clear transcripts on error
      setTranscripts([]);
    }
  };

  const startTranscription = async () => {
    if (!currentEpisode) return;

    setIsTranscribing(true);
    setTranscriptionProgress(0);
    setTranscriptionStage('Starting transcription');
    setError(null);

    try {
      await window.api.transcription.create(currentEpisode.id, currentEpisode.audio_url);

      // Reload transcript after creation
      const newTranscript = await window.api.transcription.get(currentEpisode.id);
      setTranscripts(newTranscript);

      // Refresh episode to get updated local_path for playback sync
      const updatedEpisode = await window.api.episode.get(currentEpisode.id);
      if (updatedEpisode) {
        setCurrentEpisode(updatedEpisode);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to transcribe episode');
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(0);
      setTranscriptionStage('');
    }
  };

  const loadPlaybackState = async () => {
    if (!currentEpisode || !audioRef.current) return;

    // Don't load saved playback state if currentTime is already set (e.g., from jump to podcast)
    if (currentTime > 0) {
      return;
    }

    try {
      const state = await window.api.playback.get(currentEpisode.id);
      if (state) {
        audioRef.current.currentTime = state.current_position;
        setPlaybackSpeed(state.playback_speed);
      }
    } catch (error) {
      console.error('Failed to load playback state:', error);
    }
  };

  const savePlaybackState = async () => {
    if (!currentEpisode || !audioRef.current) return;

    try {
      await window.api.playback.save(
        currentEpisode.id,
        audioRef.current.currentTime,
        playbackSpeed
      );
    } catch (error) {
      console.error('Failed to save playback state:', error);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;

    const time = audioRef.current.currentTime;
    setCurrentTime(time);
    lastKnownTime = time; // Track for remounts

    // Find active transcript segment
    const activeIndex = transcripts.findIndex(
      (segment) => time >= segment.start_time && time <= segment.end_time
    );
    if (activeIndex !== -1) {
      setActiveSegmentIndex(activeIndex);
    }

    // Periodically save playback state
    if (Math.floor(time) % 5 === 0) {
      savePlaybackState();
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime += seconds;
  };

  const handleSegmentClick = (segment: Transcript, index: number, event: React.MouseEvent) => {
    // Pause auto-scroll when user clicks on a segment
    setIsAutoScrollPaused(true);

    // Shift+click for range selection
    if (event.shiftKey && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const rangeSegments = transcripts.slice(start, end + 1);
      setSelectedSegments(rangeSegments);
    } else {
      // Regular click toggles selection
      toggleSegmentSelection(segment);
      lastClickedIndexRef.current = index;
    }
  };

  const handleTakeNote = () => {
    if (selectedSegments.length === 0) return;

    // Pause audio and go to annotation view
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      // Jump to start of first selected segment
      audioRef.current.currentTime = selectedSegments[0].start_time;
    }
    setCurrentState('annotation');
  };

  const isSegmentSelected = (segmentId: number) => {
    return selectedSegments.some(s => s.id === segmentId);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentEpisode) {
    return (
      <div className="player-view">
        <div className="empty-state">No episode selected</div>
      </div>
    );
  }

  return (
    <div className="player-view">
      {(isLoadingJump || isLoadingEpisode) && (
        <div className="jump-loading-overlay">
          <div className="jump-loading-content">
            <div className="spinner"></div>
            <p>Loading podcast...</p>
          </div>
        </div>
      )}
      <div className="player-left">
        <div className="player-container">
          {currentEpisode && currentEpisode.artwork_url && (
            <img
              src={currentEpisode.artwork_url}
              alt="Episode artwork"
              className="player-artwork"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}

          <h2 className="player-episode-title">{currentEpisode.title}</h2>

          <audio
            ref={audioRef}
            src={currentEpisode.local_path || currentEpisode.audio_url}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              setIsPlaying(false);
              savePlaybackState();
            }}
            onError={(e) => {
              console.error('Audio error:', e);
              setAudioError('Failed to load audio. The episode may not be available or there may be a network issue.');
              setIsPlaying(false);
            }}
            onLoadedMetadata={() => {
              console.log('Audio loaded successfully');
              setAudioError(null);
              setIsLoadingEpisode(false); // Hide loading screen when metadata is loaded

              // If there's a pending seek (from jump to podcast), perform it now
              if (pendingSeekTimeRef.current !== null && audioRef.current) {
                audioRef.current.currentTime = pendingSeekTimeRef.current;
                pendingSeekTimeRef.current = null;

                // Auto-play after seeking
                audioRef.current.play().then(() => {
                  setIsPlaying(true);
                  setIsLoadingJump(false);
                }).catch((error) => {
                  console.error('Failed to auto-play:', error);
                  setIsLoadingJump(false);
                });
              }
            }}
            onCanPlay={() => {
              setIsBuffering(false); // Audio is ready to play
            }}
            onWaiting={() => {
              setIsBuffering(true); // Audio is buffering
            }}
            onPlaying={() => {
              setIsBuffering(false); // Audio started playing
            }}
            crossOrigin="anonymous"
          />

          {audioError && (
            <div className="audio-error">
              ⚠️ {audioError}
            </div>
          )}

          <div className="playback-controls">
            <button className="control-button" onClick={() => handleSkip(-15)}>
              ⏮ 15s
            </button>
            <button className="control-button-large" onClick={handlePlayPause} disabled={isBuffering}>
              {isBuffering ? (
                <div className="spinner-small"></div>
              ) : isPlaying ? (
                '⏸'
              ) : (
                '▶️'
              )}
            </button>
            <button className="control-button" onClick={() => handleSkip(15)}>
              15s ⏭
            </button>
          </div>

          <div className="playback-progress">
            <span className="time-label">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={currentEpisode.duration || 100}
              value={currentTime}
              onChange={(e) => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Number(e.target.value);
                }
              }}
              className="progress-slider"
            />
            <span className="time-label">{formatTime(currentEpisode.duration)}</span>
          </div>

          <div className="playback-speed">
            <label>Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
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
        <div className="transcript-header">
          <h3>Transcript</h3>
          {isTranscribing && <span className="transcribing-badge">Transcribing...</span>}
        </div>

        <div className="transcript-container" ref={scrollableContainerRef}>
          {isTranscribing ? (
            <div className="transcript-loading">
              <div className="spinner"></div>
              <p>Generating transcript...</p>
              <div className="transcription-progress">
                <div className="progress-bar-container">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${transcriptionProgress}%` }}
                  ></div>
                </div>
                <div className="progress-info">
                  <span className="progress-percentage">{transcriptionProgress}%</span>
                  <span className="progress-stage">{transcriptionStage}</span>
                </div>
              </div>
            </div>
          ) : transcripts.length > 0 ? (
            <>
              <div className="transcript-segments">
                {transcripts.map((segment, index) => (
                  <div
                    key={segment.id}
                    className={`transcript-segment ${index === activeSegmentIndex ? 'active' : ''} ${index < activeSegmentIndex ? 'past' : ''
                      } ${index > activeSegmentIndex ? 'future' : ''} ${isSegmentSelected(segment.id) ? 'selected' : ''}`}
                    onClick={(e) => handleSegmentClick(segment, index, e)}
                  >
                    <span className="segment-time">{formatTime(segment.start_time)}</span>
                    <span className="segment-text">{segment.text}</span>
                  </div>
                ))}
              </div>
              {selectedSegments.length > 0 && (
                <div className="selection-toolbar">
                  <span className="selection-count">{selectedSegments.length} segment{selectedSegments.length > 1 ? 's' : ''} selected</span>
                  <button className="clear-selection-button" onClick={clearSelectedSegments}>
                    Clear
                  </button>
                  <button className="take-note-button" onClick={handleTakeNote}>
                    ✏️ Take Note
                  </button>
                </div>
              )}
              {isAutoScrollPaused && selectedSegments.length === 0 && (
                <button className="resume-scroll-button" onClick={handleResumeAutoScroll}>
                  ↓ Resume Auto-Scroll
                </button>
              )}
            </>
          ) : (
            <div className="transcript-empty">
              <p>No transcript available yet.</p>
              <p className="transcript-note">Click the button below to generate a transcript using local Whisper.</p>
              <button className="generate-transcript-button" onClick={startTranscription}>
                Generate Transcript
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save confirmation toast */}
      {showSaveToast && (
        <div className="save-toast">
          <span className="save-toast-icon">✓</span>
          <span className="save-toast-text">Note saved successfully!</span>
        </div>
      )}
    </div>
  );
}

export default PlayerView;
