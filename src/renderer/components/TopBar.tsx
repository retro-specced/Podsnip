import { useAppStore } from '../store/appStore';
import '../styles/TopBar.css';

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
                        &#60; {/* < symbol */}
                    </button>
                    <button
                        className="nav-control-btn"
                        onClick={navigateForward}
                        disabled={!canGoForward()}
                        title="Go Forward"
                    >
                        &#62; {/* > symbol */}
                    </button>
                </div>

                <div className="nav-links">
                    <button
                        className={`nav-link ${isLibraryActive ? 'active' : ''}`}
                        onClick={() => navigateToView('browsing')}
                    >
                        <span className="nav-icon">📚</span>
                        Library
                    </button>
                    <button
                        className={`nav-link ${currentState === 'notes' ? 'active' : ''}`}
                        onClick={() => navigateToView('notes')}
                    >
                        <span className="nav-icon">📝</span>
                        Notes
                    </button>
                </div>
            </div>

            <div className="top-bar-right">
                <button
                    className={`settings-btn ${currentState === 'settings' ? 'active' : ''}`}
                    onClick={() => navigateToView('settings')}
                    title="Settings"
                >
                    ⚙️
                </button>
            </div>
        </header>
    );
}

export default TopBar;
