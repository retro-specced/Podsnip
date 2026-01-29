import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Episode } from '../../shared/types';
import '../styles/BrowsingView.css';

function BrowsingView() {
  const {
    podcasts,
    currentPodcast,
    episodes,
    setCurrentPodcast,
    setEpisodes,
    setCurrentEpisode,
    setCurrentState,
    setError,
  } = useAppStore();

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Select first podcast by default
    if (podcasts.length > 0 && !currentPodcast) {
      handleSelectPodcast(podcasts[0].id);
    }
  }, [podcasts]);

  const handleSelectPodcast = async (podcastId: number) => {
    try {
      const podcast = await window.api.podcast.get(podcastId);
      setCurrentPodcast(podcast);

      const episodes = await window.api.episode.list(podcastId);
      setEpisodes(episodes);
    } catch (error) {
      setError('Failed to load podcast episodes');
    }
  };

  const handleDeletePodcast = async (podcastId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this podcast and all its episodes?')) {
      return;
    }

    try {
      await window.api.podcast.delete(podcastId);
      
      // Reload podcasts
      const allPodcasts = await window.api.podcast.list();
      setPodcasts(allPodcasts);
      
      // Clear current podcast if it was deleted
      if (currentPodcast?.id === podcastId) {
        setCurrentPodcast(null);
        setEpisodes([]);
      }
    } catch (error) {
      setError('Failed to delete podcast');
    }
  };

  const handlePlayEpisode = async (episode: Episode) => {
    setCurrentEpisode(episode);
    setCurrentState('player');
  };

  const getSortedEpisodes = () => {
    let sorted = [...episodes];

    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.published_date).getTime() - new Date(b.published_date).getTime());
        break;
      case 'longest':
        sorted.sort((a, b) => b.duration - a.duration);
        break;
      case 'shortest':
        sorted.sort((a, b) => a.duration - b.duration);
        break;
    }

    if (searchQuery) {
      sorted = sorted.filter(
        (ep) =>
          ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return sorted;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncateHtml = (html: string, maxLength: number) => {
    // Replace common HTML tags with spaces to preserve word boundaries
    const textWithSpaces = html
      .replace(/<\/p>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/div>/gi, ' ')
      .replace(/<\/li>/gi, ' ')
      .replace(/<\/h[1-6]>/gi, ' ');
    
    // Create a temporary div to extract plain text
    const tmp = document.createElement('div');
    tmp.innerHTML = textWithSpaces;
    const text = (tmp.textContent || tmp.innerText || '')
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    if (text.length <= maxLength) {
      return text;
    }
    
    // Truncate and add ellipsis
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className="browsing-view">
      <div className="browsing-left">
        <div className="podcast-list">
          <h2 className="section-title">Your Podcasts</h2>
          {podcasts.map((podcast) => (
            <div key={podcast.id} className="podcast-item-wrapper">
              <button
                className={`podcast-item ${currentPodcast?.id === podcast.id ? 'active' : ''}`}
                onClick={() => handleSelectPodcast(podcast.id)}
              >
                {podcast.artwork_url ? (
                  <img src={podcast.artwork_url} alt={podcast.title} className="podcast-artwork" />
                ) : (
                  <div className="podcast-artwork-placeholder">🎙️</div>
                )}
                <div className="podcast-info">
                  <h3 className="podcast-title">{podcast.title}</h3>
                  <p className="podcast-author">{podcast.author}</p>
                </div>
              </button>
              <button
                className="delete-podcast-button"
                onClick={(e) => handleDeletePodcast(podcast.id, e)}
                title="Delete podcast"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="browsing-right">
        {currentPodcast ? (
          <>
            <div className="podcast-header">
              <div className="podcast-details">
                {currentPodcast.artwork_url && (
                  <img
                    src={currentPodcast.artwork_url}
                    alt={currentPodcast.title}
                    className="podcast-artwork-large"
                  />
                )}
                <div className="podcast-meta">
                  <h1 className="podcast-title-large">{currentPodcast.title}</h1>
                  <p className="podcast-author-large">{currentPodcast.author}</p>
                  <p 
                    className="podcast-description"
                    dangerouslySetInnerHTML={{ __html: currentPodcast.description }}
                  />
                  <div className="podcast-stats">
                    <span>{episodes.length} episodes</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="episodes-controls">
              <input
                type="text"
                placeholder="Search episodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="episode-search"
              />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="sort-select">
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="longest">Longest First</option>
                <option value="shortest">Shortest First</option>
              </select>
            </div>

            <div className="episodes-list">
              {getSortedEpisodes().map((episode) => (
                <div key={episode.id} className="episode-item">
                  <div className="episode-content">
                    <h3 className="episode-title">{episode.title}</h3>
                    <p className="episode-meta">
                      {formatDate(episode.published_date)} · {formatDuration(episode.duration)}
                    </p>
                    <p className="episode-description">
                      {truncateHtml(episode.description, 200)}
                    </p>
                  </div>
                  <button className="play-button" onClick={() => handlePlayEpisode(episode)}>
                    ▶️ Play
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>Select a podcast to view episodes</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrowsingView;
