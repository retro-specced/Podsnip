import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/OnboardingView.css';

function OnboardingView() {
  const [feedUrl, setFeedUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { addPodcast, navigateToView, setError } = useAppStore();

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
      setFeedUrl('');

      // Move to browsing state after successfully adding first podcast
      // REPLACE history so user can't go back to onboarding
      navigateToView('browsing', { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add podcast');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="onboarding-view">
      <div className="onboarding-left">
        <div className="welcome-content">
          <div className="app-icon">🎙️</div>
          <h1>Welcome to Podsnip</h1>
          <p className="tagline">
            Listen, transcribe, and annotate your favorite podcasts
          </p>
          <div className="features">
            <div className="feature">
              <span className="feature-icon">📝</span>
              <span>Automatic transcription</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🔍</span>
              <span>Synchronized playback</span>
            </div>
            <div className="feature">
              <span className="feature-icon">📚</span>
              <span>Organized notes library</span>
            </div>
          </div>
        </div>
      </div>

      <div className="onboarding-right">
        <div className="feed-input-container">
          <h2>Add your first podcast</h2>
          <p className="instruction">
            Enter the RSS feed URL of a podcast you'd like to listen to
          </p>

          <form onSubmit={handleAddPodcast} className="feed-form">
            <input
              type="url"
              placeholder="https://example.com/podcast/feed.xml"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              disabled={isAdding}
              className="feed-input"
              required
            />
            <button
              type="submit"
              disabled={isAdding}
              className="add-button"
            >
              {isAdding ? 'Adding...' : 'Add Podcast'}
            </button>
          </form>

          <div className="examples">
            <p className="examples-title">Popular podcasts to try:</p>
            <div className="example-feeds">
              <button
                onClick={() => setFeedUrl('https://feeds.simplecast.com/54nAGcIl')}
                className="example-button"
              >
                The Daily (NY Times)
              </button>
              <button
                onClick={() => setFeedUrl('https://feeds.npr.org/510318/podcast.xml')}
                className="example-button"
              >
                Wait Wait... Don't Tell Me!
              </button>
              <button
                onClick={() => setFeedUrl('https://feeds.megaphone.fm/sciencevs')}
                className="example-button"
              >
                Science Vs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingView;
