import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import OnboardingView from './views/OnboardingView';
import BrowsingView from './views/BrowsingView';
import PlayerView from './views/PlayerView';
import AnnotationView from './views/AnnotationView';
import NotesView from './views/NotesView';
import SettingsView from './views/SettingsView';
import TopBar from './components/TopBar';
import ErrorBanner from './components/ErrorBanner';
import './styles/App.css';

import GlobalAudioController from './components/GlobalAudioController';
import PersistentPlayerBar from './components/PersistentPlayerBar';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

function App() {
  const {
    currentState,
    setPodcasts,
    navigateToView,

    playingEpisode
  } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize global keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    // Load podcasts on app start
    loadPodcasts();
  }, []);

  const loadPodcasts = async () => {
    try {
      const podcasts = await window.api.podcast.list();
      setPodcasts(podcasts);

      // Robustness: Check for invalid state (e.g. Player View with no Episode)
      // This recovers the app if a bug landed the user in a broken persisted state.
      const state = useAppStore.getState();
      if (state.currentState === 'player' && !state.viewingEpisode) {
        console.warn("Detected invalid Player View state. Resetting to Browsing.");
        navigateToView('browsing', { replace: true });
        // We do not return here, we let the rest of the flow continue (browsing view logic)
      } else if (podcasts.length > 0 && currentState === 'onboarding') {
        // Normal Onboarding -> Browsing flow
        navigateToView('browsing', { replace: true });
      }

      // Check for updates once at startup
      triggerAutoRefresh();
    } catch (error) {
      console.error('Failed to load podcasts:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.body.classList.add('using-keyboard');
      }
    };
    const handleMouseDown = () => {
      document.body.classList.remove('using-keyboard');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const triggerAutoRefresh = async () => {
    try {
      await window.api.podcast.refreshAll();
      // Reload podcasts to get updated has_new status
      const updatedPodcasts = await window.api.podcast.list();
      setPodcasts(updatedPodcasts);
    } catch (err) {
      console.error('Auto-refresh failed:', err);
    }
  };

  const renderView = () => {
    if (isInitializing) {
      return (
        <div className="empty-state">
          <div className="spinner"></div>
        </div>
      );
    }

    switch (currentState) {
      case 'onboarding':
        return <OnboardingView />;
      case 'browsing':
        return <BrowsingView />;
      case 'player':
        return <PlayerView />;
      case 'annotation':
        return <AnnotationView />;
      case 'notes':
        return <NotesView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <OnboardingView />;
    }
  };

  // Show player bar if we have a playing episode.
  // We now keep it visible even in Player View (it transforms).
  const hasPlayerBar = !!playingEpisode;

  return (
    <div className={`app ${hasPlayerBar ? 'has-player-bar' : ''}`}>
      <GlobalAudioController />
      {currentState !== 'onboarding' && <TopBar />}
      <div className="main-content">
        <ErrorBanner />
        <ErrorBoundary>
          {renderView()}
        </ErrorBoundary>
      </div>
      {playingEpisode && <PersistentPlayerBar visible={hasPlayerBar} />}
      <Toast />
    </div>
  );
}

export default App;
