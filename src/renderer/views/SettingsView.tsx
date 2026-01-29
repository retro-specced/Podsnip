import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import '../styles/SettingsView.css';

function SettingsView() {
  const { setError } = useAppStore();
  const [apiKey, setApiKey] = useState('');
  const [transcriptionMethod, setTranscriptionMethod] = useState<'openai' | 'local'>('openai');
  const [localAvailable, setLocalAvailable] = useState(false);
  const [installInstructions, setInstallInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    checkLocalWhisper();
  }, []);

  const loadSettings = async () => {
    try {
      const key = await window.api.settings.get('openai_api_key');
      if (key) {
        setApiKey(key);
      }
      
      const method = await window.api.settings.get('transcription_method');
      if (method) {
        setTranscriptionMethod(method as 'openai' | 'local');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const checkLocalWhisper = async () => {
    try {
      const result = await window.api.transcription.checkLocal();
      setLocalAvailable(result.available);
      setInstallInstructions(result.instructions);
    } catch (error) {
      console.error('Failed to check local whisper:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      if (apiKey) {
        await window.api.settings.set('openai_api_key', apiKey);
      }
      await window.api.settings.set('transcription_method', transcriptionMethod);
      alert('Settings saved successfully!');
    } catch (error) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-view">
      <div className="settings-container">
        <h1 className="settings-title">Settings</h1>

        <div className="settings-section">
          <h2 className="section-title">Transcription</h2>
          <p className="section-description">
            Choose how to transcribe podcast episodes.
          </p>

          <div className="setting-item">
            <label htmlFor="transcription-method">Transcription Method</label>
            <select
              id="transcription-method"
              value={transcriptionMethod}
              onChange={(e) => setTranscriptionMethod(e.target.value as 'openai' | 'local')}
              className="setting-input"
            >
              <option value="openai">OpenAI Whisper API (Cloud)</option>
              <option value="local" disabled={!localAvailable}>
                Local Whisper {!localAvailable && '(Not Installed)'}
              </option>
            </select>
            <p className="setting-help">
              {transcriptionMethod === 'openai' 
                ? 'Cloud-based transcription using OpenAI API (costs ~$0.36 per hour)' 
                : 'Free local transcription using whisper.cpp (slower but private)'}
            </p>
          </div>

          {transcriptionMethod === 'openai' && (
            <div className="setting-item">
              <label htmlFor="api-key">OpenAI API Key</label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="setting-input"
              />
              <p className="setting-help">
                Get your API key from{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                  OpenAI Dashboard
                </a>
              </p>
            </div>
          )}

          {transcriptionMethod === 'local' && !localAvailable && (
            <div className="setting-item">
              <div className="install-instructions">
                <h3>Local Whisper Not Installed</h3>
                <pre>{installInstructions}</pre>
              </div>
            </div>
          )}

          {transcriptionMethod === 'local' && localAvailable && (
            <div className="setting-item">
              <p className="setting-success">✅ Local Whisper is installed and ready to use!</p>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h2 className="section-title">About</h2>
          <p className="section-description">Podsnip v0.1.0</p>
          <p className="section-description">
            A podcast annotation and streaming app for Linux.
          </p>
        </div>

        <div className="settings-actions">
          <button className="save-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
