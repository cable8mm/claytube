import type { Channel, Video } from "../data/types.js";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS_PER_CHANNEL = 12;

interface YouTubeListResponse<T> {
  items?: T[];
  nextPageToken?: string;
  error?: {
    message?: string;
  };
}

interface YouTubeChannelItem {
  id?: string;
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: YouTubeThumbnails;
  };
}

interface YouTubeSearchItem {
  id?: {
    channelId?: string;
  };
}

interface YouTubePlaylistItem {
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
  snippet?: {
    channelId?: string;
    title?: string;
    publishedAt?: string;
    thumbnails?: YouTubeThumbnails;
  };
}

interface ResolvedYouTubeChannel {
  channel: Channel;
  uploadsPlaylistId: string;
}

interface YouTubeThumbnails {
  maxres?: YouTubeThumbnail;
  high?: YouTubeThumbnail;
  medium?: YouTubeThumbnail;
  default?: YouTubeThumbnail;
}

interface YouTubeThumbnail {
  url?: string;
}

export class YouTubeApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

export async function resolveYouTubeChannel(
  channelUrl: string,
  apiKey: string,
): Promise<ResolvedYouTubeChannel> {
  const reference = parseChannelReference(channelUrl);

  if (reference.kind === "id") {
    const channel = await fetchChannel({ id: reference.value }, apiKey);
    if (channel) {
      return channel;
    }
  }

  if (reference.kind === "handle") {
    const channel = await fetchChannel({ forHandle: reference.value }, apiKey);
    if (channel) {
      return channel;
    }
  }

  if (reference.kind === "username") {
    const channel = await fetchChannel(
      { forUsername: reference.value },
      apiKey,
    );
    if (channel) {
      return channel;
    }
  }

  const searchQuery = reference.value;
  const resolvedChannelId = await searchChannelId(searchQuery, apiKey);
  const channel = await fetchChannel({ id: resolvedChannelId }, apiKey);

  if (!channel) {
    throw new YouTubeApiError(
      `Unable to resolve YouTube channel: ${channelUrl}`,
    );
  }

  return channel;
}

export async function fetchLatestVideos(
  channel: Channel,
  uploadsPlaylistId: string,
  apiKey: string,
): Promise<Video[]> {
  const videos: Video[] = [];
  let nextPageToken: string | undefined;

  do {
    const response = await requestYouTube<YouTubePlaylistItem>(
      "playlistItems",
      apiKey,
      {
        part: "snippet,contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: String(MAX_VIDEOS_PER_CHANNEL),
        ...(nextPageToken ? { pageToken: nextPageToken } : {}),
      },
    );

    const pageVideos = (response.items ?? [])
      .map((item): Video | undefined => {
        const videoId = item.contentDetails?.videoId;
        const title = item.snippet?.title;
        const publishedAt =
          item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt;

        if (!videoId || !title || !publishedAt) {
          return undefined;
        }

        return {
          id: videoId,
          title,
          channelId: channel.id,
          publishedAt,
          thumbnail: pickThumbnail(item.snippet?.thumbnails),
          url: `https://www.youtube.com/watch?v=${videoId}`,
        };
      })
      .filter((video): video is Video => video !== undefined);

    videos.push(...pageVideos);
    nextPageToken = response.nextPageToken ?? undefined;
  } while (nextPageToken);

  return videos;
}

async function searchChannelId(query: string, apiKey: string): Promise<string> {
  const response = await requestYouTube<YouTubeSearchItem>("search", apiKey, {
    part: "snippet",
    maxResults: "1",
    q: query,
    type: "channel",
  });

  const channelId = response.items?.[0]?.id?.channelId;
  if (!channelId) {
    throw new YouTubeApiError(`Unable to find YouTube channel: ${query}`);
  }

  return channelId;
}

async function fetchChannel(
  filter: { id: string } | { forHandle: string } | { forUsername: string },
  apiKey: string,
): Promise<ResolvedYouTubeChannel | undefined> {
  const response = await requestYouTube<YouTubeChannelItem>(
    "channels",
    apiKey,
    {
      part: "snippet,contentDetails",
      ...filter,
    },
  );

  const item = response.items?.[0];
  const id = item?.id;
  const title = item?.snippet?.title;
  const uploadsPlaylistId = item?.contentDetails?.relatedPlaylists?.uploads;

  if (!id || !title || !uploadsPlaylistId) {
    return undefined;
  }

  return {
    channel: {
      id,
      title,
      url: `https://www.youtube.com/channel/${id}`,
      thumbnail: pickThumbnail(item.snippet?.thumbnails),
    },
    uploadsPlaylistId,
  };
}

async function requestYouTube<T>(
  endpoint: string,
  apiKey: string,
  params: Record<string, string>,
): Promise<YouTubeListResponse<T>> {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/${endpoint}`);
  url.searchParams.set("key", apiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = (await response.json()) as YouTubeListResponse<T>;

  if (!response.ok) {
    throw new YouTubeApiError(
      data.error?.message ?? `YouTube API request failed: ${response.status}`,
    );
  }

  return data;
}

export function parseChannelReference(channelUrl: string): {
  kind: "handle" | "id" | "query" | "username";
  value: string;
} {
  let url: URL;
  const normalizedUrl = normalizeChannelUrl(channelUrl);

  try {
    url = new URL(normalizedUrl);
  } catch {
    throw new YouTubeApiError(`Invalid YouTube channel URL: ${channelUrl}`);
  }

  const hostname = url.hostname.replace(/^www\./, "");
  if (hostname !== "youtube.com" && !hostname.endsWith(".youtube.com")) {
    throw new YouTubeApiError(`Invalid YouTube channel URL: ${channelUrl}`);
  }

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const firstSegment = segments[0];
  const secondSegment = segments[1];

  if (firstSegment === "channel" && secondSegment) {
    return { kind: "id", value: secondSegment };
  }

  if (firstSegment?.startsWith("@")) {
    return { kind: "handle", value: firstSegment };
  }

  if (firstSegment === "user" && secondSegment) {
    return { kind: "username", value: secondSegment };
  }

  if (firstSegment === "c" && secondSegment) {
    return { kind: "query", value: secondSegment };
  }

  if (firstSegment && !RESERVED_YOUTUBE_PATHS.has(firstSegment)) {
    return { kind: "query", value: firstSegment };
  }

  throw new YouTubeApiError(`Unsupported YouTube channel URL: ${channelUrl}`);
}

const RESERVED_YOUTUBE_PATHS = new Set([
  "about",
  "account",
  "clip",
  "embed",
  "feed",
  "gaming",
  "hashtag",
  "live",
  "playlist",
  "post",
  "results",
  "shorts",
  "watch",
]);

export function normalizeChannelUrl(channelUrl: string): string {
  const trimmed = channelUrl.trim();

  if (trimmed.startsWith("@")) {
    return `https://www.youtube.com/${trimmed}`;
  }

  if (/^(?:www\.|m\.|music\.)?youtube\.com\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function pickThumbnail(thumbnails: YouTubeThumbnails | undefined): string {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    ""
  );
}
