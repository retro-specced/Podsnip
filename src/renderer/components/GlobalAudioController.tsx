import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';

export default function GlobalAudioController() {
    const {
        playingEpisode, // Changed from currentEpisode
        transcribingEpisode, // Add this
        isPlaying,
        playbackSpeed,
        setIsPlaying,
        setCurrentTime,
        setPlaybackSpeed,
        setIsTranscribing,
        setTranscriptionProgress,
        setTranscriptionStage,
        jumpToTime,
        setJumpToTime,
    } = useAppStore();

    const audioRef = useRef<HTMLAudioElement>(null);
    const [isBuffering, setIsBuffering] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);

    // Ref to track if we've handled the initial seek for a new episode (e.g. restore/jump)
    const hasInitializedSeekRef = useRef(false);
    const lastEpisodeIdRef = useRef<number | null>(null);

    // 1. Handle Audio Source & Reloading
    useEffect(() => {
        if (playingEpisode) {
            const isNewEpisode = lastEpisodeIdRef.current !== playingEpisode.id;
            // Detect if same episode gained a local path (downloaded while playing)
            const gainedLocalPath = !isNewEpisode && playingEpisode.local_path && audioRef.current && !audioRef.current.src.startsWith('file://') && !audioRef.current.src.includes(playingEpisode.local_path);

            // Or simpler check: if local_path exists and src is different, and ID is same?
            // Actually, we just need to know if we need to reload.
            // If ID changed, we reload.
            // If ID is same, but we now have local_path where we didn't (or src implies stream), we reload.

            if (isNewEpisode) {
                // Update ref
                lastEpisodeIdRef.current = playingEpisode.id;

                if (audioRef.current) {
                    // Reset state for new episode
                    hasInitializedSeekRef.current = false;
                    setAudioError(null);

                    // Load new source
                    audioRef.current.load();
                }
            } else if (gainedLocalPath) {
                console.log("Audio downloaded, swapping source to local file.");
                if (audioRef.current) {
                    const currentTime = audioRef.current.currentTime;
                    const wasPlaying = !audioRef.current.paused;

                    // Force reload to pick up new src (which React updates on audio tag)
                    // But React might not update the DOM src attribute solely by re-render if we don't force it?
                    // The <audio src={...}> below handles the prop update. 
                    // We just need to trigger load() and restore time.
                    audioRef.current.load();
                    audioRef.current.currentTime = currentTime;
                    if (wasPlaying) {
                        audioRef.current.play().catch(e => console.error("Resume after swap failed", e));
                    }
                }
            }
        }
    }, [playingEpisode]);

    // 2. Handle Play/Pause
    useEffect(() => {
        if (!audioRef.current || !playingEpisode) return;

        if (isPlaying) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Autoplay prevented or failed:", error);
                    setIsPlaying(false);
                });
            }
        } else {
            audioRef.current.pause();
        }
    }, [isPlaying, playingEpisode]);

    // 3. Handle Playback Speed
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackSpeed;
        }
    }, [playbackSpeed]);

    // 4. Handle Seeks / JumpToTime actions
    useEffect(() => {
        if (audioRef.current && jumpToTime !== null && jumpToTime >= 0) {
            audioRef.current.currentTime = jumpToTime;
            setJumpToTime(null); // Clear the jump trigger
            setIsPlaying(true);
        }
    }, [jumpToTime]);

    // 6. Global Transcription Listeners
    useEffect(() => {
        window.api.transcription.onProgress((data) => {
            // Match against TRANSCRBING episode
            if (transcribingEpisode && data.episodeId === transcribingEpisode.id) {
                setTranscriptionProgress(data.progress || 0);
                setTranscriptionStage(data.stage || '');
                if (data.progress < 100) {
                    setIsTranscribing(true);
                } else {
                    setIsTranscribing(false);
                    // Refresh playing episode to get local_path if it's the one we are playing
                    if (playingEpisode && data.episodeId === playingEpisode.id) {
                        window.api.episode.get(playingEpisode.id).then(ep => {
                            if (ep) {
                                // Update the store's playing episode with the fresh one (containing local_path)
                                const { setPlayingEpisode } = useAppStore.getState();
                                setPlayingEpisode(ep);
                            }
                        });
                    }
                }
            }
        });

        return () => {
            window.api.transcription.removeProgressListener();
        };
    }, [transcribingEpisode]);

    // 7. Save Playback State Periodically
    useEffect(() => {
        if (!playingEpisode) return;

        // Save every 5 seconds if playing
        const interval = setInterval(() => {
            if (audioRef.current && !audioRef.current.paused) {
                window.api.playback.save(playingEpisode.id, audioRef.current.currentTime, playbackSpeed);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [playingEpisode, playbackSpeed]);

    // Handlers for Audio Events
    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        if (playingEpisode) {
            window.api.playback.save(playingEpisode.id, playingEpisode.duration, playbackSpeed);
        }
    };

    const handleLoadedMetadata = async () => {
        if (!audioRef.current || !playingEpisode) return;

        // Restore Saved Position if this is a fresh load (not a seek)
        // and we haven't jumped yet.
        if (!hasInitializedSeekRef.current && jumpToTime === null) {
            try {
                const state = await window.api.playback.get(playingEpisode.id);
                if (state && state.current_position > 0 && state.current_position < (playingEpisode.duration - 5)) {
                    audioRef.current.currentTime = state.current_position;
                    setPlaybackSpeed(state.playback_speed);
                }
            } catch (e) {
                console.error("Failed to restore playback state", e);
            }
            hasInitializedSeekRef.current = true;
        }
    };

    if (!playingEpisode) return null;

    return (
        <audio
            ref={audioRef}
            src={playingEpisode.local_path || playingEpisode.audio_url}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onError={(e) => {
                console.error("Global Audio Error:", e);
                setAudioError("Playback failed"); // Could utilize central error store
                setIsPlaying(false);
            }}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onPlaying={() => setIsBuffering(false)}
            crossOrigin="anonymous"
            style={{ display: 'none' }}
        />
    );
}
