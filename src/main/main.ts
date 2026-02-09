import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import { DatabaseService } from './services/database';
import { PodcastService } from './services/podcast';
import { LocalWhisperService } from './services/whisper-local';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService;
let podcastService: PodcastService;
let localWhisperService: LocalWhisperService;

function createWindow() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../../icon.png'));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    show: false,
    icon: icon,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize services
  const userDataPath = app.getPath('userData');
  db = new DatabaseService(path.join(userDataPath, 'podsnip.db'));
  podcastService = new PodcastService(db);
  localWhisperService = new LocalWhisperService();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Podcast Management
ipcMain.handle('podcast:add', async (_, feedUrl: string) => {
  return await podcastService.addPodcastFeed(feedUrl);
});

ipcMain.handle('podcast:list', async () => {
  return await podcastService.getAllPodcasts();
});

ipcMain.handle('podcast:get', async (_, podcastId: number) => {
  return await podcastService.getPodcast(podcastId);
});

ipcMain.handle('podcast:delete', async (_, podcastId: number) => {
  return await podcastService.deletePodcast(podcastId);
});

ipcMain.handle('podcast:refresh', async (_, podcastId: number) => {
  return await podcastService.refreshPodcastFeed(podcastId);
});

ipcMain.handle('podcast:refresh-all', async () => {
  return await podcastService.refreshAllPodcasts();
});

ipcMain.handle('podcast:clear-new', async (_, podcastId: number) => {
  return db.updatePodcastHasNew(podcastId, false);
});

// IPC Handlers for Episodes
ipcMain.handle('episode:list', async (_, podcastId: number) => {
  return await podcastService.getEpisodes(podcastId);
});

ipcMain.handle('episode:get', async (_, episodeId: number) => {
  return await podcastService.getEpisode(episodeId);
});

// IPC Handlers for Transcription
ipcMain.handle('transcription:get', async (_, episodeId: number) => {
  return await db.getTranscript(episodeId);
});

ipcMain.handle('transcription:create', async (event, episodeId: number, audioUrl: string) => {
  // Create audio directory in userData
  const audioDir = path.join(app.getPath('userData'), 'audio');

  // Always use local whisper.cpp with progress tracking
  return await localWhisperService.transcribeEpisode(
    episodeId,
    audioUrl,
    db,
    audioDir,
    (progress, stage) => {
      // Send progress update to renderer
      event.sender.send('transcription:progress', { episodeId, progress, stage });
    }
  );
});

ipcMain.handle('transcription:check-local', async () => {
  return {
    available: localWhisperService.isAvailable(),
    instructions: localWhisperService.getInstallInstructions(),
  };
});

// IPC Handlers for Annotations
ipcMain.handle('annotation:create', async (_, data: {
  transcriptId: number;
  noteText: string;
  transcriptText: string;
  startTime: number;
  endTime: number;
  tags?: string[]
}) => {
  return await db.createAnnotation(
    data.transcriptId,
    data.noteText,
    data.transcriptText,
    data.startTime,
    data.endTime,
    data.tags
  );
});

ipcMain.handle('annotation:list', async (_, episodeId?: number) => {
  return await db.getAnnotations(episodeId);
});

ipcMain.handle('annotation:update', async (_, annotationId: number, noteText: string, tags?: string[]) => {
  return await db.updateAnnotation(annotationId, noteText, tags);
});

ipcMain.handle('annotation:delete', async (_, annotationId: number) => {
  return await db.deleteAnnotation(annotationId);
});

// IPC Handlers for Settings
ipcMain.handle('settings:get', async (_, key: string) => {
  return await db.getSetting(key);
});

ipcMain.handle('settings:set', async (_, key: string, value: string) => {
  db.setSetting(key, value);
});

// IPC Handlers for Playback State
ipcMain.handle('playback:get', async (_, episodeId: number) => {
  return await db.getPlaybackState(episodeId);
});

ipcMain.handle('playback:save', async (_, episodeId: number, position: number, speed: number) => {
  return await db.savePlaybackState(episodeId, position, speed);
});
