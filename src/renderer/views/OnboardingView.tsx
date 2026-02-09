import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/OnboardingView.css';
import { Mic, FileText, Library, Search, Rss, ArrowRight } from 'lucide-react';

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
          <div className="app-icon">
            <Mic size={64} strokeWidth={1.5} />
          </div>
          <h1>Welcome to Podsnip</h1>
          <p className="tagline">
            Listen, transcribe, and annotate your favorite podcasts
          </p>
          <div className="features">
            <div className="feature">
              <span className="feature-icon"><FileText size={20} /></span>
              <span>Automatic transcription</span>
            </div>
            <div className="feature">
              <span className="feature-icon"><Search size={20} /></span>
              <span>Synchronized playback</span>
            </div>
            <div className="feature">
              <span className="feature-icon"><Library size={20} /></span>
              <span>Organized notes library</span>
            </div>
          </div>
        </div>
      </div>

      <div className="onboarding-right">
        <div className="feed-input-container glass-panel">
          <h2>Add your first podcast</h2>
          <p className="instruction">
            Enter the RSS feed URL of a podcast you'd like to listen to
          </p>

          <form onSubmit={handleAddPodcast} className="feed-form">
            <div className="input-wrapper">
              <Rss size={16} className="input-icon" />
              <input
                type="url"
                placeholder="https://example.com/podcast/feed.xml"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                disabled={isAdding}
                className="feed-input"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isAdding}
              className="add-button"
            >
              {isAdding ? 'Adding...' : (
                <>
                  <span>Start Listening</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="examples">
            <p className="examples-title">Popular podcasts to try:</p>
            <div className="example-feeds">
              <button
                onClick={() => setFeedUrl('https://rss.art19.com/tim-ferriss-show')}
                className="example-button"
                disabled={isAdding}
              >
                The Tim Ferriss Show
              </button>
              <button
                onClick={() => setFeedUrl('http://feeds.megaphone.fm/vergecast')}
                className="example-button"
                disabled={isAdding}
              >
                The Vergecast
              </button>
              <button
                onClick={() => setFeedUrl('https://feeds.acast.com/public/shows/64e387653cabbc001153a5a5')}
                className="example-button"
                disabled={isAdding}
              >
                The 404 Media Podcast
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OnboardingView;
