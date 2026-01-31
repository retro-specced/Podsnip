import Database from 'better-sqlite3';
import * as path from 'path';

export interface Podcast {
  id: number;
  feed_url: string;
  title: string;
  description: string;
  author: string;
  artwork_url: string;
  last_updated: string;
  category?: string;
}

export interface Episode {
  id: number;
  podcast_id: number;
  title: string;
  description: string;
  audio_url: string;
  artwork_url: string;
  duration: number;
  published_date: string;
  download_status: 'none' | 'downloading' | 'downloaded' | 'failed';
  local_path: string | null;
}

export interface Transcript {
  id: number;
  episode_id: number;
  segment_index: number;
  start_time: number;
  end_time: number;
  text: string;
  confidence_score: number;
}

export interface Annotation {
  id: number;
  transcript_id: number;
  note_text: string;
  transcript_text: string;
  start_time: number;
  end_time: number;
  created_at: string;
  updated_at: string;
  tags: string;
}

export interface PlaybackState {
  episode_id: number;
  current_position: number;
  playback_speed: number;
  last_played: string;
  completed: boolean;
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  private initializeTables() {
    // Podcasts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS podcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_url TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        author TEXT,
        artwork_url TEXT,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        category TEXT
      )
    `);

    // Episodes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        podcast_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        audio_url TEXT NOT NULL,
        artwork_url TEXT,
        duration INTEGER DEFAULT 0,
        published_date TEXT,
        download_status TEXT DEFAULT 'none',
        local_path TEXT,
        FOREIGN KEY (podcast_id) REFERENCES podcasts(id) ON DELETE CASCADE
      )
    `);

    // Migration: Add artwork_url to existing episodes table if it doesn't exist
    const columns = this.db.pragma('table_info(episodes)') as Array<{ name: string }>;
    const hasArtworkUrl = columns.some((col) => col.name === 'artwork_url');

    if (!hasArtworkUrl) {
      this.db.exec(`ALTER TABLE episodes ADD COLUMN artwork_url TEXT`);

      // Populate artwork_url from parent podcast for existing episodes
      this.db.exec(`
        UPDATE episodes
        SET artwork_url = (
          SELECT artwork_url FROM podcasts WHERE podcasts.id = episodes.podcast_id
        )
        WHERE artwork_url IS NULL
      `);
    }

    // Transcripts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        episode_id INTEGER NOT NULL,
        segment_index INTEGER NOT NULL,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        text TEXT NOT NULL,
        confidence_score REAL DEFAULT 0.0,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      )
    `);

    // Annotations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transcript_id INTEGER NOT NULL,
        note_text TEXT NOT NULL,
        transcript_text TEXT,
        start_time REAL,
        end_time REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        tags TEXT,
        FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE
      )
    `);

    // Migration: Add transcript_text, start_time, end_time to existing annotations table
    const annotationColumns = this.db.pragma('table_info(annotations)') as Array<{ name: string }>;
    const hasTranscriptText = annotationColumns.some((col) => col.name === 'transcript_text');

    if (!hasTranscriptText) {
      this.db.exec(`ALTER TABLE annotations ADD COLUMN transcript_text TEXT`);
      this.db.exec(`ALTER TABLE annotations ADD COLUMN start_time REAL`);
      this.db.exec(`ALTER TABLE annotations ADD COLUMN end_time REAL`);

      // Populate from transcripts for existing annotations
      this.db.exec(`
        UPDATE annotations
        SET 
          transcript_text = (SELECT text FROM transcripts WHERE transcripts.id = annotations.transcript_id),
          start_time = (SELECT start_time FROM transcripts WHERE transcripts.id = annotations.transcript_id),
          end_time = (SELECT end_time FROM transcripts WHERE transcripts.id = annotations.transcript_id)
        WHERE transcript_text IS NULL
      `);
    }

    const hasTags = annotationColumns.some((col) => col.name === 'tags');
    if (!hasTags) {
      this.db.exec(`ALTER TABLE annotations ADD COLUMN tags TEXT`);
    }

    // Playback state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playback_state (
        episode_id INTEGER PRIMARY KEY,
        current_position REAL DEFAULT 0,
        playback_speed REAL DEFAULT 1.0,
        last_played TEXT DEFAULT CURRENT_TIMESTAMP,
        completed BOOLEAN DEFAULT 0,
        FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
      )
    `);

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create indices for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_episodes_podcast ON episodes(podcast_id);
      CREATE INDEX IF NOT EXISTS idx_transcripts_episode ON transcripts(episode_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_transcript ON annotations(transcript_id);
    `);

    // Migration: Add category to podcasts table
    const podcastColumns = this.db.pragma('table_info(podcasts)') as Array<{ name: string }>;
    const hasCategory = podcastColumns.some((col) => col.name === 'category');
    if (!hasCategory) {
      this.db.exec(`ALTER TABLE podcasts ADD COLUMN category TEXT DEFAULT ''`);
    }
  }

  // Podcast methods
  insertPodcast(podcast: Omit<Podcast, 'id' | 'last_updated'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO podcasts (feed_url, title, description, author, artwork_url, category)
      VALUES (@feed_url, @title, @description, @author, @artwork_url, @category)
    `);
    const info = stmt.run({
      ...podcast,
      category: podcast.category || ''
    });
    return info.lastInsertRowid as number;
  }

  getPodcast(id: number): Podcast | undefined {
    const stmt = this.db.prepare('SELECT * FROM podcasts WHERE id = ?');
    return stmt.get(id) as Podcast | undefined;
  }

  getAllPodcasts(): Podcast[] {
    const stmt = this.db.prepare('SELECT * FROM podcasts ORDER BY last_updated DESC');
    return stmt.all() as Podcast[];
  }

  deletePodcast(id: number): void {
    const stmt = this.db.prepare('DELETE FROM podcasts WHERE id = ?');
    stmt.run(id);
  }

  // Episode methods
  insertEpisode(episode: Omit<Episode, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO episodes (podcast_id, title, description, audio_url, artwork_url, duration, published_date, download_status, local_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      episode.podcast_id,
      episode.title,
      episode.description,
      episode.audio_url,
      episode.artwork_url,
      episode.duration,
      episode.published_date,
      episode.download_status,
      episode.local_path
    );
    return result.lastInsertRowid as number;
  }

  getEpisode(id: number): Episode | undefined {
    const stmt = this.db.prepare('SELECT * FROM episodes WHERE id = ?');
    return stmt.get(id) as Episode | undefined;
  }

  getEpisodesByPodcast(podcastId: number): Episode[] {
    const stmt = this.db.prepare(`
      SELECT 
        e.*,
        ps.current_position,
        ps.completed,
        (SELECT COUNT(*) 
         FROM annotations a 
         JOIN transcripts t ON a.transcript_id = t.id 
         WHERE t.episode_id = e.id
        ) > 0 as has_notes
      FROM episodes e 
      LEFT JOIN playback_state ps ON e.id = ps.episode_id 
      WHERE e.podcast_id = ? 
      ORDER BY e.published_date DESC
    `);
    const episodes = stmt.all(podcastId) as any[];

    // Map boolean and number fields correctly if needed (SQLite returns 1/0 for booleans)
    return episodes.map(ep => ({
      ...ep,
      completed: Boolean(ep.completed),
      has_notes: Boolean(ep.has_notes)
    }));
  }

  updateEpisodeLocalPath(episodeId: number, localPath: string): void {
    const stmt = this.db.prepare(`
      UPDATE episodes SET local_path = ?, download_status = 'downloaded'
      WHERE id = ?
    `);
    stmt.run(localPath, episodeId);
  }

  // Transcript methods
  insertTranscript(transcript: Omit<Transcript, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO transcripts (episode_id, segment_index, start_time, end_time, text, confidence_score)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      transcript.episode_id,
      transcript.segment_index,
      transcript.start_time,
      transcript.end_time,
      transcript.text,
      transcript.confidence_score
    );
    return result.lastInsertRowid as number;
  }

  getTranscript(episodeId: number): Transcript[] {
    const stmt = this.db.prepare('SELECT * FROM transcripts WHERE episode_id = ? ORDER BY segment_index');
    return stmt.all(episodeId) as Transcript[];
  }

  // Annotation methods
  createAnnotation(
    transcriptId: number,
    noteText: string,
    transcriptText: string,
    startTime: number,
    endTime: number,
    tags?: string[]
  ): number {
    const stmt = this.db.prepare(`
      INSERT INTO annotations (transcript_id, note_text, transcript_text, start_time, end_time, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const tagsStr = tags ? tags.join(',') : '';
    const result = stmt.run(transcriptId, noteText, transcriptText, startTime, endTime, tagsStr);
    return result.lastInsertRowid as number;
  }

  getAnnotations(episodeId?: number): any[] {
    if (episodeId) {
      const stmt = this.db.prepare(`
        SELECT 
          a.*,
          e.title as episode_title,
          e.artwork_url as episode_artwork,
          e.id as episode_id,
          p.title as podcast_title,
          p.id as podcast_id,
          p.artwork_url as podcast_artwork
        FROM annotations a
        JOIN transcripts t ON a.transcript_id = t.id
        JOIN episodes e ON t.episode_id = e.id
        JOIN podcasts p ON e.podcast_id = p.id
        WHERE t.episode_id = ?
        ORDER BY a.created_at DESC
      `);
      return stmt.all(episodeId) as any[];
    } else {
      const stmt = this.db.prepare(`
        SELECT 
          a.*,
          e.title as episode_title,
          e.artwork_url as episode_artwork,
          e.id as episode_id,
          p.title as podcast_title,
          p.id as podcast_id,
          p.artwork_url as podcast_artwork
        FROM annotations a
        JOIN transcripts t ON a.transcript_id = t.id
        JOIN episodes e ON t.episode_id = e.id
        JOIN podcasts p ON e.podcast_id = p.id
        ORDER BY a.created_at DESC
      `);
      return stmt.all() as any[];
    }
  }

  updateAnnotation(id: number, noteText: string, tags?: string[]): void {
    const stmt = this.db.prepare(`
      UPDATE annotations
      SET note_text = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const tagsStr = tags ? tags.join(',') : '';
    stmt.run(noteText, tagsStr, id);
  }

  deleteAnnotation(id: number): void {
    const stmt = this.db.prepare('DELETE FROM annotations WHERE id = ?');
    stmt.run(id);
  }

  // Playback state methods
  savePlaybackState(episodeId: number, position: number, speed: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO playback_state (episode_id, current_position, playback_speed, last_played)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(episode_id) DO UPDATE SET
        current_position = ?,
        playback_speed = ?,
        last_played = CURRENT_TIMESTAMP
    `);
    stmt.run(episodeId, position, speed, position, speed);
  }

  getPlaybackState(episodeId: number): PlaybackState | undefined {
    const stmt = this.db.prepare('SELECT * FROM playback_state WHERE episode_id = ?');
    return stmt.get(episodeId) as PlaybackState | undefined;
  }

  // Settings methods
  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `);
    stmt.run(key, value, value);
  }

  getSetting(key: string): string | undefined {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value;
  }

  close(): void {
    this.db.close();
  }
}
