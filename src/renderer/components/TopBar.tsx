import { useAppStore } from '../store/appStore';
import '../styles/TopBar.css';
import TranscriptionStatusBubble from './TranscriptionStatusBubble';
import { ChevronLeft, ChevronRight, Library, NotebookPen, Settings } from 'lucide-react';

function TopBar() {
    const {
        currentState,
        navigateToView,
        navigateBack,
        navigateForward,
        canGoBack,
        canGoForward
    } = useAppStore();

    const isLibraryActive = ['browsing', 'podcasts', 'player'].includes(currentState);

    return (
        <header className="top-bar">
            <div className="top-bar-left">
                <div className="nav-controls">
                    <button
                        className="nav-control-btn"
                        onClick={navigateBack}
                        disabled={!canGoBack()}
                        title="Go Back"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        className="nav-control-btn"
                        onClick={navigateForward}
                        disabled={!canGoForward()}
                        title="Go Forward"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="nav-links">
                    <button
                        className={`nav-link ${isLibraryActive ? 'active' : ''}`}
                        onClick={() => navigateToView('browsing')}
                    >
                        <span className="nav-icon"><Library size={16} /></span>
                        Library
                    </button>
                    <button
                        className={`nav-link ${currentState === 'notes' ? 'active' : ''}`}
                        onClick={() => navigateToView('notes', { episodeId: null })}
                    >
                        <span className="nav-icon"><NotebookPen size={16} /></span>
                        Notes
                    </button>
                </div>
            </div>

            <div className="top-bar-right">
                <TranscriptionStatusBubble />
                <button
                    className={`settings-btn ${currentState === 'settings' ? 'active' : ''}`}
                    onClick={() => navigateToView('settings')}
                    title="Settings"
                >
                    <Settings size={18} />
                </button>
            </div>
        </header>
    );
}

export default TopBar;
