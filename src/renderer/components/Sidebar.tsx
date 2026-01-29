import { useAppStore } from '../store/appStore';
import '../styles/Sidebar.css';

function Sidebar() {
  const { currentState, setCurrentState } = useAppStore();

  const navItems = [
    { id: 'browsing', label: 'Library', icon: '📚' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-logo">🎙️</div>
        <h1 className="app-title">Podsnip</h1>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentState === item.id ? 'active' : ''}`}
            onClick={() => setCurrentState(item.id as any)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="version">v0.1.0</div>
      </div>
    </aside>
  );
}

export default Sidebar;
