<p align="center">
  <img src="icon.png" width="128" alt="Podsnip Icon" />
</p>

# Podsnip

**Podsnip** transforms your podcast listening into active learning. By leveraging powerful **local AI transcription**, it turns every episode into interactive text, allowing you to **highlight snippets**, take **synchronized notes**, and search your entire audio library—all processed privately on your device.

Built with Electron, React, and TypeScript. Optimized for performance and privacy.

![App Screenshot](screenshots/App%20Screenshot.png)

## 🚀 Features

### 🎧 Smart Listening
- **Clean Interface**: Distraction-free player with focus on content.
- **Queue Management**: Easily manage your listening queue.
- **Playback Controls**: Variable speed (0.5x - 2.0x), skip intervals, and keyboard shortcuts.
- **Offline Support**: Download episodes for offline listening.

### 📝 AI Transcription
- **Local Transcription**: Uses [whisper.cpp](https://github.com/ggerganov/whisper.cpp) to transcribe episodes locally on your device. Zero data leaves your machine.

![Transcription View](screenshots/Transcription%20View.png)

### ✍️ Notes & Highlights
- **Snippet Annotations**: Highlight transcript segments and add personal notes.
- **Rich Note Taking**: Capture thoughts without interrupting playback.
- **Review Mode**: Browse all your notes and highlights in one place.

![Notes View](screenshots/Notes%20View.png)

## 🛠️ Installation

### Prerequisites
- **whisper.cpp**: Required for transcription features. [Installation Guide](https://github.com/ggml-org/whisper.cpp)

### Running the AppImage
1. Download the latest `.AppImage` from Releases.
2. Make it executable:
   ```bash
   chmod +x Podsnip-1.0.0.AppImage
   ```
3. Run it:
   ```bash
   ./Podsnip-1.0.0.AppImage
   ```

### ⚙️ Configuration
Go to **Settings > Transcription** and point Podsnip to your local `whisper-cpp` binary (e.g., `~/whisper.cpp/build/bin/whisper-cli`).

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` / `→` | Seek backward/forward 15s |
| `s` | Cycle playback speed |
| `n` | Take a note (at current time) |
| `w` | Toggle fullscreen player |

## 🏗️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package (AppImage)
npm run package
```

## 📄 License

MIT 
