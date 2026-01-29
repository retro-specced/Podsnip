import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/AnnotationView.css';

function AnnotationView() {
  const { selectedTranscript, setCurrentState, setError } = useAppStore();
  const [noteText, setNoteText] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!selectedTranscript) {
    return (
      <div className="annotation-view">
        <div className="empty-state">No transcript segment selected</div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!noteText.trim()) {
      setError('Please enter a note');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const tagArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      await window.api.annotation.create({
        transcriptId: selectedTranscript.id,
        noteText: noteText.trim(),
        tags: tagArray.length > 0 ? tagArray : undefined,
      });

      // Return to player view
      setCurrentState('player');
    } catch (error) {
      setError('Failed to save annotation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCurrentState('player');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="annotation-view">
      <div className="annotation-container">
        <div className="annotation-header">
          <h2>Add Note</h2>
          <button className="close-button" onClick={handleCancel}>
            ✕
          </button>
        </div>

        <div className="selected-segment">
          <div className="segment-timestamp">
            {formatTime(selectedTranscript.start_time)} - {formatTime(selectedTranscript.end_time)}
          </div>
          <div className="segment-text-display">{selectedTranscript.text}</div>
        </div>

        <div className="annotation-form">
          <label htmlFor="note-text">Your Note</label>
          <textarea
            id="note-text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write your thoughts, insights, or reflections..."
            className="note-textarea"
            rows={8}
            autoFocus
          />
          <div className="character-count">{noteText.length} characters</div>

          <label htmlFor="tags">Tags (optional)</label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="idea, important, research (comma-separated)"
            className="tags-input"
          />

          <div className="annotation-actions">
            <button className="cancel-button" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </button>
            <button className="save-button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnnotationView;
