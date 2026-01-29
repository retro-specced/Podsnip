declare module 'feedparser' {
  import { Transform } from 'stream';

  interface FeedParserOptions {
    normalize?: boolean;
    addmeta?: boolean;
    feedurl?: string;
  }

  interface FeedMeta {
    title?: string;
    description?: string;
    link?: string;
    author?: string;
    language?: string;
    image?: {
      url?: string;
      title?: string;
    };
    favicon?: string;
    copyright?: string;
    generator?: string;
    categories?: string[];
  }

  interface FeedItem {
    title?: string;
    description?: string;
    summary?: string;
    link?: string;
    origlink?: string;
    permalink?: string;
    date?: Date;
    pubdate?: Date;
    pubDate?: Date;
    author?: string;
    guid?: string;
    comments?: string;
    image?: {
      url?: string;
      title?: string;
    };
    categories?: string[];
    enclosures?: Array<{
      url?: string;
      type?: string;
      length?: number;
    }>;
    enclosure?: {
      url?: string;
      type?: string;
      length?: number;
    };
    duration?: number;
  }

  class FeedParser extends Transform {
    constructor(options?: FeedParserOptions);
    meta: FeedMeta;
  }

  export = FeedParser;
}
