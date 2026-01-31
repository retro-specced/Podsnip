import { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { Episode } from '../../shared/types';
import AddPodcastModal from '../components/AddPodcastModal';
import '../styles/BrowsingView.css';

// Updated with Add Podcast button - v2
function BrowsingView() {
  const {
    podcasts,
    currentPodcast,
    episodes,
    setCurrentPodcast,
    setEpisodes,
    setCurrentEpisode,
    setCurrentState,
    setPodcasts,
    setError,
    updateCurrentSnapshot,
    restoredScrollPosition,
    setRestoredScrollPosition,
    restoredVisibleCount,
    setRestoredVisibleCount,
  } = useAppStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    // Select first podcast by default only if no podcasts are selected
    if (podcasts.length > 0 && !currentPodcast) {
      handleSelectPodcast(podcasts[0].id);
    }
  }, [podcasts, currentPodcast]);

  // Unified episode loading (Handles both manual selection and history restoration)
  useEffect(() => {
    const loadEpisodes = async () => {
      if (!currentPodcast) return;

      try {
        const episodes = await window.api.episode.list(currentPodcast.id);
        setEpisodes(episodes);
      } catch (error) {
        setError('Failed to load podcast episodes');
      }
    };

    if (currentPodcast) {
      loadEpisodes();
    }
  }, [currentPodcast?.id]);

  // Reset description expansion when podcast changes
  useEffect(() => {
    setIsDescriptionExpanded(false);
  }, [currentPodcast?.id]);

  // Restore scroll position and visible count
  useLayoutEffect(() => {
    if (restoredVisibleCount !== null) {
      setVisibleCount(restoredVisibleCount);
    }

    // We need to wait for render with correct count before scrolling
    requestAnimationFrame(() => {
      if (restoredScrollPosition !== null && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = restoredScrollPosition;
      }
    });
  }, [restoredScrollPosition, restoredVisibleCount, episodes]); // Scroll after episodes render

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Load more when near bottom (200px threshold)
    if (scrollHeight - scrollTop - clientHeight < 200) {
      // If we haven't shown all episodes yet
      if (visibleCount < episodes.length) {
        setVisibleCount(prev => Math.min(prev + 20, episodes.length));
      }
    }
  };

  const handleSelectPodcast = async (podcastId: number) => {
    try {
      // Reset scroll position and visible count for new podcast
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      setRestoredScrollPosition(null); // Prevent restoration effect from interfering
      setRestoredVisibleCount(null);
      setVisibleCount(20);

      const podcast = await window.api.podcast.get(podcastId);
      setCurrentPodcast(podcast);
      // Save selection to current history snapshot
      updateCurrentSnapshot({ podcast });

      // Note: Episodes are loaded by the useEffect above
    } catch (error) {
      setError('Failed to load podcast details');
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
    // Save scroll position and visible count before navigating away
    if (scrollContainerRef.current) {
      updateCurrentSnapshot({
        scrollPosition: scrollContainerRef.current.scrollTop,
        visibleCount: visibleCount
      });
    }
    setCurrentEpisode(episode);
    setCurrentState('player');
  };

  const sortedEpisodes = useMemo(() => {
    let sorted = [...episodes];

    switch (sortBy) {
      case 'newest':
        // Optimization: Date parsing can be slow in sort, but usually acceptable for <1000 items.
        // For larger lists, pre-calculating timestamps would be better.
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
      const lowerQuery = searchQuery.toLowerCase();
      sorted = sorted.filter(
        (ep) =>
          ep.title.toLowerCase().includes(lowerQuery) ||
          ep.description.toLowerCase().includes(lowerQuery)
      );
    }

    return sorted;
  }, [episodes, sortBy, searchQuery]);

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
    if (!html) return '';

    // Optimized: Use regex instead of DOM creation to strip HTML
    // This avoids main-thread blocking DOM operations during render
    const text = html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6])>/gi, ' ') // Add space after block elements
      .replace(/<[^>]+>/g, '') // Strip all tags
      .replace(/\s+/g, ' ')    // Collapse multiple spaces
      .trim();

    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className="browsing-view">
      <div className="browsing-left">
        <div className="podcast-list">
          <div className="podcast-list-header">
            <h2 className="section-title">Your Podcasts</h2>
            <button
              className="add-podcast-button"
              onClick={() => setShowAddModal(true)}
              title="Add podcast"
            >
              +
            </button>
          </div>
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

                  <div className={`podcast-description-container ${isDescriptionExpanded ? 'expanded' : ''}`}>
                    <div
                      className="podcast-description"
                      dangerouslySetInnerHTML={{ __html: currentPodcast.description }}
                    />
                  </div>

                  {truncateHtml(currentPodcast.description, 1000).length > 200 && (
                    <button
                      className="show-more-btn"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    >
                      {isDescriptionExpanded ? 'Show Less' : 'Show More'}
                    </button>
                  )}

                  <div className="podcast-meta-bubbles">
                    <span className="meta-bubble episode-count-bubble">
                      {episodes.length} Episodes
                    </span>
                    {currentPodcast.category && (
                      <span className="meta-bubble category-bubble">
                        {currentPodcast.category}
                      </span>
                    )}
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

            <div className="episodes-list" ref={scrollContainerRef} onScroll={handleScroll}>
              {sortedEpisodes.slice(0, visibleCount).map((episode) => (
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

      <AddPodcastModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}

export default BrowsingView;
