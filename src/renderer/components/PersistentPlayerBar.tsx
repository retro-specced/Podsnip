import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/PersistentPlayerBar.css';

export default function PersistentPlayerBar() {
    const {
        playingEpisode, // Changed from currentEpisode
        // currentPodcast removed as unused

        isPlaying,
        currentTime,
        playbackSpeed,
        setIsPlaying,
        setJumpToTime,
        setPlaybackSpeed,
        setCurrentState,
        setViewingEpisode, // To navigate

        // Transcription
        // transcripts removed as unused (checking API instead)

        setIsAutoScrollEnabled,

        transcribingEpisode,
        isTranscribing,
        setIsTranscribing,
        setTranscribingEpisode,
        setTranscriptionProgress,
        transcriptionProgress, // Added
        setTranscriptionStage,
        setError,
        navigateToView // Added for navigation
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

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = Number(e.target.value);
        setJumpToTime(newTime);
    };

    const formatTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleTakeNote = () => {
        setIsAutoScrollEnabled(false);
        // Correctly use navigateToView
        navigateToView('player', { episodeId: playingEpisode.id });
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
        <div className="persistent-player-bar">
            {/* 1. Left: Metadata */}
            <div className="player-bar-left">
                <img
                    src={playingEpisode.artwork_url || ''}
                    alt="Artwork"
                    className="player-bar-artwork"
                />
                <div className="player-bar-info">
                    <div className="player-bar-title" title={playingEpisode.title}>{playingEpisode.title}</div>
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

                    <button className="control-btn" onClick={() => handleSkip(-15)}>⏮ 15s</button>
                    <button className="control-btn play-btn" onClick={handlePlayPause}>
                        {isPlaying ? '⏸' : '▶️'}
                    </button>
                    <button className="control-btn" onClick={() => handleSkip(15)}>15s ⏭</button>
                </div>

                <div className="player-bar-progress">
                    <span className="time-text">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        className="progress-slider-bar"
                        min={0}
                        max={playingEpisode.duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                    />
                    <span className="time-text">{formatTime(playingEpisode.duration)}</span>
                </div>
            </div>

            {/* 3. Right: Actions */}
            <div className="player-bar-right">
                <div className="dynamic-actions">
                    {hasTranscript ? (
                        <button className="action-btn note-btn" onClick={handleTakeNote}>
                            ✏️ Take Note
                        </button>
                    ) : isTranscribingThis ? (
                        <div className="action-status">
                            <div className="spinner-tiny"></div>
                            <span>Transcribing {transcriptionProgress}%</span>
                        </div>
                    ) : (
                        <button className="action-btn transcribe-btn" onClick={handleTranscribe}>
                            ✨ Transcribe
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
