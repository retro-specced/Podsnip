import { useState, useEffect } from 'react';
import '../styles/SettingsView.css';
import { ScrollableContainer } from '../components/ScrollableContainer';

import PodsnipLogo from '../assets/Podsnip.png';

function SettingsView() {
  const [localAvailable, setLocalAvailable] = useState(false);
  const [installInstructions, setInstallInstructions] = useState('');
  const [whisperPath, setWhisperPath] = useState<string | null>(null);

  useEffect(() => {
    checkLocalWhisper();
  }, []);

  const checkLocalWhisper = async () => {
    try {
      const result = await window.api.transcription.checkLocal();
      setLocalAvailable(result.available);
      setInstallInstructions(result.instructions);
      setWhisperPath(result.currentPath || null);
    } catch (error) {
      console.error('Failed to check local whisper:', error);
    }
  };

  const handleBrowseWhisper = async () => {
    try {
      const filePath = await window.api.transcription.browseForBinary();
      if (filePath) {
        const result = await window.api.transcription.setWhisperPath(filePath);
        setLocalAvailable(result.available);
        setWhisperPath(result.currentPath || null);
      }
    } catch (error) {
      console.error('Failed to set whisper path:', error);
    }
  };

  return (
    <div className="settings-view">
      <ScrollableContainer className="settings-container">
        <h1 className="settings-title">Settings</h1>

        <div className="settings-section about-section">
          <img src={PodsnipLogo} alt="Podsnip Logo" className="settings-logo" />
          <h2 className="section-title">About</h2>
          <p className="app-version">Podsnip v1.0.0</p>
          <p className="section-description">
            A podcast streaming and annotation app with local transcription.
          </p>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Transcription</h2>
          <p className="section-description">
            Podsnip uses local whisper.cpp for privacy-focused transcription.
          </p>

          {localAvailable ? (
            <div className="setting-item">
              <p className="setting-success">✅ Local Whisper is installed and ready!</p>
              <div className="whisper-path-row">
                <input
                  type="text"
                  className="whisper-path-input"
                  value={whisperPath || ''}
                  readOnly
                />
                <button className="browse-button" onClick={handleBrowseWhisper}>
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="setting-item">
              <div className="install-instructions">
                <h3>Local Whisper Not Detected</h3>
                <pre>{installInstructions}</pre>
                <div className="whisper-path-row">
                  <button className="browse-button primary" onClick={handleBrowseWhisper}>
                    Browse for whisper.cpp binary
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h2 className="section-title">Keyboard Shortcuts</h2>
          <table className="shortcuts-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><kbd>Space</kbd></td>
                <td>Play / Pause</td>
              </tr>
              <tr>
                <td><kbd>←</kbd></td>
                <td>Rewind 15s</td>
              </tr>
              <tr>
                <td><kbd>→</kbd></td>
                <td>Forward 15s</td>
              </tr>
              <tr>
                <td><kbd>s</kbd></td>
                <td>Cycle Speed (0.5x, 1x, 1.5x, 2x)</td>
              </tr>
              <tr>
                <td><kbd>n</kbd></td>
                <td>Take Note</td>
              </tr>
              <tr>
                <td><kbd>w</kbd></td>
                <td>Open Fullscreen Player</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ScrollableContainer>
    </div>
  );
}

export default SettingsView;
