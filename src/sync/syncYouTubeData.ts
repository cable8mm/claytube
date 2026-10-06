import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ConfigError } from "../config/loadConfig.js";
import type { ClayTubeConfig } from "../config/loadConfig.js";
import type {
  Channel,
  ChannelsData,
  Video,
  VideosData,
} from "../data/types.js";
import {
  fetchLatestVideos,
  parseChannelReference,
  resolveYouTubeChannel,
  YouTubeApiError,
} from "../youtube/client.js";

export interface SyncResult {
  channels: Channel[];
  videos: Video[];
}

export async function syncYouTubeData(
  config: ClayTubeConfig,
): Promise<SyncResult> {
  if (!Array.isArray(config.channels) || config.channels.length === 0) {
    throw new ConfigError(
      "claytube.config.yaml: channels must contain at least one YouTube channel URL",
    );
  }

  const uniqueChannelUrls = [
    ...new Set(config.channels.map((channel) => channel.trim())),
  ];
  for (const channelUrl of uniqueChannelUrls) {
    parseChannelReference(channelUrl);
  }

  const channels: Channel[] = [];
  const videos: Video[] = [];

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new YouTubeApiError(
      "YOUTUBE_API_KEY environment variable is required",
    );
  }

  for (const channelUrl of uniqueChannelUrls) {
    const resolved = await resolveYouTubeChannel(channelUrl, apiKey);
    const channelVideos = await fetchLatestVideos(
      resolved.channel,
      resolved.uploadsPlaylistId,
      apiKey,
    );

    channels.push(resolved.channel);
    videos.push(...channelVideos);
  }

  channels.sort((left, right) => {
    const byTitle = left.title.localeCompare(right.title);
    return byTitle === 0 ? left.id.localeCompare(right.id) : byTitle;
  });

  videos.sort((left, right) => {
    const byDate = right.publishedAt.localeCompare(left.publishedAt);
    return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
  });

  const nextSnapshot = { channels, videos };
  await commitSnapshot(nextSnapshot);

  return nextSnapshot;
}

async function commitSnapshot(snapshot: SyncResult): Promise<void> {
  const previousSnapshot = await readSnapshot();

  try {
    await writeJson("data/channels.json", { channels: snapshot.channels });
    await writeJson("data/videos.json", { videos: snapshot.videos });
  } catch (error: unknown) {
    try {
      await restoreSnapshot(previousSnapshot);
    } catch {
      // Restore failures are surfaced by the original write error.
    }

    throw new Error(
      `Content store write failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

async function readSnapshot(): Promise<{
  channels?: ChannelsData;
  videos?: VideosData;
}> {
  const snapshot: { channels?: ChannelsData; videos?: VideosData } = {};

  for (const [filePath, key] of [
    ["data/channels.json", "channels"] as const,
    ["data/videos.json", "videos"] as const,
  ]) {
    try {
      const raw = await readFile(filePath, "utf8");
      snapshot[key] = JSON.parse(raw) as ChannelsData & VideosData;
    } catch {
      // Missing or unreadable existing snapshot is treated as absent.
    }
  }

  return snapshot;
}

async function restoreSnapshot(snapshot: {
  channels?: ChannelsData;
  videos?: VideosData;
}): Promise<void> {
  const channelPath = join("data", "channels.json");
  const videoPath = join("data", "videos.json");

  if (snapshot.channels) {
    await writeJson(channelPath, snapshot.channels);
  } else {
    await rm(channelPath, { force: true });
  }

  if (snapshot.videos) {
    await writeJson(videoPath, snapshot.videos);
  } else {
    await rm(videoPath, { force: true });
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
