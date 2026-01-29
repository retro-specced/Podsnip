import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/AddPodcastModal.css';

interface AddPodcastModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function AddPodcastModal({ isOpen, onClose }: AddPodcastModalProps) {
    const [feedUrl, setFeedUrl] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const { addPodcast, setCurrentPodcast, setEpisodes, setError } = useAppStore();

    const handleAddPodcast = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!feedUrl.trim()) {
            setError('Please enter a podcast feed URL');
            return;
        }

        setIsAdding(true);
        setError(null);

        try {
            const podcast = await window.api.podcast.add(feedUrl);
            addPodcast(podcast);

            // Auto-select the newly added podcast
            setCurrentPodcast(podcast);
            const episodes = await window.api.episode.list(podcast.id);
            setEpisodes(episodes);

            // Reset form and close modal
            setFeedUrl('');
            onClose();
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to add podcast');
        } finally {
            setIsAdding(false);
        }
    };

    const handleClose = () => {
        if (!isAdding) {
            setFeedUrl('');
            setError(null);
            onClose();
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div className="modal-container">
                <button className="modal-close-button" onClick={handleClose} disabled={isAdding}>
                    ✕
                </button>

                <div className="modal-content">
                    <div className="modal-left">
                        <div className="modal-welcome-content">
                            <div className="modal-app-icon">🎙️</div>
                            <h2>Add a Podcast</h2>
                            <p className="modal-tagline">
                                Expand your library with more podcasts to listen and annotate
                            </p>
                            <div className="modal-features">
                                <div className="modal-feature">
                                    <span className="modal-feature-icon">📝</span>
                                    <span>Automatic transcription</span>
                                </div>
                                <div className="modal-feature">
                                    <span className="modal-feature-icon">🔍</span>
                                    <span>Synchronized playback</span>
                                </div>
                                <div className="modal-feature">
                                    <span className="modal-feature-icon">📚</span>
                                    <span>Organized notes library</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-right">
                        <div className="modal-feed-input-container">
                            <h3>Enter podcast feed URL</h3>
                            <p className="modal-instruction">
                                Paste the RSS feed URL of the podcast you'd like to add
                            </p>

                            <form onSubmit={handleAddPodcast} className="modal-feed-form">
                                <input
                                    type="url"
                                    placeholder="https://example.com/podcast/feed.xml"
                                    value={feedUrl}
                                    onChange={(e) => setFeedUrl(e.target.value)}
                                    disabled={isAdding}
                                    className="modal-feed-input"
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isAdding}
                                    className="modal-add-button"
                                >
                                    {isAdding ? 'Adding...' : 'Add Podcast'}
                                </button>
                            </form>

                            <div className="modal-examples">
                                <p className="modal-examples-title">Popular podcasts to try:</p>
                                <div className="modal-example-feeds">
                                    <button
                                        onClick={() => setFeedUrl('https://feeds.simplecast.com/54nAGcIl')}
                                        className="modal-example-button"
                                        disabled={isAdding}
                                    >
                                        The Daily (NY Times)
                                    </button>
                                    <button
                                        onClick={() => setFeedUrl('https://feeds.npr.org/510318/podcast.xml')}
                                        className="modal-example-button"
                                        disabled={isAdding}
                                    >
                                        Wait Wait... Don't Tell Me!
                                    </button>
                                    <button
                                        onClick={() => setFeedUrl('https://feeds.megaphone.fm/sciencevs')}
                                        className="modal-example-button"
                                        disabled={isAdding}
                                    >
                                        Science Vs
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AddPodcastModal;
