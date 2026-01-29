# Podsnip

A modern podcast streaming and annotation app for Linux with automatic transcription using local whisper.cpp.

## Features

- Podcast feed management (RSS/Atom)
- Audio playback with controls
- Automatic transcription with local Whisper (whisper.cpp)
- Synchronized transcript annotation
- Notes library and organization
- Privacy-focused: all transcription happens locally

## Development

### Prerequisites

- Node.js 18+ and npm
- Linux development environment
- whisper.cpp (for transcription)

### Setting up whisper.cpp

Podsnip uses whisper.cpp for local, privacy-focused transcription:

```bash
# 1. Install dependencies (Debian/Ubuntu)
sudo apt-get install build-essential

# 2. Clone and build whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make

# 3. Download a model (base model recommended for balance of speed/accuracy)
bash ./models/download-ggml-model.sh base

# 4. Create a symlink for easy access
sudo ln -s ~/whisper.cpp/main /usr/local/bin/whisper-cpp
```

### Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package as RPM/DEB
npm run package
```

## Project Structure

```
podsnip/
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # React frontend
│   └── shared/        # Shared types and utilities
├── dist/              # Build output
└── release/           # Packaged releases
```

## Tech Stack

- **Framework**: Electron + React + TypeScript
- **Database**: SQLite (better-sqlite3)
- **Audio**: HTML5 Audio API
- **Transcription**: whisper.cpp (local, privacy-focused)
- **Feed Parsing**: feedparser
- **State Management**: Zustand

## License

MIT
