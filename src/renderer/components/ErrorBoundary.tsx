import { Component, ErrorInfo, ReactNode } from 'react';
import { useAppStore } from '../store/appStore';
import { TriangleAlert, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

// Wrapper to use hook navigation in Class Component logic if needed,
// but simpler to just having a fallback button that effectively refreshes or resets.
// Actually, we can pass a reset action or just render a simple "Return to Library" button 
// that uses window.location.reload() or internal logic if we can access store.
// Since Class Components can't use hooks, we'll implement the Reset button as a separate functional component 
// rendered by the fallback.

function FallbackUI({ error, resetErrorBoundary }: { error: Error | null, resetErrorBoundary: () => void }) {
    const navigateToView = useAppStore(state => state.navigateToView);

    const handleRecover = () => {
        navigateToView('browsing', { replace: true });
        resetErrorBoundary();
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-primary)'
        }}>
            <div style={{ color: '#ef4444', marginBottom: '1rem' }}>
                <TriangleAlert size={48} />
            </div>
            <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px' }}>
                {error?.message || "An unexpected error occurred."}
            </p>
            <button
                onClick={handleRecover}
                className="control-button-large"
                style={{
                    backgroundColor: 'var(--accent-color)',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                <Home size={18} /> Go to Library
            </button>
        </div>
    );
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    resetErrorBoundary = () => {
        this.setState({ hasError: false, error: null });
    }

    render() {
        if (this.state.hasError) {
            return <FallbackUI error={this.state.error} resetErrorBoundary={this.resetErrorBoundary} />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
