import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/PersistentPlayerBar.css';
import { Play, Pause, RotateCcw, RotateCw, PenTool, Sparkles } from 'lucide-react';

interface PersistentPlayerBarProps {
    visible: boolean;
}

export default function PersistentPlayerBar({ visible }: PersistentPlayerBarProps) {
    const {
        playingEpisode, // Changed from currentEpisode
        viewingEpisode, // Added back for comparison
        currentState, // Added back for comparison


        isPlaying,


        currentTime,
        playbackSpeed,
        setIsPlaying,
        setJumpToTime,
        setPlaybackSpeed,
        // To navigate
    } = useAppStore();

    /* Local state for smooth scrubbing */
    const [isDragging, setIsDragging] = useState(false);
    const [isSeeking, setIsSeeking] = useState(false); // Debounce 'jump'
    const [dragValue, setDragValue] = useState(0);

    // Sync dragValue with currentTime when not dragging
    useEffect(() => {
        if (!isDragging && !isSeeking) {
            setDragValue(currentTime);
        }
    }, [currentTime, isDragging, isSeeking]);

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsDragging(true);
        setDragValue(Number(e.target.value));
    };

    const handleSeekCommit = () => {
        setIsDragging(false);
        setIsSeeking(true);
        setJumpToTime(dragValue);

        // Optimistic: Hold the value for a bit to allow audio engine to catch up
        setTimeout(() => setIsSeeking(false), 250);
    };


    // Transcription
    // transcripts removed as unused (checking API instead)

    const {
        setIsAutoScrollEnabled,

        transcribingEpisode,
        isTranscribing,
        setIsTranscribing,
        setTranscribingEpisode,
        setTranscriptionProgress,
        transcriptionProgress, // Added
        setTranscriptionStage,
        setError,
        navigateToView, // Added for navigation
        podcasts // Added to look up podcast title
    } = useAppStore();

    // Local state to track if we have a transcript for the PLAYING episode
    const [hasTranscript, setHasTranscript] = useState(false);

    // Check for transcript when playingEpisode changes OR when transcription status changes
    useEffect(() => {
        let isMounted = true;
        const checkTranscript = async () => {
            if (!playingEpisode) return;
            try {
                const t = await window.api.transcription.get(playingEpisode.id);
                if (isMounted) setHasTranscript(!!t && t.length > 0);
            } catch (error) {
                console.error("Failed to check transcript:", error);
                if (isMounted) setHasTranscript(false);
            }
        };
        checkTranscript();
        return () => { isMounted = false; };
    }, [playingEpisode, isTranscribing]); // Added isTranscribing to re-check after completion

    if (!playingEpisode) return null;

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handleSkip = (seconds: number) => {
        const newTime = Math.max(0, Math.min(playingEpisode.duration, currentTime + seconds));
        setJumpToTime(newTime);
    };

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleTakeNote = async () => {
        const {
            currentState,
            isAutoScrollEnabled,
            currentTime,
            transcripts: storeTranscripts,
            setAnnotationSource,
            setSelectedSegments,

        } = useAppStore.getState();

        // 1. Capture Source (Do this early)
        setAnnotationSource({
            view: currentState,
            episodeId: playingEpisode.id,
            previousAutoScrollEnabled: isAutoScrollEnabled,
            captureTime: currentTime
        });

        // 2. Resolve Transcripts
        let targetTranscripts = storeTranscripts;
        // If empty or mismatch, fetch them
        if (targetTranscripts.length === 0 || targetTranscripts[0].episode_id !== playingEpisode.id) {
            try {
                const fetched = await window.api.transcription.get(playingEpisode.id);
                if (fetched && fetched.length > 0) {
                    targetTranscripts = fetched;
                    // Optional: Update store so it's cached? 
                    // Be careful not to clobber Viewing Episode if user is looking at something else.
                    // But for Annotation View, we probably want these transcripts to be available?
                    // Yes, AnnotationView relies on `selectedSegments`. It doesn't strictly need `transcripts`.
                    // But `PlayerView` needs `transcripts`.
                    // If we are navigating to AnnotationView, we don't necessarily update `transcripts` global state 
                    // unless we want to "switch context" to this episode.
                    // Let's NOT update global `transcripts` to avoid UI flicker in background views.
                    // We only use them to calculate segments.
                } else {
                    // No transcript found? Should not happen if UI showed the button.
                    navigateToView('player', { episodeId: playingEpisode.id });
                    return;
                }
            } catch (e) {
                console.error("Failed to fetch transcript for note:", e);
                navigateToView('player', { episodeId: playingEpisode.id });
                return;
            }
        }

        // 3. Auto-Select Segments
        const now = currentTime;
        const lookback = 15;
        const candidates = targetTranscripts.filter(t =>
            t.end_time >= (now - lookback) && t.start_time <= now
        );

        if (candidates.length > 0) {
            setSelectedSegments(candidates);
        } else {
            const active = targetTranscripts.find(t => now >= t.start_time && now <= t.end_time);
            if (active) setSelectedSegments([active]);
        }

        // 4. Navigate
        navigateToView('annotation');
    };

    // Transcription Logic

    const isTranscribingThis = isTranscribing && transcribingEpisode?.id === playingEpisode.id;

    const handleTranscribe = async () => {
        setTranscribingEpisode(playingEpisode);
        setIsTranscribing(true);
        setTranscriptionProgress(0);
        setTranscriptionStage('Starting...');
        setError(null);

        try {
            await window.api.transcription.create(playingEpisode.id, playingEpisode.audio_url);
        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setIsTranscribing(false);
            setTranscribingEpisode(null);
        }
        setIsTranscribing(false);
        setTranscribingEpisode(null);
    };

    return (
        <div className={`persistent-player-bar ${visible ? 'visible' : ''}`}>
            {/* 1. Left: Metadata */}
            {/* 1. Left: Metadata */}
            <div
                className="player-bar-left clickable"
                onClick={() => {
                    setIsAutoScrollEnabled(true); // Explicitly enable auto-scroll
                    navigateToView('player', { episodeId: playingEpisode.id });
                }}
                title="Go to Fullscreen Player"
            >
                <img
                    src={playingEpisode.artwork_url || ''}
                    alt="Artwork"
                    className="player-bar-artwork"
                />
                <div className="player-bar-info">
                    <div className="player-bar-title">{playingEpisode.title}</div>
                    <div className="player-bar-podcast">
                        {podcasts.find(p => p.id === playingEpisode.podcast_id)?.title || 'Unknown Podcast'}
                    </div>
                </div>
            </div>

            {/* 2. Center: Controls & Progress */}
            <div className="player-bar-center">
                <div className="player-bar-controls">
                    {/* Speed Selector (Compact) */}
                    <div className="speed-control" title="Playback Speed" onClick={() => {
                        const speeds = [0.5, 1.0, 1.25, 1.5, 2.0];
                        const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                        setPlaybackSpeed(speeds[nextIndex] || 1.0);
                    }}>
                        <span className="speed-label">{playbackSpeed}x</span>
                    </div>

                    <button className="control-btn" onClick={() => handleSkip(-15)}>
                        <RotateCcw size={20} />
                    </button>
                    <button className="control-btn play-btn" onClick={handlePlayPause}>
                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                    </button>
                    <button className="control-btn" onClick={() => handleSkip(15)}>
                        <RotateCw size={20} />
                    </button>
                </div>

                <div className="player-bar-progress">
                    <span className="time-text">{formatTime(isDragging || isSeeking ? dragValue : currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={playingEpisode?.duration || 100}
                        value={isDragging || isSeeking ? dragValue : currentTime}
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
                        className="progress-slider-bar"
                        style={{
                            '--progress': `${((isDragging || isSeeking ? dragValue : currentTime) / (playingEpisode?.duration || 1)) * 100}%`
                        } as React.CSSProperties}
                    />
                    <span className="time-text">{formatTime(playingEpisode.duration)}</span>
                </div>
            </div>

            {/* 3. Right: Actions */}
            <div className="player-bar-right">
                <div className="dynamic-actions">
                    {hasTranscript ? (
                        // Hide if we are essentially in the "Full Player View" of this episode
                        // Because PlayerView already exposes annotation/creation tools locally if designed,
                        // or at least avoids redundancy if the user is focused on the content.
                        (currentState === 'player' && viewingEpisode?.id === playingEpisode.id) ? null : (
                            <button className="action-btn note-btn" onClick={handleTakeNote}>
                                <PenTool size={14} /> Take Note
                            </button>
                        )
                    ) : isTranscribingThis ? (
                        <div className="action-status">
                            <div className="spinner-tiny"></div>
                            <span>{transcriptionProgress}%</span>
                        </div>
                    ) : (
                        <button className="action-btn transcribe-btn" onClick={handleTranscribe}>
                            <Sparkles size={14} /> Transcribe
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
