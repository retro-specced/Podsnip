![Podsnip Banner](/home/gerald/.gemini/antigravity/brain/2e97d050-6716-4c1d-a5c0-165e5773cd09/app_icon_banner_1770650956548.png)

# Podsnip

A modern, privacy-focused podcast player for Linux that powers up your listening with **local AI transcription** and **synchronized annotations**.

Built with Electron, React, and TypeScript. Optimized for performance and privacy.

![App Screenshot](/home/gerald/.gemini/antigravity/brain/2e97d050-6716-4c1d-a5c0-165e5773cd09/media__1770628682047.png)

## 🚀 Features

### 🎧 Smart Listening
- **Clean Interface**: Distraction-free player with focus on content.
- **Queue Management**: Easily manage your listening queue.
- **Playback Controls**: Variable speed (0.5x - 2.0x), skip intervals, and keyboard shortcuts.
- **Offline Support**: Download episodes for offline listening.

### 📝 AI Transcription & Notes
- **Local Transcription**: Uses [whisper.cpp](https://github.com/ggerganov/whisper.cpp) to transcribe episodes locally on your device. Zero data leaves your machine.
- **Interactive Transcripts**: Click any text to jump to that part of the audio.
- **Snippet Annotations**: Highlight transcript segments and add personal notes.
- **Searchable**: Find any spoken word across your library.

![Transcription View](/home/gerald/.gemini/antigravity/brain/2e97d050-6716-4c1d-a5c0-165e5773cd09/media__1770629022871.png)

## 🛠️ Installation

### Prerequisites
- **whisper.cpp**: Required for transcription features. [Installation Guide](https://github.com/ggerganov/whisper.cpp)

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
Go to **Settings > Transcription** and point Podsnip to your local `whisper-cpp` binary (e.g., `~/whisper.cpp/main` or `~/whisper.cpp/build/bin/whisper-cli`).

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

MIT © [Gerald]
