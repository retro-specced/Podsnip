import { useEffect, useState, useMemo, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { Annotation } from '../../shared/types';
import '../styles/NotesView.css';
import { format } from 'date-fns';

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
    // We don't need setters, we navigate
    updateCurrentSnapshot
  } = useAppStore();

  const [filteredAnnotations, setFilteredAnnotations] = useState<EnrichedAnnotation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const episodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 1. Scroll Restoration
  useEffect(() => {
    if (scrollContainerRef.current && restoredScrollPosition !== null) {
      scrollContainerRef.current.scrollTop = restoredScrollPosition;
    }
  }, [restoredScrollPosition]); // On mount/update

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

      // Set the jump time
      setJumpToTime(annotation.start_time);

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
    <div key={annotation.id} className="note-card">
      {!compact ? (
        <div className="note-episode-info">
          {annotation.episode_artwork && (
            <img
              src={annotation.episode_artwork}
              alt={annotation.episode_title}
              className="note-episode-artwork"
            />
          )}
          <div className="note-episode-details">
            <h4 className="note-episode-title">{annotation.episode_title}</h4>
            <div className="note-timestamp">{formatTime(annotation.start_time)}</div>
          </div>
        </div>
      ) : (
        <div className="note-header-compact" style={{ marginBottom: '8px' }}>
          <div className="note-timestamp" style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
            {formatTime(annotation.start_time)}
          </div>
        </div>
      )}

      <div className="note-transcript">
        <div className="note-transcript-label">Transcript:</div>
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
            <span className="action-icon">🎧</span>
          </button>
          <button
            className="note-action-button delete"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteAnnotation(annotation.id);
            }}
            title="Delete note"
          >
            <span className="action-icon">🗑️</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Render Masonry Grid (All Notes)
  const renderMasonryGrid = () => (
    <div className="notes-masonry-grid">
      {filteredAnnotations.map((a) => renderNoteCard(a))}
    </div>
  );

  // Render Podcast List (Level 1)
  const renderPodcastList = () => (
    <div className="podcast-grid">
      {groupedPodcasts.map((group) => (
        <div
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
              <span>🎙️</span>
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
        </div>
      ))}
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
      <div className="notes-top-section">
        <div className="notes-header-row">
          <h2 className="section-title">Notes Library</h2>

          {/* View Toggle */}
          {!selectedPodcastId && (
            <div className="notes-view-toggle">
              <button
                className={`toggle-option ${viewMode === 'masonry' ? 'active' : ''}`}
                onClick={() => handleInternalNavigate('masonry')}
              >
                All Notes
              </button>
              <button
                className={`toggle-option ${viewMode === 'podcasts' ? 'active' : ''}`}
                onClick={() => handleInternalNavigate('podcasts')}
              >
                Podcasts
              </button>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="notes-controls-bar">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="notes-search"
          />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="sort-select"
            style={{ marginRight: '8px' }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="sort-select">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>

          <div className="notes-stats-small" style={{ marginLeft: 'auto' }}>
            <span className="stat-item">{groupedPodcasts.length} Podcasts</span>
            <span className="stat-separator">•</span>
            <span className="stat-item">{annotations.length} Notes</span>
          </div>
        </div>

        {/* Tag Filter Bar */}
        {uniqueTags.length > 0 && (
          <div className="tags-filter-bar">
            <div className="tags-filter-scroll">
              <button
                className={`filter-tag-chip ${selectedTags.length === 0 ? 'active' : ''}`}
                onClick={() => setSelectedTags([])}
              >
                All
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
          </div>
        )}
      </div>

      <div className="notes-content-area" ref={scrollContainerRef}>
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
      </div>
    </div>
  );
}

export default NotesView;
