import { useEffect, useState, useMemo, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { Annotation } from '../../shared/types';
import '../styles/NotesView.css';
import { format } from 'date-fns';
import { ScrollableContainer } from '../components/ScrollableContainer';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronDown,
  Check,
  Filter,
  LayoutGrid,
  List,
  Calendar,
  Clock,
  ArrowUpDown,
  Trash2,
  Headphones
} from 'lucide-react';


interface EnrichedAnnotation extends Annotation {
  transcript_text: string;
  start_time: number;
  end_time: number;
  episode_title: string;
  episode_artwork: string;
  episode_id: number;
  podcast_title?: string;
  podcast_id?: number;
  podcast_artwork?: string;
}

interface PodcastGroup {
  podcastId: number;
  podcastTitle: string;
  artworkUrl: string;
  annotations: EnrichedAnnotation[];
}

function NotesView() {
  const {
    annotations,
    setAnnotations,
    setError,
    viewingEpisode,
    setViewingEpisode,
    setPlayingEpisode,
    setJumpToTime,
    setCurrentPodcast,
    setEpisodes,
    navigateToView,
    notesViewMode,
    notesSelectedPodcastId,
    restoredScrollPosition,
    updateCurrentSnapshot,
    setIsAutoScrollEnabled,
    setSelectedSegments,
    setPendingScrollTarget
  } = useAppStore();

  const [filteredAnnotations, setFilteredAnnotations] = useState<EnrichedAnnotation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // UI State for Custom Dropdowns
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const episodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 1. Scroll Restoration
  useEffect(() => {
    if (scrollContainerRef.current && restoredScrollPosition !== null) {
      scrollContainerRef.current.scrollTop = restoredScrollPosition;
    }
  }, [restoredScrollPosition]); // On mount/update

  // Click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(target)) {
        setIsTimeDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setIsSortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 2. Navigation Helper
  const handleInternalNavigate = (mode: 'masonry' | 'podcasts', podcastId: number | null = null) => {
    // Capture curent scroll
    if (scrollContainerRef.current) {
      updateCurrentSnapshot({ scrollPosition: scrollContainerRef.current.scrollTop });
    }

    // Navigate (Push to history)
    navigateToView('notes', {
      notesViewMode: mode,
      notesSelectedPodcastId: podcastId
    });
  };

  const selectedPodcastId = notesSelectedPodcastId;
  const viewMode = notesViewMode;

  // Scroll to deep-linked episode if present
  useEffect(() => {
    if (selectedPodcastId && viewingEpisode?.id && viewMode === 'podcasts') {
      // Wait for render
      setTimeout(() => {
        const element = episodeRefs.current[viewingEpisode.id];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [selectedPodcastId, viewingEpisode?.id, viewMode, filteredAnnotations]);

  useEffect(() => {
    loadAnnotations();
  }, []);

  useEffect(() => {
    filterAndSortAnnotations();
  }, [annotations, searchQuery, sortBy, selectedTags, timeRange]);

  const loadAnnotations = async () => {
    try {
      const allAnnotations = await window.api.annotation.list();
      setAnnotations(allAnnotations);
    } catch (error) {
      setError('Failed to load annotations');
    }
  };

  const filterAndSortAnnotations = () => {
    // Cast to EnrichedAnnotation[] since we know the backend returns these fields
    let filtered = [...annotations] as EnrichedAnnotation[];

    // Filter by search query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter((annotation) =>
        annotation.note_text.toLowerCase().includes(lowerQuery) ||
        annotation.transcript_text.toLowerCase().includes(lowerQuery) ||
        annotation.episode_title.toLowerCase().includes(lowerQuery) ||
        (annotation.podcast_title && annotation.podcast_title.toLowerCase().includes(lowerQuery)) ||
        (annotation.tags && annotation.tags.toLowerCase().includes(lowerQuery))
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter((annotation) => {
        if (!annotation.tags) return false;
        const noteTags = annotation.tags.split(',').map(t => t.trim());
        // AND logic: Note must contain ALL selected tags
        return selectedTags.every(tag => noteTags.includes(tag));
      });
    }

    // Filter by Time Range
    if (timeRange !== 'all') {
      const now = new Date();
      filtered = filtered.filter(annotation => {
        const date = new Date(annotation.created_at);
        const diffTime = now.getTime() - date.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (timeRange === 'today') return diffDays < 1 && now.getDate() === date.getDate();
        if (timeRange === 'week') return diffDays < 7;
        if (timeRange === 'month') return diffDays < 30;
        if (timeRange === 'year') return diffDays < 365;
        return true;
      });
    }

    // Sort
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    setFilteredAnnotations(filtered);
  };

  // Extract unique tags
  const uniqueTags = useMemo(() => {
    const allTags = new Set<string>();
    annotations.forEach(a => {
      if (a.tags) {
        a.tags.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed) allTags.add(trimmed);
        });
      }
    });
    return Array.from(allTags).sort();
  }, [annotations]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Group annotations by podcast
  const groupedPodcasts = useMemo(() => {
    const groups: Record<number, PodcastGroup> = {};

    filteredAnnotations.forEach((annotation) => {
      // Use podcast_id if available, fallback to 0 or generic grouping if missing
      // (The backend update should ensure podcast_id is present)
      const pId = annotation.podcast_id || 0;
      const pTitle = annotation.podcast_title || 'Unknown Podcast';

      const artwork = annotation.podcast_artwork || annotation.episode_artwork || '';

      if (!groups[pId]) {
        groups[pId] = {
          podcastId: pId,
          podcastTitle: pTitle,
          artworkUrl: artwork,
          annotations: [],
        };
      }
      groups[pId].annotations.push(annotation);
    });

    return Object.values(groups).sort((a, b) => {
      // Sort groups by latest annotation
      const aLatest = Math.max(...a.annotations.map(n => new Date(n.created_at).getTime()));
      const bLatest = Math.max(...b.annotations.map(n => new Date(n.created_at).getTime()));
      return bLatest - aLatest;
    });
  }, [filteredAnnotations]);

  const handleDeleteAnnotation = async (annotationId: number) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await window.api.annotation.delete(annotationId);
      loadAnnotations();
    } catch (error) {
      setError('Failed to delete annotation');
    }
  };

  const handleJumpToPodcast = async (annotation: EnrichedAnnotation) => {
    try {
      // Get the episode
      const episode = await window.api.episode.get(annotation.episode_id);

      // Get the podcast for this episode
      const podcast = await window.api.podcast.get(episode.podcast_id);

      // Load all episodes for the podcast
      const episodes = await window.api.episode.list(podcast.id);

      // Set the current podcast and episodes
      setCurrentPodcast(podcast);
      setEpisodes(episodes);

      // Set the viewing episode
      setViewingEpisode(episode);

      // Set the playing episode to actually start audio
      setPlayingEpisode(episode);

      // Set the jump time (for audio playback)
      setJumpToTime(annotation.start_time);

      // Rule: Auto-scroll PAUSED, Highlight Segments
      setIsAutoScrollEnabled(false);
      setPendingScrollTarget(annotation.start_time);

      // Construct a temporary segment for highlighting
      // (The ID doesn't strictly matter for display highlighting unless we match against loaded transcripts)
      // Actually, PlayerView highlights based on ID match in `isSegmentSelected`.
      // If the ID is -1, it won't match the loaded transcript list IDs.
      // BUT, `AnnotationView` simply DISPLAYS `selectedSegments`.
      // PlayerView displays `selectedSegments` in the toolbar/overlay?
      // No, PlayerView adds `.selected` class to segments in the list using `isSegmentSelected`.
      // If we want the segment in the list to be highlighted, we must match the ID.
      // We don't have the ID here reliably (annotations table might not store segment ID).
      // `EnrichedAnnotation` has `transcript_text` but maybe not `transcript_id`?
      // Wait, `AnnotationView.tsx` creates annotation with `transcriptId: primaryTranscriptId`.
      // `Annotation` type has `transcript_id`.
      // So `EnrichedAnnotation` should inherit it.
      // Let's modify the type locally or cast if needed. 
      // Assuming `annotation.transcript_id` exists (it should).
      const transcriptId = (annotation as any).transcript_id || -1;

      setSelectedSegments([{
        id: transcriptId,
        episode_id: annotation.episode_id,
        start_time: annotation.start_time,
        end_time: annotation.end_time,
        text: annotation.transcript_text,
        segment_index: -1,
        confidence_score: 1.0
      }]);

      // Capture scroll before navigating away
      if (scrollContainerRef.current) {
        updateCurrentSnapshot({ scrollPosition: scrollContainerRef.current.scrollTop });
      }

      // Navigate to player view using unified navigation
      navigateToView('player', { episodeId: episode.id, podcastId: podcast.id });
    } catch (error) {
      setError('Failed to jump to podcast');
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderNoteCard = (annotation: EnrichedAnnotation, compact: boolean = false) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      key={annotation.id}
      className="note-card glass-panel"
    >
      {!compact ? (
        <div className="note-episode-info">
          {annotation.episode_artwork ? (
            <img
              src={annotation.episode_artwork}
              alt={annotation.episode_title}
              className="note-episode-artwork"
            />
          ) : (
            <div className="note-episode-artwork-placeholder">
              <Headphones size={20} />
            </div>
          )}
          <div className="note-episode-details">
            <h4 className="note-episode-title">{annotation.episode_title}</h4>
            <div className="note-timestamp">{formatTime(annotation.start_time)}</div>
          </div>
        </div>
      ) : (
        <div className="note-header-compact" style={{ marginBottom: '8px' }}>
          <div className="note-timestamp" style={{ fontSize: '0.85em', color: 'var(--primary-color)' }}>
            {formatTime(annotation.start_time)}
          </div>
        </div>
      )}

      <div className="note-transcript">
        <div className="note-transcript-text">"{annotation.transcript_text}"</div>
      </div>

      <div className="note-content">{annotation.note_text}</div>

      {annotation.tags && (
        <div className="note-tags">
          {annotation.tags.split(',').filter(t => t.trim()).map((tag, index) => (
            <span key={index} className="note-tag">
              #{tag.trim()}
            </span>
          ))}
        </div>
      )}

      <div className="note-footer">
        <div className="note-meta-left">
          <div className="note-date">{formatDate(annotation.created_at)}</div>
        </div>

        <div className="note-actions">
          <button
            className="note-action-button"
            onClick={() => handleJumpToPodcast(annotation)}
            title="Jump to podcast"
          >
            <Headphones size={14} />
          </button>
          <button
            className="note-action-button delete"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteAnnotation(annotation.id);
            }}
            title="Delete note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );

  // Render Masonry Grid (All Notes)
  const renderMasonryGrid = () => (
    <div className="notes-masonry-grid">
      <AnimatePresence mode='popLayout'>
        {filteredAnnotations.map((a) => renderNoteCard(a))}
      </AnimatePresence>
    </div>
  );

  // Render Podcast List (Level 1)
  const renderPodcastList = () => (
    <div className="podcast-grid">
      <AnimatePresence mode='popLayout'>
        {groupedPodcasts.map((group) => (
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            key={group.podcastId}
            className="podcast-notes-card"
            onClick={() => handleInternalNavigate('podcasts', group.podcastId)}
          >
            {group.artworkUrl ? (
              <div className="podcast-notes-artwork-container">
                <img src={group.artworkUrl} alt={group.podcastTitle} className="podcast-notes-artwork" />
              </div>
            ) : (
              <div className="podcast-notes-artwork-placeholder">
                <Headphones size={48} />
              </div>
            )}

            <div className="podcast-notes-info">
              <h3 className="podcast-notes-title">{group.podcastTitle}</h3>
              <div className="podcast-notes-footer">
                <span className="podcast-notes-count">{group.annotations.length} Notes</span>
                <div className="podcast-last-updated">
                  Last edited {formatDate(group.annotations[0].created_at)}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  // Render Notes List for Selected Podcast (Level 2)
  const renderNotesList = () => {
    const group = groupedPodcasts.find(g => g.podcastId === selectedPodcastId);
    if (!group) return null;

    // Group by Episode
    const episodeGroups: Record<number, { title: string; annotations: EnrichedAnnotation[] }> = {};
    group.annotations.forEach(note => {
      if (!episodeGroups[note.episode_id]) {
        episodeGroups[note.episode_id] = {
          title: note.episode_title,
          annotations: []
        };
      }
      episodeGroups[note.episode_id].annotations.push(note);
    });

    // Sort episodes by latest note (or maybe episode release? let's stick to note creation for now or keep existing order)
    // The main annotations list is already sorted by date, so we just follow the insertion order
    const sortedEpisodeIds = Object.keys(episodeGroups).sort((a, b) => {
      // Sort by most recent note in the episode
      const aTime = Math.max(...episodeGroups[Number(a)].annotations.map(n => new Date(n.created_at).getTime()));
      const bTime = Math.max(...episodeGroups[Number(b)].annotations.map(n => new Date(n.created_at).getTime()));
      return bTime - aTime;
    });

    return (
      <div className="notes-list-container">
        <div className="notes-header-row">
          <button
            className="back-to-podcasts-button"
            onClick={() => handleInternalNavigate('podcasts', null)}
          >
            ← Back to Library
          </button>
          <h2 className="section-title" style={{ margin: 0 }}>{group.podcastTitle}</h2>
        </div>

        <div className="notes-list-by-episode">
          {sortedEpisodeIds.map((epId) => {
            const epGroup = episodeGroups[Number(epId)];
            return (
              <div
                key={epId}
                className="episode-notes-group-split"
                ref={(el) => (episodeRefs.current[Number(epId)] = el)}
              >
                <div className="episode-info-sidebar">
                  <div className="episode-sidebar-artwork-container">
                    {epGroup.annotations[0].episode_artwork ? (
                      <img
                        src={epGroup.annotations[0].episode_artwork}
                        alt={epGroup.title}
                        className="episode-sidebar-artwork"
                      />
                    ) : (
                      <div className="episode-sidebar-placeholder">🎙️</div>
                    )}
                  </div>
                  <div className="episode-sidebar-details">
                    <h3 className="episode-sidebar-title">{epGroup.title}</h3>
                    <div className="episode-sidebar-meta">
                      {epGroup.annotations.length} Note{epGroup.annotations.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="episode-notes-masonry">
                  {epGroup.annotations.map((a) => renderNoteCard(a, true))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="notes-view">
      {/* Top Section */}
      {/* Top Section */}
      <div className="notes-top-section">
        <div className="notes-header-row">
          <h2 className="section-title">Notes Library</h2>

          {/* View Toggle - Segmented Control */}
          {!selectedPodcastId && (
            <div className="notes-view-toggle">
              <button
                className={`toggle-option ${viewMode === 'masonry' ? 'active' : ''}`}
                onClick={() => handleInternalNavigate('masonry')}
              >
                <LayoutGrid size={14} />
                <span>All Notes</span>
                {viewMode === 'masonry' && (
                  <motion.div
                    layoutId="toggle-active"
                    className="toggle-active-bg"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                className={`toggle-option ${viewMode === 'podcasts' ? 'active' : ''}`}
                onClick={() => handleInternalNavigate('podcasts')}
              >
                <List size={14} />
                <span>By Podcast</span>
                {viewMode === 'podcasts' && (
                  <motion.div
                    layoutId="toggle-active"
                    className="toggle-active-bg"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="notes-controls-bar">
          <div className="notes-search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="notes-search-input"
            />
          </div>

          <div className="notes-filters-group">
            {/* Time Range Dropdown */}
            <div className="custom-dropdown-wrapper" ref={timeDropdownRef}>
              <button
                className={`custom-dropdown-trigger ${isTimeDropdownOpen ? 'active' : ''} ${timeRange !== 'all' ? 'has-value' : ''}`}
                onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
              >
                <Clock size={14} />
                <span>
                  {timeRange === 'all' && 'All Time'}
                  {timeRange === 'today' && 'Today'}
                  {timeRange === 'week' && 'This Week'}
                  {timeRange === 'month' && 'This Month'}
                  {timeRange === 'year' && 'This Year'}
                </span>
                <ChevronDown size={14} className={`dropdown-arrow ${isTimeDropdownOpen ? 'open' : ''}`} />
              </button>

              <AnimatePresence>
                {isTimeDropdownOpen && (
                  <motion.div
                    className="custom-dropdown-menu glass-panel"
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    {[
                      { value: 'all', label: 'All Time' },
                      { value: 'today', label: 'Today' },
                      { value: 'week', label: 'This Week' },
                      { value: 'month', label: 'This Month' },
                      { value: 'year', label: 'This Year' },
                    ].map((opt) => (
                      <div
                        key={opt.value}
                        className={`dropdown-option ${timeRange === opt.value ? 'selected' : ''}`}
                        onClick={() => {
                          setTimeRange(opt.value as any);
                          setIsTimeDropdownOpen(false);
                        }}
                      >
                        {opt.label}
                        {timeRange === opt.value && <Check size={14} className="text-primary-400" />}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sort Dropdown */}
            <div className="custom-dropdown-wrapper" ref={sortDropdownRef}>
              <button
                className={`custom-dropdown-trigger ${isSortDropdownOpen ? 'active' : ''}`}
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              >
                <ArrowUpDown size={14} />
                <span>{sortBy === 'newest' ? 'Newest' : 'Oldest'}</span>
                <ChevronDown size={14} className={`dropdown-arrow ${isSortDropdownOpen ? 'open' : ''}`} />
              </button>

              <AnimatePresence>
                {isSortDropdownOpen && (
                  <motion.div
                    className="custom-dropdown-menu glass-panel"
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div
                      className={`dropdown-option ${sortBy === 'newest' ? 'selected' : ''}`}
                      onClick={() => {
                        setSortBy('newest');
                        setIsSortDropdownOpen(false);
                      }}
                    >
                      Newest First
                      {sortBy === 'newest' && <Check size={14} className="text-primary-400" />}
                    </div>
                    <div
                      className={`dropdown-option ${sortBy === 'oldest' ? 'selected' : ''}`}
                      onClick={() => {
                        setSortBy('oldest');
                        setIsSortDropdownOpen(false);
                      }}
                    >
                      Oldest First
                      {sortBy === 'oldest' && <Check size={14} className="text-primary-400" />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tag Filter Bar */}
        <AnimatePresence>
          {uniqueTags.length > 0 && (
            <motion.div
              className="tags-filter-bar"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="tags-filter-scroll">
                <button
                  className={`filter-tag-chip ${selectedTags.length === 0 ? 'active' : ''}`}
                  onClick={() => setSelectedTags([])}
                >
                  Running
                </button>
                {uniqueTags.map(tag => (
                  <button
                    key={tag}
                    className={`filter-tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Line */}
        <div className="notes-stats-line">
          showing {filteredAnnotations.length} note{filteredAnnotations.length !== 1 && 's'} across {groupedPodcasts.length} podcast{groupedPodcasts.length !== 1 && 's'}
        </div>
      </div>

      <ScrollableContainer className="notes-content-area" innerRef={scrollContainerRef}>
        {filteredAnnotations.length > 0 ? (
          viewMode === 'masonry' ? (
            renderMasonryGrid()
          ) : (
            selectedPodcastId ? renderNotesList() : renderPodcastList()
          )
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No notes yet</h3>
            <p>Start annotating podcast episodes to see your notes here</p>
          </div>
        )}
      </ScrollableContainer>
    </div>
  );
}

export default NotesView;
