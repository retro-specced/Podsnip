import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export const useKeyboardShortcuts = () => {
    const {
        isPlaying,
        setIsPlaying,
        currentTime,
        setJumpToTime,
        playbackSpeed,
        setPlaybackSpeed,
        playingEpisode,
        navigateToView,
        setIsAutoScrollEnabled
    } = useAppStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if user is typing in an input, textarea, or contentEditable
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            switch (e.key) {
                case ' ': // Space: Play/Pause
                    e.preventDefault(); // Prevent scrolling
                    if (playingEpisode) {
                        setIsPlaying(!isPlaying);
                    }
                    break;

                case 'ArrowLeft': // Seek -15s
                    if (playingEpisode) {
                        setJumpToTime(Math.max(0, currentTime - 15));
                    }
                    break;

                case 'ArrowRight': // Seek +15s
                    if (playingEpisode) {
                        setJumpToTime(currentTime + 15);
                    }
                    break;

                case 's': // Cycle Speed
                    if (playingEpisode) {
                        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                        // Find closest speed in our list (in case current is weird)
                        // Default to 1 if not found
                        const current = playbackSpeed;

                        // Simple cycle logic: find next index
                        let nextIndex = speeds.findIndex(s => s > current);
                        if (nextIndex === -1) nextIndex = 0; // Wrap to start if we are at max or unknown high

                        // User requested: 0.5, 1, 1.5, 2 specifically.
                        // The user request said: "Change playback speed (0.5x, 1x, 1.5x, 2x)"
                        // Let's stick to exactly what they asked for in the shortcut, even if the UI has more.
                        const requestedSpeeds = [0.5, 1, 1.5, 2];
                        const currentRequestedIndex = requestedSpeeds.indexOf(current);

                        let nextSpeed = 1;
                        if (currentRequestedIndex !== -1) {
                            nextSpeed = requestedSpeeds[(currentRequestedIndex + 1) % requestedSpeeds.length];
                        } else {
                            // If we are at a speed not in the list (e.g. 0.75), snap to next highest or just 1?
                            // Let's snap to 1.
                            nextSpeed = 1;
                        }

                        setPlaybackSpeed(nextSpeed);
                    }
                    break;

                case 'n': // Take Note
                    if (playingEpisode) {
                        e.preventDefault();

                        // We need to execute async logic, but we can't await in the switch.
                        // Fire and forget (safely)
                        (async () => {
                            const state = useAppStore.getState();
                            const { currentState, isAutoScrollEnabled, currentTime, transcripts: storeTranscripts } = state;

                            // 1. Resolve Transcripts
                            let targetTranscripts = storeTranscripts;
                            let hasTranscript = targetTranscripts.length > 0 && targetTranscripts[0].episode_id === playingEpisode.id;

                            if (!hasTranscript) {
                                // Try fetching
                                try {
                                    const fetched = await window.api.transcription.get(playingEpisode.id);
                                    if (fetched && fetched.length > 0) {
                                        targetTranscripts = fetched;
                                        hasTranscript = true;
                                    }
                                } catch (err) {
                                    console.error("Shortcut failed to fetch transcript", err);
                                }
                            }

                            if (!hasTranscript) {
                                // Rule 8: If no transcript, show Toast with Generate button
                                // We do NOT navigate immediately.
                                state.setTranscriptToast({ show: true, episodeId: playingEpisode.id });
                                return;
                            }

                            // Rule 4: Transcript Exists -> Annotation Flow

                            // 2. Save Source Context
                            state.setAnnotationSource({
                                view: currentState,
                                episodeId: playingEpisode.id,
                                previousAutoScrollEnabled: isAutoScrollEnabled,
                                captureTime: currentTime
                            });

                            // 3. Auto-Select Segments (Last 15s)
                            if (state.selectedSegments.length === 0) {
                                const now = currentTime;
                                const lookback = 15;
                                const candidates = targetTranscripts.filter(t =>
                                    t.end_time >= (now - lookback) && t.start_time <= now
                                );

                                if (candidates.length > 0) {
                                    state.setSelectedSegments(candidates);
                                } else {
                                    const active = targetTranscripts.find(t => now >= t.start_time && now <= t.end_time);
                                    if (active) state.setSelectedSegments([active]);
                                }
                            }

                            // 4. Navigate
                            navigateToView('annotation');
                        })();
                    }
                    break;

                case 'w': // View Player
                    if (playingEpisode) {
                        setIsAutoScrollEnabled(true);
                        navigateToView('player', { episodeId: playingEpisode.id });
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        isPlaying,
        currentTime,
        playbackSpeed,
        playingEpisode,
        setIsPlaying,
        setJumpToTime,
        setPlaybackSpeed,
        navigateToView,
        setIsAutoScrollEnabled
    ]);
};
