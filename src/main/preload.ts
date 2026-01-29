import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use ipcRenderer
contextBridge.exposeInMainWorld('api', {
  // Podcast API
  podcast: {
    add: (feedUrl: string) => ipcRenderer.invoke('podcast:add', feedUrl),
    list: () => ipcRenderer.invoke('podcast:list'),
    get: (podcastId: number) => ipcRenderer.invoke('podcast:get', podcastId),
    delete: (podcastId: number) => ipcRenderer.invoke('podcast:delete', podcastId),
    refresh: (podcastId: number) => ipcRenderer.invoke('podcast:refresh', podcastId),
  },

  // Episode API
  episode: {
    list: (podcastId: number) => ipcRenderer.invoke('episode:list', podcastId),
    get: (episodeId: number) => ipcRenderer.invoke('episode:get', episodeId),
  },

  // Transcription API
  transcription: {
    get: (episodeId: number) => ipcRenderer.invoke('transcription:get', episodeId),
    create: (episodeId: number, audioUrl: string) => ipcRenderer.invoke('transcription:create', episodeId, audioUrl),
    checkLocal: () => ipcRenderer.invoke('transcription:check-local'),
  },

  // Annotation API
  annotation: {
    create: (data: { transcriptId: number; noteText: string; tags?: string[] }) =>
      ipcRenderer.invoke('annotation:create', data),
    list: (episodeId?: number) => ipcRenderer.invoke('annotation:list', episodeId),
    update: (annotationId: number, noteText: string, tags?: string[]) =>
      ipcRenderer.invoke('annotation:update', annotationId, noteText, tags),
    delete: (annotationId: number) => ipcRenderer.invoke('annotation:delete', annotationId),
  },

  // Settings API
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },

  // Playback State API
  playback: {
    get: (episodeId: number) => ipcRenderer.invoke('playback:get', episodeId),
    save: (episodeId: number, position: number, speed: number) =>
      ipcRenderer.invoke('playback:save', episodeId, position, speed),
  },
});
