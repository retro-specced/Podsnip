import { useState, useEffect } from 'react';
import '../styles/SettingsView.css';

function SettingsView() {
  const [localAvailable, setLocalAvailable] = useState(false);
  const [installInstructions, setInstallInstructions] = useState('');

  useEffect(() => {
    checkLocalWhisper();
  }, []);

  const checkLocalWhisper = async () => {
    try {
      const result = await window.api.transcription.checkLocal();
      setLocalAvailable(result.available);
      setInstallInstructions(result.instructions);
    } catch (error) {
      console.error('Failed to check local whisper:', error);
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>

        <div className="settings-section">
          <h2 className="section-title">Transcription</h2>
          <p className="section-description">
            Podsnip uses local whisper.cpp for privacy-focused transcription.
          </p>

          {localAvailable ? (
            <div className="setting-item">
              <p className="setting-success">✅ Local Whisper is installed and ready to use!</p>
            </div>
          ) : (
            <div className="setting-item">
              <div className="install-instructions">
                <h3>Local Whisper Not Installed</h3>
                <pre>{installInstructions}</pre>
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

        <div className="settings-section">
          <h2 className="section-title">About</h2>
          <p className="section-description">Podsnip v0.1.0</p>
          <p className="section-description">
            A podcast annotation and streaming app for Linux with local transcription.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
