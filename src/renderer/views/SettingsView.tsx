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
