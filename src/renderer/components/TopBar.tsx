import { useAppStore } from '../store/appStore';
import '../styles/TopBar.css';
import TranscriptionStatusBubble from './TranscriptionStatusBubble';

function TopBar() {
    // ... (imports/exports usually handled by context, but replace_file_content handles snippets)
    // Wait, I need to add the import at the top too.
    // I'll do a MultiReplace? Or two replaces?
    // Or just replace the whole file content if small? 
    // It's small. I'll use replace_file_content with enough context.
    // Actually, insert import at top first?
    // Let's do it in one go if I can match the structure.
    // TopBar is 70 lines.
    // I will just add the component in the return.

    // The import needs to be added. 
    // I'll replace the StartLine 1.

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
                        onClick={() => navigateToView('notes', { episodeId: null })}
                    >
                        <span className="nav-icon">📝</span>
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
                    ⚙️
                </button>
            </div>
        </header>
    );
}

export default TopBar;
