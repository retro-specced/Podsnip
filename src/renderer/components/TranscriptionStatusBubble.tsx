import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/TranscriptionBubble.css';

export default function TranscriptionStatusBubble() {
    const {
        transcribingEpisode,
        isTranscribing,
        transcriptionProgress,
        transcriptionStage,
        viewingEpisode,
        currentState // Added to check if we are actually looking at the player
    } = useAppStore();

    const [isExpanded, setIsExpanded] = useState(false);

    // Hide if not transcribing
    // OR if we are in Player View looking at the transcribing episode (since PlayerView shows progress)
    if (!isTranscribing || !transcribingEpisode) return null;
    if (currentState === 'player' && viewingEpisode?.id === transcribingEpisode.id) return null;

    return (
        <div className="transcription-bubble-container">
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

                    <div className="popover-content">
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

                        {/* Estimated time is hard to calculate without backend support, omitting for now or mocking */}
                        <div className="popover-estimate">
                            Estimated time remaining: --:--
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
