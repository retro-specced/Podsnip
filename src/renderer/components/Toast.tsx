import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Sparkles, X } from 'lucide-react';
import '../styles/Toast.css';

export default function Toast() {
    const { transcriptToast, setTranscriptToast, navigateToView, setTranscribingEpisode, setIsTranscribing, setTranscriptionProgress, setTranscriptionStage, setError } = useAppStore();

    useEffect(() => {
        if (transcriptToast?.show) {
            const timer = setTimeout(() => {
                setTranscriptToast(null);
            }, 6000); // Auto dismiss after 6s
            return () => clearTimeout(timer);
        }
    }, [transcriptToast, setTranscriptToast]);

    if (!transcriptToast?.show) return null;

    const handleGenerate = async () => {
        const episodeId = transcriptToast.episodeId;
        setTranscriptToast(null);

        // Fetch episode details to set as transcribing (Wait, we need the episode object)
        // We can get it from the store's episodes list
        const { episodes, playingEpisode } = useAppStore.getState();
        const episode = episodes.find(e => e.id === episodeId) || playingEpisode;

        if (episode) {
            // Navigate first
            navigateToView('player', { episodeId: episode.id });

            // Start Transcription Logic (Copied from PlayerView/PersistentPlayerBar)
            // Ideally this should be a shared action in the store or a hook, but for now:
            setTranscribingEpisode(episode);
            setIsTranscribing(true);
            setTranscriptionProgress(0);
            setTranscriptionStage('Starting...');
            setError(null);

            try {
                await window.api.transcription.create(episode.id, episode.audio_url);
                // We rely on polling or socket, or the view refetching. 
                // The existing logic seems to handle "isTranscribing" state updates globally if connected?
                // Actually the API call might be blocking or fire-and-forget?
                // In PlayerView `startTranscription`:
                // await window.api.transcription.create(...)
                // const newT = await ...

                // If we are in PlayerView, it sees `isTranscribing` and shows progress.
            } catch (e: any) {
                console.error(e);
                setError(e.message);
                setIsTranscribing(false);
                setTranscribingEpisode(null);
            }
        }
    };

    return (
        <div className="global-toast">
            <div className="toast-content">
                <span>Transcript not available.</span>
                <button className="toast-action-btn" onClick={handleGenerate}>
                    <Sparkles size={14} /> Generate
                </button>
            </div>
            <button className="toast-close-btn" onClick={() => setTranscriptToast(null)}>
                <X size={16} />
            </button>
        </div>
    );
}
