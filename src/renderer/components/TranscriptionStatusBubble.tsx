import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/TranscriptionBubble.css';

export default function TranscriptionStatusBubble() {
    const {
        transcribingEpisode,
        isTranscribing,
        transcriptionProgress,
        transcriptionStage,
        viewingEpisode,
        currentState,
        navigateToView // Extract navigation function
    } = useAppStore();

    const [isExpanded, setIsExpanded] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Detect completion
    const [wasTranscribing, setWasTranscribing] = useState(false);

    // Effect to handle state transition logic
    if (isTranscribing && !wasTranscribing) {
        setWasTranscribing(true);
    }

    if (!isTranscribing && wasTranscribing) {
        setWasTranscribing(false);
        // Only show success if we have a valid recent transcription state
        if (transcriptionProgress >= 100) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000); // Hide after 5 seconds
        }
    }

    // Click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsExpanded(false);
            }
        }

        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isExpanded]);

    // Logic:
    // If Transcribing -> Show Spinner + Progress (Expandable)
    // If Success -> Show Checkmark + "Audio Downloaded" (Click to dismiss?)
    // Else -> Null

    if (showSuccess) {
        return (
            <div className="transcription-bubble-container">
                <button className="transcription-bubble-trigger success">
                    <span className="bubble-icon">✅</span>
                    <span className="bubble-label">Audio Downloaded</span>
                </button>
            </div>
        );
    }

    // Hide if not transcribing
    // OR if we are in Player View looking at the transcribing episode (since PlayerView shows progress)
    if (!isTranscribing || !transcribingEpisode) return null;
    if (currentState === 'player' && viewingEpisode?.id === transcribingEpisode.id) return null;

    return (
        <div className="transcription-bubble-container" ref={containerRef}>
            <button
                className={`transcription-bubble-trigger ${isExpanded ? 'active' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="spinner-mini"></div>
                <span className="bubble-label">Processing</span>
            </button>

            {isExpanded && (
                <div className="transcription-popover">
                    <div className="popover-header">
                        <span className="popover-title">Transcription in Progress</span>
                        <button className="close-btn" onClick={() => setIsExpanded(false)}>×</button>
                    </div>

                    <div
                        className="popover-content clickable"
                        onClick={() => {
                            if (transcribingEpisode) {
                                navigateToView('player', { episodeId: transcribingEpisode.id });
                                setIsExpanded(false);
                            }
                        }}
                        title="Go to Episode"
                    >
                        <div className="popover-row">
                            <img
                                src={transcribingEpisode.artwork_url || ''}
                                alt="Artwork"
                                className="popover-artwork"
                            />
                            <div className="popover-info">
                                <div className="popover-episode-title" title={transcribingEpisode.title}>
                                    {transcribingEpisode.title}
                                </div>
                                <div className="popover-stage">
                                    {transcriptionStage}
                                </div>
                            </div>
                        </div>

                        <div className="popover-progress-container">
                            <div className="popover-progress-bar">
                                <div
                                    className="popover-progress-fill"
                                    style={{ width: `${transcriptionProgress}%` }}
                                ></div>
                            </div>
                            <span className="popover-progress-text">{transcriptionProgress}%</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
