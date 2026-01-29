import { useAppStore } from '../store/appStore';
import '../styles/ErrorBanner.css';

function ErrorBanner() {
  const { error, setError } = useAppStore();

  if (!error) return null;

  return (
    <div className="error-banner">
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <span className="error-message">{error}</span>
      </div>
      <button className="error-close" onClick={() => setError(null)}>
        ✕
      </button>
    </div>
  );
}

export default ErrorBanner;
