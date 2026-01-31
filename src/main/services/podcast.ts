import axios from 'axios';
import FeedParser from 'feedparser';
import { Readable } from 'stream';
import { DatabaseService, Podcast, Episode } from './database';

export class PodcastService {
  constructor(private db: DatabaseService) { }

  async addPodcastFeed(feedUrl: string): Promise<Podcast> {
    try {
      // Fetch and parse the RSS feed
      const response = await axios.get(feedUrl, {
        responseType: 'stream',
        timeout: 10000,
      });

      const feedData = await this.parseFeed(response.data);

      // Insert podcast into database
      const podcastId = this.db.insertPodcast({
        feed_url: feedUrl,
        title: feedData.title || 'Unknown Podcast',
        description: feedData.description || '',
        author: feedData.author || '',
        artwork_url: feedData.image?.url || '',
        category: feedData.categories ? (feedData.categories[0] || '') : '', // Taking first category
      });

      // Insert episodes
      for (const item of feedData.items) {
        // Get audio URL from enclosures array
        const audioUrl = this.getAudioUrl(item);

        if (audioUrl) {
          // Episode artwork: use episode's image or fallback to podcast artwork
          const artworkUrl = item.image?.url || feedData.image?.url || '';

          this.db.insertEpisode({
            podcast_id: podcastId,
            title: item.title || 'Untitled Episode',
            description: item.description || '',
            audio_url: audioUrl,
            artwork_url: artworkUrl,
            duration: this.parseDuration(item),
            published_date: item.pubDate?.toISOString() || new Date().toISOString(),
            download_status: 'none',
            local_path: null,
          });
        }
      }

      const podcast = this.db.getPodcast(podcastId);
      if (!podcast) {
        throw new Error('Failed to retrieve created podcast');
      }

      return podcast;
    } catch (error) {
      console.error('Error adding podcast feed:', error);
      throw new Error(`Failed to add podcast feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshPodcastFeed(podcastId: number): Promise<void> {
    const podcast = this.db.getPodcast(podcastId);
    if (!podcast) {
      throw new Error('Podcast not found');
    }

    try {
      const response = await axios.get(podcast.feed_url, {
        responseType: 'stream',
        timeout: 10000,
      });

      const feedData = await this.parseFeed(response.data);

      // Get existing episodes to avoid duplicates
      const existingEpisodes = this.db.getEpisodesByPodcast(podcastId);
      const existingUrls = new Set(existingEpisodes.map(ep => ep.audio_url));

      // Insert only new episodes
      for (const item of feedData.items) {
        const audioUrl = this.getAudioUrl(item);
        if (audioUrl && !existingUrls.has(audioUrl)) {
          // Episode artwork: use episode's image or fallback to podcast artwork
          const artworkUrl = item.image?.url || feedData.image?.url || '';

          this.db.insertEpisode({
            podcast_id: podcastId,
            title: item.title || 'Untitled Episode',
            description: item.description || '',
            audio_url: audioUrl,
            artwork_url: artworkUrl,
            duration: this.parseDuration(item),
            published_date: item.pubDate?.toISOString() || new Date().toISOString(),
            download_status: 'none',
            local_path: null,
          });
        }
      }
    } catch (error) {
      console.error('Error refreshing podcast feed:', error);
      throw new Error(`Failed to refresh podcast feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getAudioUrl(item: any): string {
    // Try multiple ways to get the audio URL
    if (item.enclosures && item.enclosures.length > 0) {
      // Find audio enclosure (audio/mpeg, audio/mp3, etc.)
      const audioEnclosure = item.enclosures.find((enc: any) =>
        enc.type && enc.type.startsWith('audio/')
      );
      if (audioEnclosure?.url) {
        return audioEnclosure.url;
      }
      // Fallback to first enclosure
      return item.enclosures[0]?.url || '';
    }

    // Fallback to single enclosure object
    if (item.enclosure?.url) {
      return item.enclosure.url;
    }

    return '';
  }


  private parseDuration(item: any): number {
    // Debug logging to see what we're getting
    console.log('=== Parsing duration for episode:', item.title);
    console.log('item.duration:', item.duration, 'type:', typeof item.duration);
    console.log('item["itunes:duration"]:', item['itunes:duration']);
    console.log('All item keys with "duration":', Object.keys(item).filter(k => k.toLowerCase().includes('duration')));

    // Try multiple ways to get duration from RSS feed

    // 1. Check if duration is already a number (in seconds)
    if (typeof item.duration === 'number' && item.duration > 0) {
      console.log('✓ Found duration as number:', item.duration);
      return Math.floor(item.duration);
    }

    // 2. Check iTunes duration (itunes:duration) - feedparser wraps it in an object
    const itunesDuration = item['itunes:duration'];
    if (itunesDuration) {
      // feedparser returns { '@': {}, '#': 'actual_value' }
      const durationValue = itunesDuration['#'] || itunesDuration;
      const parsed = this.parseDurationString(durationValue);
      console.log('✓ Found itunes:duration:', durationValue, '→', parsed, 'seconds');
      if (parsed > 0) return parsed;
    }

    // 3. Check if duration is a string (HH:MM:SS or MM:SS format)
    if (typeof item.duration === 'string') {
      const parsed = this.parseDurationString(item.duration);
      console.log('✓ Found duration as string:', item.duration, '→', parsed, 'seconds');
      if (parsed > 0) return parsed;
    }

    // 4. Check enclosure length (file size in bytes) - not duration, skip this

    // 5. Default to 0 if no duration found
    console.log('✗ No duration found, defaulting to 0');
    return 0;
  }


  private parseDurationString(duration: string | number): number {
    if (typeof duration === 'number') {
      return Math.floor(duration);
    }

    const str = String(duration).trim();

    // If it's just a number string (seconds)
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10);
    }

    // Parse HH:MM:SS or MM:SS format
    const parts = str.split(':').map(p => parseInt(p, 10));

    if (parts.length === 3) {
      // HH:MM:SS
      const [hours, minutes, seconds] = parts;
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      // MM:SS
      const [minutes, seconds] = parts;
      return minutes * 60 + seconds;
    } else if (parts.length === 1) {
      // Just seconds
      return parts[0];
    }

    return 0;
  }

  private parseFeed(stream: Readable): Promise<any> {
    return new Promise((resolve, reject) => {
      const feedparser = new FeedParser({});
      const items: any[] = [];
      let feedMeta: any = {};

      stream.pipe(feedparser);

      feedparser.on('error', (error: Error) => {
        reject(error);
      });

      feedparser.on('readable', function (this: any) {
        feedMeta = this.meta;
        let item;
        while ((item = this.read())) {
          items.push(item);
        }
      });

      feedparser.on('end', () => {
        resolve({
          ...feedMeta,
          items,
        });
      });
    });
  }

  getAllPodcasts(): Podcast[] {
    return this.db.getAllPodcasts();
  }

  getPodcast(podcastId: number): Podcast | undefined {
    return this.db.getPodcast(podcastId);
  }

  deletePodcast(podcastId: number): void {
    this.db.deletePodcast(podcastId);
  }

  getEpisodes(podcastId: number): Episode[] {
    return this.db.getEpisodesByPodcast(podcastId);
  }

  getEpisode(episodeId: number): Episode | undefined {
    return this.db.getEpisode(episodeId);
  }
}
