import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../youtube/client.js", async () => {
  const actual = await vi.importActual<typeof import("../youtube/client.js")>(
    "../youtube/client.js",
  );

  return {
    ...actual,
    fetchLatestVideos: vi.fn(),
    parseChannelReference: vi.fn((channelUrl: string) => {
      const trimmed = channelUrl.trim();
      if (!trimmed.startsWith("https://") || !trimmed.includes("youtube.com")) {
        throw new Error(`Invalid YouTube channel URL: ${channelUrl}`);
      }
      return { kind: "handle", value: `@${trimmed.split("/").at(-1)}` };
    }),
    resolveYouTubeChannel: vi.fn(),
  };
});

import { syncYouTubeData } from "./syncYouTubeData.js";
import { fetchLatestVideos, resolveYouTubeChannel } from "../youtube/client.js";

describe("syncYouTubeData", () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-api-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
  });

  it("deduplicates channel URLs and returns channels in canonical order with ties broken by id", async () => {
    const previousCwd = process.cwd();
    const workingDir = await mkdtemp(join(tmpdir(), "claytube-sync-"));

    try {
      process.chdir(workingDir);

      vi.mocked(resolveYouTubeChannel).mockImplementation(
        async (channelUrl: string) => {
          if (channelUrl === "https://youtube.com/@beta") {
            return {
              channel: {
                id: "id-beta",
                title: "Alpha",
                url: "https://youtube.com/channel/id-beta",
                thumbnail: "https://example.com/beta.jpg",
              },
              uploadsPlaylistId: "uploads-beta",
            };
          }

          if (channelUrl === "https://youtube.com/@alpha") {
            return {
              channel: {
                id: "id-alpha",
                title: "Alpha",
                url: "https://youtube.com/channel/id-alpha",
                thumbnail: "https://example.com/alpha.jpg",
              },
              uploadsPlaylistId: "uploads-alpha",
            };
          }

          throw new Error(`Unexpected channel URL: ${channelUrl}`);
        },
      );

      vi.mocked(fetchLatestVideos).mockImplementation(async (channel) => {
        if (channel.id === "id-beta") {
          return [
            {
              id: "video-beta-2",
              title: "Beta second",
              channelId: "id-beta",
              publishedAt: "2024-02-02T00:00:00Z",
              thumbnail: "https://example.com/beta-2.jpg",
              url: "https://youtube.com/watch?v=video-beta-2",
            },
            {
              id: "video-beta-1",
              title: "Beta first",
              channelId: "id-beta",
              publishedAt: "2024-02-01T00:00:00Z",
              thumbnail: "https://example.com/beta-1.jpg",
              url: "https://youtube.com/watch?v=video-beta-1",
            },
          ];
        }

        return [
          {
            id: "video-alpha-1",
            title: "Alpha first",
            channelId: "id-alpha",
            publishedAt: "2024-01-01T00:00:00Z",
            thumbnail: "https://example.com/alpha-1.jpg",
            url: "https://youtube.com/watch?v=video-alpha-1",
          },
        ];
      });

      const result = await syncYouTubeData({
        site: { title: "Example", description: "A test site" },
        channels: [
          "https://youtube.com/@beta",
          "https://youtube.com/@alpha",
          "https://youtube.com/@alpha",
        ],
      });

      expect(resolveYouTubeChannel).toHaveBeenCalledTimes(2);
      expect(result.channels.map((channel) => channel.id)).toEqual([
        "id-alpha",
        "id-beta",
      ]);
      expect(result.videos.map((video) => video.id)).toEqual([
        "video-beta-2",
        "video-beta-1",
        "video-alpha-1",
      ]);
    } finally {
      process.chdir(previousCwd);
      await rm(workingDir, { recursive: true, force: true });
    }
  });
});
