import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { Transcript } from '../../shared/types';
import '../styles/PlayerView.css';

function PlayerView() {
  const {
    currentEpisode,
    transcripts,
    isPlaying,
    currentTime,
    playbackSpeed,
    setTranscripts,
    setIsPlaying,
    setCurrentTime,
    setPlaybackSpeed,
    setSelectedTranscript,
    setCurrentState,
    setError,
  } = useAppStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (currentEpisode) {
      setAudioError(null);
      loadTranscript();
      loadPlaybackState();
      
      // Load audio
      if (audioRef.current) {
        audioRef.current.load();
      }
    }
  }, [currentEpisode]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    // Auto-scroll to active segment
    const activeElement = document.querySelector('.transcript-segment.active');
    if (activeElement && transcriptContainerRef.current) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSegmentIndex]);

  const loadTranscript = async () => {
    if (!currentEpisode) return;

    try {
      const existingTranscript = await window.api.transcription.get(currentEpisode.id);
      
      if (existingTranscript.length > 0) {
        setTranscripts(existingTranscript);
      }
      // Don't auto-transcribe - let user click the button
    } catch (error) {
      console.error('Failed to load transcript:', error);
    }
  };

  const startTranscription = async () => {
    if (!currentEpisode) return;
    
    setIsTranscribing(true);
    setError(null);
    
    try {
      await window.api.transcription.create(currentEpisode.id, currentEpisode.audio_url);
      
      // Reload transcript after creation
      const newTranscript = await window.api.transcription.get(currentEpisode.id);
      setTranscripts(newTranscript);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to transcribe episode');
    } finally {
      setIsTranscribing(false);
    }
  };

  const loadPlaybackState = async () => {
    if (!currentEpisode || !audioRef.current) return;

    try {
      const state = await window.api.playback.get(currentEpisode.id);
      if (state) {
        audioRef.current.currentTime = state.current_position;
        setPlaybackSpeed(state.playback_speed);
      }
    } catch (error) {
      console.error('Failed to load playback state:', error);
    }
  };

  const savePlaybackState = async () => {
    if (!currentEpisode || !audioRef.current) return;

    try {
      await window.api.playback.save(
        currentEpisode.id,
        audioRef.current.currentTime,
        playbackSpeed
      );
    } catch (error) {
      console.error('Failed to save playback state:', error);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;

    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    // Find active transcript segment
    const activeIndex = transcripts.findIndex(
      (segment) => time >= segment.start_time && time <= segment.end_time
    );
    if (activeIndex !== -1) {
      setActiveSegmentIndex(activeIndex);
    }

    // Periodically save playback state
    if (Math.floor(time) % 5 === 0) {
      savePlaybackState();
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime += seconds;
  };

  const handleSegmentClick = (segment: Transcript) => {
    if (!audioRef.current) return;
    
    // Jump to timestamp
    audioRef.current.currentTime = segment.start_time;
    
    // Pause and enter annotation mode
    audioRef.current.pause();
    setIsPlaying(false);
    setSelectedTranscript(segment);
    setCurrentState('annotation');
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

  if (!currentEpisode) {
    return (
      <div className="player-view">
        <div className="empty-state">No episode selected</div>
      </div>
    );
  }

  return (
    <div className="player-view">
      <div className="player-left">
        <div className="player-container">
          {currentEpisode && currentEpisode.artwork_url && (
            <img
              src={currentEpisode.artwork_url}
              alt="Episode artwork"
              className="player-artwork"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          
          <h2 className="player-episode-title">{currentEpisode.title}</h2>
          
          <audio
            ref={audioRef}
            src={currentEpisode.audio_url}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              setIsPlaying(false);
              savePlaybackState();
            }}
            onError={(e) => {
              console.error('Audio error:', e);
              setAudioError('Failed to load audio. The episode may not be available or there may be a network issue.');
              setIsPlaying(false);
            }}
            onLoadedMetadata={() => {
              console.log('Audio loaded successfully');
              setAudioError(null);
            }}
            crossOrigin="anonymous"
          />

          {audioError && (
            <div className="audio-error">
              ⚠️ {audioError}
            </div>
          )}

          <div className="playback-controls">
            <button className="control-button" onClick={() => handleSkip(-15)}>
              ⏮ 15s
            </button>
            <button className="control-button-large" onClick={handlePlayPause}>
              {isPlaying ? '⏸' : '▶️'}
            </button>
            <button className="control-button" onClick={() => handleSkip(15)}>
              15s ⏭
            </button>
          </div>

          <div className="playback-progress">
            <span className="time-label">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={currentEpisode.duration || 100}
              value={currentTime}
              onChange={(e) => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Number(e.target.value);
                }
              }}
              className="progress-slider"
            />
            <span className="time-label">{formatTime(currentEpisode.duration)}</span>
          </div>

          <div className="playback-speed">
            <label>Speed:</label>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="speed-select"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="1.75">1.75x</option>
              <option value="2">2x</option>
            </select>
          </div>
        </div>
      </div>

      <div className="player-right" ref={transcriptContainerRef}>
        <div className="transcript-header">
          <h3>Transcript</h3>
          {isTranscribing && <span className="transcribing-badge">Transcribing...</span>}
        </div>

        <div className="transcript-container">
          {isTranscribing ? (
            <div className="transcript-loading">
              <div className="spinner"></div>
              <p>Generating transcript... This may take a few minutes.</p>
            </div>
          ) : transcripts.length > 0 ? (
            <div className="transcript-segments">
              {transcripts.map((segment, index) => (
                <div
                  key={segment.id}
                  className={`transcript-segment ${index === activeSegmentIndex ? 'active' : ''} ${
                    index < activeSegmentIndex ? 'past' : ''
                  } ${index > activeSegmentIndex ? 'future' : ''}`}
                  onClick={() => handleSegmentClick(segment)}
                >
                  <span className="segment-time">{formatTime(segment.start_time)}</span>
                  <span className="segment-text">{segment.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="transcript-empty">
              <p>No transcript available yet.</p>
              <p className="transcript-note">Click the button below to generate a transcript using Whisper AI.</p>
              <button className="generate-transcript-button" onClick={startTranscription}>
                Generate Transcript
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayerView;
