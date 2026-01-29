import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Annotation } from '../../shared/types';
import '../styles/NotesView.css';

function NotesView() {
  const { annotations, setAnnotations, setError } = useAppStore();
  const [filteredAnnotations, setFilteredAnnotations] = useState<Annotation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    loadAnnotations();
  }, []);

  useEffect(() => {
    filterAndSortAnnotations();
  }, [annotations, searchQuery, sortBy]);

  const loadAnnotations = async () => {
    try {
      const allAnnotations = await window.api.annotation.list();
      setAnnotations(allAnnotations);
    } catch (error) {
      setError('Failed to load annotations');
    }
  };

  const filterAndSortAnnotations = () => {
    let filtered = [...annotations];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((annotation) =>
        annotation.note_text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    setFilteredAnnotations(filtered);
  };

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="notes-view">
      <div className="notes-left">
        <h2 className="section-title">Notes Library</h2>
        <div className="notes-controls">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="notes-search"
          />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="sort-select">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        <div className="notes-stats">
          <div className="stat">
            <span className="stat-value">{annotations.length}</span>
            <span className="stat-label">Total Notes</span>
          </div>
        </div>
      </div>

      <div className="notes-right">
        {filteredAnnotations.length > 0 ? (
          <div className="notes-list">
            {filteredAnnotations.map((annotation) => (
              <div key={annotation.id} className="note-card">
                <div className="note-header">
                  <div className="note-date">{formatDate(annotation.created_at)}</div>
                  <button
                    className="note-delete"
                    onClick={() => handleDeleteAnnotation(annotation.id)}
                    title="Delete note"
                  >
                    🗑️
                  </button>
                </div>

                <div className="note-content">{annotation.note_text}</div>

                {annotation.tags && (
                  <div className="note-tags">
                    {annotation.tags.split(',').map((tag, index) => (
                      <span key={index} className="note-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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
