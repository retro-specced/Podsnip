# Podsnip

A modern podcast streaming and annotation app for Linux with automatic transcription.

## Features

- Podcast feed management (RSS/Atom)
- Audio playback with controls
- Automatic transcription with Whisper
- Synchronized transcript annotation
- Notes library and organization

## Development

### Prerequisites

- Node.js 18+ and npm
- Linux development environment

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
- **Transcription**: OpenAI Whisper API / whisper.cpp
- **Feed Parsing**: feedparser
- **State Management**: Zustand

## License

MIT
