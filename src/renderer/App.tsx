import { useEffect } from 'react';
import { useAppStore } from './store/appStore';
import OnboardingView from './views/OnboardingView';
import BrowsingView from './views/BrowsingView';
import PlayerView from './views/PlayerView';
import AnnotationView from './views/AnnotationView';
import NotesView from './views/NotesView';
import SettingsView from './views/SettingsView';
import Sidebar from './components/Sidebar';
import ErrorBanner from './components/ErrorBanner';
import './styles/App.css';

function App() {
  const { currentState, podcasts, setPodcasts, setCurrentState } = useAppStore();

  useEffect(() => {
    // Load podcasts on app start
    loadPodcasts();
  }, []);

  const loadPodcasts = async () => {
    try {
      const podcasts = await window.api.podcast.list();
      setPodcasts(podcasts);
      
      // If we have podcasts, move to browsing state
      if (podcasts.length > 0 && currentState === 'onboarding') {
        setCurrentState('browsing');
      }
    } catch (error) {
      console.error('Failed to load podcasts:', error);
    }
  };

  const renderView = () => {
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

  return (
    <div className="app">
      {currentState !== 'onboarding' && <Sidebar />}
      <div className="main-content">
        <ErrorBanner />
        {renderView()}
      </div>
    </div>
  );
}

export default App;
