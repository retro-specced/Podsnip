import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { Transcript } from '../../shared/types';
import { ArrowDown, PenTool, Sparkles, Check } from 'lucide-react';
import { ScrollableContainer } from '../components/ScrollableContainer';
import '../styles/PlayerView.css';

function PlayerView() {
  const {
    viewingEpisode, // The episode we are LOOKING at
    playingEpisode, // The episode we are LISTENING to
    transcripts,
    currentTime,
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
    isAutoScrollEnabled,
    setIsAutoScrollEnabled,
    setTranscribingEpisode,
    transcribingEpisode, // Added to check for active transcription
    navigateToView, // Added for navigation
    podcasts, // Added to get podcast title
    setAnnotationSource // Added to manage return context
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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

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

    // Capture context so we can return to this exact spot
    setAnnotationSource({
      view: 'player',
      episodeId: viewingEpisode?.id || null,
      previousAutoScrollEnabled: isAutoScrollEnabled,
      captureTime: selectedSegments[0].start_time // Return to the start of selection
    });

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


  const viewingPodcast = podcasts.find(p => p.id === viewingEpisode.podcast_id);

  // Format Date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="player-view">
      {/* LEFT PANEL - Sticky Info & Controls */}
      <div className="player-sidebar">
        <ScrollableContainer className="sidebar-content">
          {/* Artwork */}
          <div className="artwork-container-small">
            {viewingEpisode.artwork_url ? (
              <img
                src={viewingEpisode.artwork_url}
                alt="Episode artwork"
                className="player-artwork-small"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="artwork-placeholder-small" />
            )}
          </div>

          {/* Header Info */}
          <div className="episode-info-scroll">
            <h3 className="podcast-title-small">{viewingPodcast?.title || 'Unknown Podcast'}</h3>
            <h1 className="episode-title">{viewingEpisode.title}</h1>
            <div className="episode-meta">
              <span className="publish-date">{formatDate(viewingEpisode.published_date)}</span>
              <span className="dot-separator">•</span>
              <span className="duration-text">{Math.floor((viewingEpisode.duration || 0) / 60)} min</span>
            </div>

            <div className="divider" />

            {/* Description */}
            {/* Description */}
            <div className={`episode-description-full ${isDescriptionExpanded ? 'expanded' : 'clamped'}`}>
              {viewingEpisode.description.replace(/<[^>]*>?/gm, '')}
            </div>
            <button
              className="read-more-btn"
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            >
              {isDescriptionExpanded ? 'Read Less' : 'Read More'}
            </button>
          </div>
        </ScrollableContainer>
      </div>

      {/* RIGHT PANEL - Transcript */}
      <div className="player-main" ref={transcriptContainerRef}>

        {/* Unified Floating Action Dock */}
        <AnimatePresence>
          {(() => {
            const showResume = isCurrentEpisodePlaying && !isAutoScrollEnabled;
            const showToolbar = selectedSegments.length > 0;
            const mode = showToolbar ? 'toolbar' : (showResume ? 'resume' : null);

            if (!mode) return null;

            return (
              <motion.div
                key="dock"
                className={`floating-action-dock ${mode}`}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.9 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  opacity: { duration: 0.2 }
                }}
                onClick={mode === 'resume' ? handleResumeAutoScroll : undefined}
                style={{ originY: 1 }} // Expand from bottom
              >
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
                  transition={{ duration: 0.2 }}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {mode === 'resume' ? (
                    <div className="dock-content-resume">
                      <ArrowDown size={16} /> <span>Resume Auto-Scroll</span>
                    </div>
                  ) : (
                    <div className="dock-content-toolbar">
                      <span className="selection-count">{selectedSegments.length} selected</span>
                      {/* Stop propagation to avoid triggering container onClick (safety) */}
                      <div
                        className="toolbar-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="toolbar-btn secondary"
                          onClick={clearSelectedSegments}
                        >
                          Clear
                        </button>
                        <button
                          className="toolbar-btn primary"
                          onClick={handleTakeNote}
                        >
                          <PenTool size={14} /> Take Note
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        <div className={`rendering-overlay ${!isRendering ? 'hidden' : ''}`}>
          <div className="transcript-skeleton-list">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="transcript-skeleton">
                <div className="skeleton-time"></div>
                <div className="skeleton-text-group">
                  <div className="skeleton-line" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
                  <div className="skeleton-line" style={{ width: `${Math.random() * 30 + 50}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ScrollableContainer
          className="transcript-container"
          innerRef={scrollableContainerRef}
        >
          {isTranscribing && transcribingEpisode?.id === viewingEpisode.id ? (
            <div className="transcript-loading">
              <div className="loading-spinner-large"></div>
              <h3>Generating Transcript</h3>
              <p className="loading-subtext">This might take a moment...</p>
              <div className="transcription-progress-large">
                <div className="progress-bar-container-large">
                  <div className="progress-bar-fill-large" style={{ width: `${transcriptionProgress}%` }}></div>
                </div>
                <div className="progress-meta">
                  <span className="progress-pct">{transcriptionProgress}%</span>
                  <span className="progress-stage">{transcriptionStage}</span>
                </div>
              </div>
            </div>
          ) : transcripts.length > 0 ? (
            <>
              <div
                className="transcript-segments"
                style={{ opacity: (isTranscriptReady && !isRendering) ? 1 : 0 }}
              >
                {transcripts.map((segment, index) => {
                  const isActive = isCurrentEpisodePlaying && currentTime >= segment.start_time && currentTime <= segment.end_time;
                  return (
                    <div
                      key={segment.id}
                      className={`transcript-segment ${isActive ? 'active' : ''} ${isSegmentSelected(segment.id) ? 'selected' : ''}`}
                      onClick={(e) => handleSegmentClick(segment, index, e)}
                    >
                      <div className="segment-marker"></div>
                      <span className="segment-time">{formatTime(segment.start_time)}</span>
                      <p className="segment-text">{segment.text}</p>
                    </div>
                  );
                })}
              </div>

            </>
          ) : (
            <div className="transcript-empty">
              <div className="empty-content-card">
                <Sparkles size={48} className="empty-icon" />
                <h3>No Transcript Available</h3>
                <p>Generate a transcript to follow along, search, and take notes.</p>
                <button className="generate-transcript-button-large" onClick={startTranscription}>
                  Generate Transcript
                </button>
              </div>
            </div>
          )}
        </ScrollableContainer>


      </div >

      {showSaveToast && (
        <div className="save-toast">
          <div className="save-toast-icon"><Check size={18} /></div>
          <div className="save-toast-text">Note saved to notebook!</div>
        </div>
      )
      }
    </div >
  );
}

export default PlayerView;
