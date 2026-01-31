import { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { Episode } from '../../shared/types';
import AddPodcastModal from '../components/AddPodcastModal';
import { Plus, Trash2, RefreshCw, Mic, FileText, Play } from 'lucide-react';
import '../styles/BrowsingView.css';

// Updated with Add Podcast button - v2
function BrowsingView() {
  const {
    podcasts,
    currentPodcast,
    episodes,
    setCurrentPodcast,
    setEpisodes,
    setCurrentState,
    setPodcasts,
    setError,
    updateCurrentSnapshot,
    restoredScrollPosition,
    setRestoredScrollPosition,
    restoredVisibleCount,
    setRestoredVisibleCount,
    navigateToView,
  } = useAppStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [showRefreshMessage, setShowRefreshMessage] = useState(false);

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

      // Clear new indicator if present
      if (podcast?.has_new) {
        await window.api.podcast.clearNew(podcastId);
        // Update local state for immediate feedback
        setPodcasts(podcasts.map(p => p.id === podcastId ? { ...p, has_new: false } : p));
      }

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
    // Only set VIEWING episode, do not auto-play
    // setViewingEpisode(episode); // Handled by navigateToView
    // setCurrentState('player');
    navigateToView('player', { episodeId: episode.id });
  };

  const handleRefreshPodcast = async () => {
    if (!currentPodcast || isRefreshing) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const newCount = await window.api.podcast.refresh(currentPodcast.id);

      // Update message based on results
      if (newCount > 0) {
        setRefreshMessage(`${newCount} new episode${newCount > 1 ? 's' : ''}`);
      } else {
        setRefreshMessage('Up to date!');
      }
      setShowRefreshMessage(true);

      // Re-fetch podcast and episodes to update UI
      const updatedPodcast = await window.api.podcast.get(currentPodcast.id);
      const updatedEpisodes = await window.api.episode.list(currentPodcast.id);

      setCurrentPodcast(updatedPodcast);
      setEpisodes(updatedEpisodes);

      // Update podcasts list as well (for last_updated date in side list if sorted)
      const allPodcasts = await window.api.podcast.list();
      setPodcasts(allPodcasts);

      // Revert after 5 seconds
      setTimeout(() => {
        setShowRefreshMessage(false);
      }, 5000);

    } catch (err: any) {
      setError(err.message || 'Failed to refresh podcast');
    } finally {
      setIsRefreshing(false);
    }
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
              <Plus size={18} />
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
                  <div className="podcast-artwork-placeholder">
                    <Mic size={20} className="opacity-50" />
                  </div>
                )}
                <div className="podcast-info">
                  <h3 className="podcast-title">{podcast.title}</h3>
                  <p className="podcast-author">{podcast.author}</p>
                </div>
                {podcast.has_new && <div className="unread-dot" title="New episodes available" />}
              </button>
              <button
                className="delete-podcast-button"
                onClick={(e) => handleDeletePodcast(podcast.id, e)}
                title="Delete podcast"
              >
                <Trash2 size={14} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="browsing-right">
        {currentPodcast ? (
          <>
            <div className="podcast-header">
              <div className="podcast-header-top">
                <div className="podcast-meta">
                  <h1 className="podcast-title-large">{currentPodcast.title}</h1>
                  <p className="podcast-author-large">{currentPodcast.author}</p>
                </div>

                <div className="podcast-refresh-container">
                  <span className={`refresh-status-message ${showRefreshMessage ? 'highlight' : ''}`}>
                    {showRefreshMessage ? refreshMessage : `Last Updated: ${formatDate(currentPodcast.last_updated)} ${new Date(currentPodcast.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                  <button
                    className={`refresh-button ${isRefreshing ? 'spinning' : ''}`}
                    onClick={handleRefreshPodcast}
                    disabled={isRefreshing}
                    title="Refresh episodes"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              <div className="podcast-details">
                {currentPodcast.artwork_url && (
                  <img
                    src={currentPodcast.artwork_url}
                    alt={currentPodcast.title}
                    className="podcast-artwork-large"
                  />
                )}
                <div className="podcast-meta">
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
                <div
                  key={episode.id}
                  className="episode-item clickable"
                  onClick={() => handlePlayEpisode(episode)}
                  title="Play Episode"
                >
                  <img
                    src={episode.artwork_url || currentPodcast.artwork_url}
                    alt={episode.title}
                    className="episode-artwork-list"
                  />
                  <div className="episode-content">
                    <div className="episode-header">
                      <h3 className="episode-title">{episode.title}</h3>
                    </div>

                    <div className="episode-meta-row">
                      <span className="meta-text">{formatDate(episode.published_date)}</span>
                      <span className="meta-dot">·</span>
                      <span className="meta-text">{formatDuration(episode.duration)}</span>
                    </div>

                    <div className="episode-description-row">
                      {truncateHtml(episode.description, 150)}
                    </div>

                    {((episode.current_position && episode.current_position > 0) || episode.completed) && (
                      <div className="episode-progress-container">
                        <div className="progress-bar-bg">
                          <div
                            className="progress-bar-fill"
                            style={{ width: episode.completed ? '100%' : `${(episode.current_position! / episode.duration) * 100}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {episode.completed || (episode.duration - episode.current_position! < 1)
                            ? "Finished"
                            : `${formatDuration(Math.max(0, episode.duration - episode.current_position!))} remaining`
                          }
                        </span>
                      </div>
                    )}

                    {episode.has_notes && (
                      <div
                        className="notes-indicator-corner"
                        title="View notes"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToView('notes', { podcastId: currentPodcast?.id, episodeId: episode.id });
                        }}
                      >
                        <FileText size={12} />
                        <span className="notes-label">Note Available</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Mic size={48} className="empty-icon" />
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
