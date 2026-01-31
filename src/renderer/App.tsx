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

function App() {
  const {
    currentState,
    podcasts,
    setPodcasts,
    navigateToView,
    viewingEpisode,
    playingEpisode
  } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Load podcasts on app start
    loadPodcasts();
  }, []);

  const loadPodcasts = async () => {
    try {
      const podcasts = await window.api.podcast.list();
      setPodcasts(podcasts);

      // If we have podcasts, move to browsing state and REPLACE history
      if (podcasts.length > 0 && currentState === 'onboarding') {
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
  // Hide it if we are on the Player View for the SAME episode.
  const hasPlayerBar = !!playingEpisode && !(currentState === 'player' && viewingEpisode?.id === playingEpisode.id);

  return (
    <div className={`app ${hasPlayerBar ? 'has-player-bar' : ''}`}>
      <GlobalAudioController />
      {currentState !== 'onboarding' && <TopBar />}
      <div className="main-content">
        <ErrorBanner />
        {renderView()}
      </div>
      {hasPlayerBar && <PersistentPlayerBar />}
    </div>
  );
}

export default App;
