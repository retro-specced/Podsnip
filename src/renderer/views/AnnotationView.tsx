import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/AnnotationView.css';

function AnnotationView() {
  const {
    selectedSegments,
    clearSelectedSegments,
    setError,
    setShowSaveToast,
    annotationSource,
    setPendingScrollTarget,
    setIsAutoScrollEnabled,
    navigateBack,
    setAnnotationSource
  } = useAppStore();
  const [noteText, setNoteText] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Combine selected segments for display
  const combinedText = selectedSegments.map(s => s.text).join(' ');
  const startTime = selectedSegments[0].start_time;
  const endTime = selectedSegments[selectedSegments.length - 1].end_time;
  // Use the first segment's ID for the annotation
  const primaryTranscriptId = selectedSegments[0].id;

  // Helper to handle navigation logic on exit
  const handleExit = (saved: boolean) => {
    // If we have a source, use it to determine behavior
    if (annotationSource?.view === 'player') {
      if (saved) {
        // Rule 6: Synced up, Auto-scroll ON, Clear selection
        setIsAutoScrollEnabled(true);
        clearSelectedSegments();
      } else {
        // Rule 5: Paused, Scrolled to capture time, Keep selection
        setIsAutoScrollEnabled(false);
        setPendingScrollTarget(annotationSource.captureTime);
        // Do NOT clear selected segments
      }
    } else {
      // Source was something else (e.g. Browsing) -> Just go back
      // Rule 3 & 4 Restored logic
      clearSelectedSegments();
    }

    // Clear source context
    setAnnotationSource(null);
    navigateBack();
  };

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
        transcriptId: primaryTranscriptId,
        noteText: noteText.trim(),
        transcriptText: combinedText,
        startTime: startTime,
        endTime: endTime,
        tags: tagArray.length > 0 ? tagArray : undefined,
      });

      setShowSaveToast(true);
      handleExit(true); // SAVED = true
    } catch (error) {
      setError('Failed to save annotation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    handleExit(false); // SAVED = false
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

        <div className="annotation-body">
          <div className="selected-segment">
            <div className="segment-timestamp">
              {formatTime(startTime)} - {formatTime(endTime)}
              {selectedSegments.length > 1 && (
                <span className="segment-count"> ({selectedSegments.length} segments)</span>
              )}
            </div>
            <div className="segment-text-display">{combinedText}</div>
          </div>

          <div className="annotation-form">
            <label htmlFor="note-text">Your Note</label>
            <textarea
              id="note-text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your thoughts..."
              className="note-textarea"
              rows={5}
              autoFocus
            />
            {/* Character count reduced/hidden to save space or made smaller? Keeping it for now. */}

            <label htmlFor="tags" style={{ marginTop: '12px' }}>Tags</label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="idea, important..."
              className="tags-input"
            />

            <div className="annotation-actions">
              <button className="cancel-button" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </button>
              <button className="save-button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnnotationView;
