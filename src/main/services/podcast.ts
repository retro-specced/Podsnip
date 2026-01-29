import axios from 'axios';
import FeedParser from 'feedparser';
import { Readable } from 'stream';
import { DatabaseService, Podcast, Episode } from './database';

export class PodcastService {
  constructor(private db: DatabaseService) {}

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
            duration: item.duration || 0,
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
            duration: item.duration || 0,
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
