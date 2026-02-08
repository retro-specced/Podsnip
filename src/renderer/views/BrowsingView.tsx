import { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { Episode } from '../../shared/types';
import AddPodcastModal from '../components/AddPodcastModal';
import { Plus, Trash2, RefreshCw, Mic, FileText, Search, Check } from 'lucide-react';
import { ScrollableContainer } from '../components/ScrollableContainer';
import '../styles/BrowsingView.css';


// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const sortOptions = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'longest', label: 'Longest First' },
  { value: 'shortest', label: 'Shortest First' },
] as const;

function BrowsingView() {
  // ... inside BrowsingView

  const {
    podcasts,
    currentPodcast,
    episodes,
    setCurrentPodcast,
    setEpisodes,

    setPodcasts,
    setError,
    updateCurrentSnapshot,
    restoredScrollPosition,
    setRestoredScrollPosition,
    restoredVisibleCount,
    setRestoredVisibleCount,
    navigateToView,

    // Sidebar State
    podcastSortOrder,
    setPodcastSortOrder,
    podcastSearchQuery,
    setPodcastSearchQuery
  } = useAppStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const sidebarListRef = useRef<HTMLDivElement>(null);
  const sidebarFilterRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerMargin, setHeaderMargin] = useState(0);

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [showRefreshMessage, setShowRefreshMessage] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Sidebar Header Visibility Logic
  const [isSidebarHeaderVisible, setIsSidebarHeaderVisible] = useState(false);
  const [isSidebarFilterOpen, setIsSidebarFilterOpen] = useState(false);
  const lastSidebarScrollTop = useRef(0);

  // Measure header height for smooth animation
  useLayoutEffect(() => {
    if (headerRef.current) {
      // Set initial negative margin to hide it (height)
      // We will toggle between 0 and -height
      const height = headerRef.current.offsetHeight;
      setHeaderMargin(isSidebarHeaderVisible ? 0 : -height);
    }
  });

  // Update margin when visibility changes
  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.offsetHeight;
      setHeaderMargin(isSidebarHeaderVisible ? 0 : -height);
    }
  }, [isSidebarHeaderVisible]);

  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Always show if not scrollable or at top
    if (scrollHeight <= clientHeight || scrollTop <= 0) {
      setIsSidebarHeaderVisible(true);
      lastSidebarScrollTop.current = scrollTop;
      return;
    }

    // Show on scroll up, hide on scroll down (immediately)
    if (scrollTop > lastSidebarScrollTop.current) {
      setIsSidebarHeaderVisible(false);
      setIsSidebarFilterOpen(false); // Close dropdown on scroll
    } else if (scrollTop < lastSidebarScrollTop.current) {
      setIsSidebarHeaderVisible(true);
    }

    lastSidebarScrollTop.current = scrollTop;
  };

  // Click outside for sidebar filter and sort dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sidebarFilterRef.current && !sidebarFilterRef.current.contains(target)) {
        setIsSidebarFilterOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter & Sort Podcasts
  const sortedPodcasts = useMemo(() => {
    let result = [...podcasts];

    // Filter
    if (podcastSearchQuery) {
      const lowerQuery = podcastSearchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(lowerQuery) ||
        p.author.toLowerCase().includes(lowerQuery)
      );
    }

    // Sort
    switch (podcastSortOrder) {
      case 'recentlyAdded':
        result.sort((a, b) => b.id - a.id);
        break;
      case 'lastUpdated':
        result.sort((a, b) => b.id - a.id);
        break;
      case 'alphabeticalAZ':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'alphabeticalZA':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    return result;
  }, [podcasts, podcastSearchQuery, podcastSortOrder]);


  // Select first podcast by default
  useEffect(() => {
    if (podcasts.length > 0 && !currentPodcast) {
      handleSelectPodcast(podcasts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podcasts, currentPodcast]);

  // Unified episode loading
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

    requestAnimationFrame(() => {
      if (restoredScrollPosition !== null && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = restoredScrollPosition;
      }
    });
  }, [restoredScrollPosition, restoredVisibleCount, episodes]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      if (visibleCount < episodes.length) {
        setVisibleCount(prev => Math.min(prev + 20, episodes.length));
      }
    }
  };

  const handleSelectPodcast = async (podcastId: number) => {
    try {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      setRestoredScrollPosition(null);
      setRestoredVisibleCount(null);
      setVisibleCount(20);

      const podcast = await window.api.podcast.get(podcastId);
      setCurrentPodcast(podcast);
      updateCurrentSnapshot({ podcast });

      if (podcast?.has_new) {
        await window.api.podcast.clearNew(podcastId);
        setPodcasts(podcasts.map(p => p.id === podcastId ? { ...p, has_new: false } : p));
      }

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
      const allPodcasts = await window.api.podcast.list();
      setPodcasts(allPodcasts);

      if (currentPodcast?.id === podcastId) {
        setCurrentPodcast(null);
        setEpisodes([]);
      }
    } catch (error) {
      setError('Failed to delete podcast');
    }
  };

  const handlePlayEpisode = async (episode: Episode) => {
    if (scrollContainerRef.current) {
      updateCurrentSnapshot({
        scrollPosition: scrollContainerRef.current.scrollTop,
        visibleCount: visibleCount
      });
    }
    navigateToView('player', { episodeId: episode.id });
  };

  const handleRefreshPodcast = async () => {
    if (!currentPodcast || isRefreshing) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const newCount = await window.api.podcast.refresh(currentPodcast.id);

      if (newCount > 0) {
        setRefreshMessage(`${newCount} new episode${newCount > 1 ? 's' : ''}`);
      } else {
        setRefreshMessage('Up to date!');
      }
      setShowRefreshMessage(true);

      const updatedPodcast = await window.api.podcast.get(currentPodcast.id);
      const updatedEpisodes = await window.api.episode.list(currentPodcast.id);

      setCurrentPodcast(updatedPodcast);
      setEpisodes(updatedEpisodes);

      const allPodcasts = await window.api.podcast.list();
      setPodcasts(allPodcasts);

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
    const text = html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <motion.div
      className="browsing-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="browsing-left">
        {/* Sidebar Header (Scroll Reveal) */}
        <div
          className="sidebar-search-header"
          ref={headerRef}
          style={{ marginTop: headerMargin }}
        >
          <div className="sidebar-search-bar">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={podcastSearchQuery}
              onChange={(e) => setPodcastSearchQuery(e.target.value)}
            />
          </div>


        </div>

        <ScrollableContainer className="podcast-list" onScroll={handleSidebarScroll} innerRef={sidebarListRef}>
          <div className="podcast-list-header">
            <h2 className="section-title">Your Podcasts</h2>
            <div className="sidebar-header-actions">
              <div className="sidebar-filter-wrapper" ref={sidebarFilterRef}>
                <button
                  className={`sidebar-filter-btn ${isSidebarFilterOpen ? 'active' : ''}`}
                  onClick={() => setIsSidebarFilterOpen(!isSidebarFilterOpen)}
                  title="Filter Podcasts"
                >
                  <div className="filter-lines">
                    <div className="line line-1"></div>
                    <div className="line line-2"></div>
                    <div className="line line-3"></div>
                  </div>
                </button>

                <AnimatePresence>
                  {isSidebarFilterOpen && (
                    <motion.div
                      className="sidebar-filter-dropdown glass-panel"
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="filter-option" onClick={() => { setPodcastSortOrder('recentlyAdded'); setIsSidebarFilterOpen(false); }}>
                        <span>Recently Added</span>
                        {podcastSortOrder === 'recentlyAdded' && <Check size={14} className="text-primary-400" />}
                      </div>
                      <div className="filter-option" onClick={() => { setPodcastSortOrder('lastUpdated'); setIsSidebarFilterOpen(false); }}>
                        <span>Last Updated</span>
                        {podcastSortOrder === 'lastUpdated' && <Check size={14} className="text-primary-400" />}
                      </div>
                      <div className="filter-option" onClick={() => { setPodcastSortOrder('alphabeticalAZ'); setIsSidebarFilterOpen(false); }}>
                        <span>Alphabetical (A-Z)</span>
                        {podcastSortOrder === 'alphabeticalAZ' && <Check size={14} className="text-primary-400" />}
                      </div>
                      <div className="filter-option" onClick={() => { setPodcastSortOrder('alphabeticalZA'); setIsSidebarFilterOpen(false); }}>
                        <span>Alphabetical (Z-A)</span>
                        {podcastSortOrder === 'alphabeticalZA' && <Check size={14} className="text-primary-400" />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                className="add-podcast-button"
                onClick={() => setShowAddModal(true)}
                title="Add podcast"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {sortedPodcasts.map((podcast) => (
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

            </div>
          ))}
        </ScrollableContainer>
      </div>

      <div className="browsing-right">
        <AnimatePresence mode="wait">
          {currentPodcast ? (
            <motion.div
              key={currentPodcast.id}
              className="flex-1 flex flex-col h-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
            >
              {/* Hero Blur Background */}
              {currentPodcast.artwork_url && (
                <div
                  className="podcast-hero-background"
                  style={{ backgroundImage: `url(${currentPodcast.artwork_url})` }}
                />
              )}

              <div className="podcast-header">
                {/* Column 1: Artwork */}
                {currentPodcast.artwork_url && (
                  <motion.img
                    src={currentPodcast.artwork_url}
                    alt={currentPodcast.title}
                    className="podcast-artwork-large"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    whileHover={{ scale: 1.05, y: -5 }}
                  />
                )}

                {/* Column 2: Info & Meta */}
                <div className="podcast-header-info-col">
                  <motion.h1
                    className="podcast-title-large"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {currentPodcast.title}
                  </motion.h1>
                  <motion.p
                    className="podcast-author-large"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                  >
                    {currentPodcast.author}
                  </motion.p>

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

                  <div className="podcast-refresh-container">
                    <span className={`refresh-status-message ${showRefreshMessage ? 'highlight' : ''}`}>
                      {showRefreshMessage ? refreshMessage : `Last Updated: ${formatDate(currentPodcast.last_updated)}`}
                    </span>
                    <motion.button
                      className={`refresh-button ${isRefreshing ? 'spinning' : ''}`}
                      onClick={handleRefreshPodcast}
                      disabled={isRefreshing}
                      title="Refresh episodes"
                      whileHover={{ scale: 1.1, rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <RefreshCw size={14} />
                    </motion.button>
                  </div>
                </div>

                {/* Column 3: Description */}
                <div className="podcast-header-desc-col">
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

                  <button
                    className="delete-podcast-btn-large"
                    onClick={(e) => handleDeletePodcast(currentPodcast.id, e)}
                    title="Delete Podcast"
                  >
                    <Trash2 size={16} />
                    <span>Delete Podcast</span>
                  </button>
                </div>
              </div>

              <div className="episodes-controls">
                <div className="search-bar-wrapper">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search episodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="episode-search"
                  />
                </div>

                <div className="sidebar-filter-wrapper" ref={sortDropdownRef}>
                  <button
                    className={`sidebar-filter-btn ${isSortDropdownOpen ? 'active' : ''}`}
                    onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                    title="Sort Episodes"
                  >
                    <div className="filter-lines">
                      <div className="line line-1"></div>
                      <div className="line line-2"></div>
                      <div className="line line-3"></div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isSortDropdownOpen && (
                      <motion.div
                        className="sidebar-filter-dropdown glass-panel"
                        initial={{ opacity: 0, y: -5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        {sortOptions.map((option) => (
                          <div
                            key={option.value}
                            className="filter-option"
                            onClick={() => {
                              setSortBy(option.value);
                              setIsSortDropdownOpen(false);
                            }}
                          >
                            <span>{option.label}</span>
                            {sortBy === option.value && <Check size={14} className="text-primary-400" />}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <ScrollableContainer className="episodes-list" innerRef={scrollContainerRef} onScroll={handleScroll}>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {sortedEpisodes.slice(0, visibleCount).map((episode) => (
                    <motion.div
                      key={episode.id}
                      className="episode-item clickable"
                      onClick={() => handlePlayEpisode(episode)}
                      title="Play Episode"
                      variants={itemVariants}
                      whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.05)" }}
                      whileTap={{ scale: 0.99 }}
                      layout
                    >
                      <div className="relative group">
                        <img
                          src={episode.artwork_url || currentPodcast.artwork_url}
                          alt={episode.title}
                          className="episode-artwork-list"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-sm">
                          {/* Using a pseudo-element or separate div for play overlay on hover could go here, 
                               but simple hover scale is good for now. */}
                        </div>
                      </div>

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
                              <motion.div
                                className="progress-bar-fill"
                                initial={{ width: 0 }}
                                animate={{ width: episode.completed ? '100%' : `${(episode.current_position! / episode.duration) * 100}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
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
                    </motion.div>
                  ))}
                </motion.div>
              </ScrollableContainer>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="empty-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <Mic size={48} className="empty-icon" />
              <p>Select a podcast to view episodes</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddPodcastModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </motion.div>
  );
}

export default BrowsingView;
