import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("keeps the previous content snapshot unchanged when one channel fails", async () => {
    const previousCwd = process.cwd();
    const workingDir = await mkdtemp(join(tmpdir(), "claytube-sync-rollback-"));

    try {
      process.chdir(workingDir);
      await mkdir("data", { recursive: true });

      const existingChannels = {
        channels: [
          {
            id: "existing-channel",
            title: "Existing Channel",
            url: "https://youtube.com/channel/existing-channel",
            thumbnail: "https://example.com/existing-channel.jpg",
          },
        ],
      };
      const existingVideos = {
        videos: [
          {
            id: "existing-video",
            title: "Existing Video",
            channelId: "existing-channel",
            publishedAt: "2023-01-01T00:00:00Z",
            thumbnail: "https://example.com/existing-video.jpg",
            url: "https://youtube.com/watch?v=existing-video",
          },
        ],
      };

      await writeFile(
        join(workingDir, "data", "channels.json"),
        `${JSON.stringify(existingChannels, null, 2)}\n`,
      );
      await writeFile(
        join(workingDir, "data", "videos.json"),
        `${JSON.stringify(existingVideos, null, 2)}\n`,
      );

      vi.mocked(resolveYouTubeChannel).mockImplementation(
        async (channelUrl) => {
          if (channelUrl === "https://youtube.com/@good") {
            return {
              channel: {
                id: "good-channel",
                title: "Good Channel",
                url: "https://youtube.com/channel/good-channel",
                thumbnail: "https://example.com/good-channel.jpg",
              },
              uploadsPlaylistId: "good-upload-list",
            };
          }

          if (channelUrl === "https://youtube.com/@bad") {
            throw new Error("Channel lookup failed");
          }

          throw new Error(`Unexpected channel URL: ${channelUrl}`);
        },
      );

      vi.mocked(fetchLatestVideos).mockImplementation(async (channel) => {
        if (channel.id === "good-channel") {
          return [
            {
              id: "good-video",
              title: "Good Video",
              channelId: "good-channel",
              publishedAt: "2024-01-01T00:00:00Z",
              thumbnail: "https://example.com/good-video.jpg",
              url: "https://youtube.com/watch?v=good-video",
            },
          ];
        }

        return [];
      });

      await expect(
        syncYouTubeData({
          site: { title: "Example", description: "A test site" },
          channels: ["https://youtube.com/@good", "https://youtube.com/@bad"],
        }),
      ).rejects.toThrow(/Channel lookup failed|failed/i);

      expect(
        await readFile(join(workingDir, "data", "channels.json"), "utf8"),
      ).toBe(`${JSON.stringify(existingChannels, null, 2)}\n`);
      expect(
        await readFile(join(workingDir, "data", "videos.json"), "utf8"),
      ).toBe(`${JSON.stringify(existingVideos, null, 2)}\n`);
    } finally {
      process.chdir(previousCwd);
      await rm(workingDir, { recursive: true, force: true });
    }
  });

  it("replaces the stored snapshot on a successful re-sync and keeps no-op sync byte-identical", async () => {
    const previousCwd = process.cwd();
    const workingDir = await mkdtemp(join(tmpdir(), "claytube-sync-resync-"));

    try {
      process.chdir(workingDir);
      await mkdir("data", { recursive: true });

      const previousChannels = {
        channels: [
          {
            id: "stale-channel",
            title: "Stale Channel",
            url: "https://youtube.com/channel/stale-channel",
            thumbnail: "https://example.com/stale-channel.jpg",
          },
          {
            id: "kept-channel",
            title: "Kept Channel",
            url: "https://youtube.com/channel/kept-channel",
            thumbnail: "https://example.com/kept-channel.jpg",
          },
        ],
      };
      const previousVideos = {
        videos: [
          {
            id: "stale-video",
            title: "Stale Video",
            channelId: "stale-channel",
            publishedAt: "2023-01-01T00:00:00Z",
            thumbnail: "https://example.com/stale-video.jpg",
            url: "https://youtube.com/watch?v=stale-video",
          },
          {
            id: "kept-video",
            title: "Old Title",
            channelId: "kept-channel",
            publishedAt: "2024-03-01T00:00:00Z",
            thumbnail: "https://example.com/kept-video.jpg",
            url: "https://youtube.com/watch?v=kept-video",
          },
        ],
      };

      await writeFile(
        join(workingDir, "data", "channels.json"),
        `${JSON.stringify(previousChannels, null, 2)}\n`,
      );
      await writeFile(
        join(workingDir, "data", "videos.json"),
        `${JSON.stringify(previousVideos, null, 2)}\n`,
      );

      vi.mocked(resolveYouTubeChannel).mockImplementation(
        async (channelUrl) => {
          if (channelUrl === "https://youtube.com/@kept") {
            return {
              channel: {
                id: "kept-channel",
                title: "Kept Channel",
                url: "https://youtube.com/channel/kept-channel",
                thumbnail: "https://example.com/kept-channel.jpg",
              },
              uploadsPlaylistId: "kept-upload-list",
            };
          }

          if (channelUrl === "https://youtube.com/@new") {
            return {
              channel: {
                id: "new-channel",
                title: "New Channel",
                url: "https://youtube.com/channel/new-channel",
                thumbnail: "https://example.com/new-channel.jpg",
              },
              uploadsPlaylistId: "new-upload-list",
            };
          }

          throw new Error(`Unexpected channel URL: ${channelUrl}`);
        },
      );

      vi.mocked(fetchLatestVideos).mockImplementation(async (channel) => {
        if (channel.id === "kept-channel") {
          return [
            {
              id: "kept-video",
              title: "Updated Title",
              channelId: "kept-channel",
              publishedAt: "2024-03-01T00:00:00Z",
              thumbnail: "https://example.com/kept-video.jpg",
              url: "https://youtube.com/watch?v=kept-video",
            },
            {
              id: "new-kept-video",
              title: "New kept video",
              channelId: "kept-channel",
              publishedAt: "2024-04-01T00:00:00Z",
              thumbnail: "https://example.com/new-kept-video.jpg",
              url: "https://youtube.com/watch?v=new-kept-video",
            },
          ];
        }

        if (channel.id === "new-channel") {
          return [
            {
              id: "new-video",
              title: "New video",
              channelId: "new-channel",
              publishedAt: "2024-05-01T00:00:00Z",
              thumbnail: "https://example.com/new-video.jpg",
              url: "https://youtube.com/watch?v=new-video",
            },
          ];
        }

        return [];
      });

      const nextSnapshot = await syncYouTubeData({
        site: { title: "Example", description: "A test site" },
        channels: ["https://youtube.com/@kept", "https://youtube.com/@new"],
      });

      expect(nextSnapshot.channels.map((channel) => channel.id)).toEqual([
        "kept-channel",
        "new-channel",
      ]);
      expect(nextSnapshot.videos.map((video) => video.id)).toEqual([
        "new-video",
        "new-kept-video",
        "kept-video",
      ]);

      const channelsFile = await readFile(
        join(workingDir, "data", "channels.json"),
        "utf8",
      );
      const videosFile = await readFile(
        join(workingDir, "data", "videos.json"),
        "utf8",
      );

      expect(channelsFile).toBe(
        `${JSON.stringify({ channels: nextSnapshot.channels }, null, 2)}\n`,
      );
      expect(videosFile).toBe(
        `${JSON.stringify({ videos: nextSnapshot.videos }, null, 2)}\n`,
      );

      const beforeNoop = {
        channels: await readFile(
          join(workingDir, "data", "channels.json"),
          "utf8",
        ),
        videos: await readFile(join(workingDir, "data", "videos.json"), "utf8"),
      };

      await syncYouTubeData({
        site: { title: "Example", description: "A test site" },
        channels: ["https://youtube.com/@kept", "https://youtube.com/@new"],
      });

      expect(
        await readFile(join(workingDir, "data", "channels.json"), "utf8"),
      ).toBe(beforeNoop.channels);
      expect(
        await readFile(join(workingDir, "data", "videos.json"), "utf8"),
      ).toBe(beforeNoop.videos);
    } finally {
      process.chdir(previousCwd);
      await rm(workingDir, { recursive: true, force: true });
    }
  });

  it("computes the same change report for dry-run and a real sync without writing project files", async () => {
    const previousCwd = process.cwd();
    const workingDir = await mkdtemp(join(tmpdir(), "claytube-sync-dry-run-"));

    try {
      process.chdir(workingDir);
      await mkdir("data", { recursive: true });

      const previousChannels = {
        channels: [
          {
            id: "existing-channel",
            title: "Existing Channel",
            url: "https://youtube.com/channel/existing-channel",
            thumbnail: "https://example.com/existing-channel.jpg",
          },
        ],
      };
      const previousVideos = {
        videos: [
          {
            id: "existing-video",
            title: "Old Title",
            channelId: "existing-channel",
            publishedAt: "2023-02-01T00:00:00Z",
            thumbnail: "https://example.com/existing-video.jpg",
            url: "https://youtube.com/watch?v=existing-video",
          },
        ],
      };

      await writeFile(
        join(workingDir, "data", "channels.json"),
        `${JSON.stringify(previousChannels, null, 2)}\n`,
      );
      await writeFile(
        join(workingDir, "data", "videos.json"),
        `${JSON.stringify(previousVideos, null, 2)}\n`,
      );

      vi.mocked(resolveYouTubeChannel).mockImplementation(
        async (channelUrl) => {
          if (channelUrl === "https://youtube.com/@existing") {
            return {
              channel: {
                id: "existing-channel",
                title: "Existing Channel",
                url: "https://youtube.com/channel/existing-channel",
                thumbnail: "https://example.com/existing-channel.jpg",
              },
              uploadsPlaylistId: "existing-upload-list",
            };
          }

          if (channelUrl === "https://youtube.com/@new") {
            return {
              channel: {
                id: "new-channel",
                title: "New Channel",
                url: "https://youtube.com/channel/new-channel",
                thumbnail: "https://example.com/new-channel.jpg",
              },
              uploadsPlaylistId: "new-upload-list",
            };
          }

          throw new Error(`Unexpected channel URL: ${channelUrl}`);
        },
      );

      vi.mocked(fetchLatestVideos).mockImplementation(async (channel) => {
        if (channel.id === "existing-channel") {
          return [
            {
              id: "existing-video",
              title: "Updated Title",
              channelId: "existing-channel",
              publishedAt: "2023-02-01T00:00:00Z",
              thumbnail: "https://example.com/existing-video.jpg",
              url: "https://youtube.com/watch?v=existing-video",
            },
            {
              id: "added-video",
              title: "Added Video",
              channelId: "existing-channel",
              publishedAt: "2024-06-01T00:00:00Z",
              thumbnail: "https://example.com/added-video.jpg",
              url: "https://youtube.com/watch?v=added-video",
            },
          ];
        }

        if (channel.id === "new-channel") {
          return [
            {
              id: "brand-new-video",
              title: "Brand New Video",
              channelId: "new-channel",
              publishedAt: "2024-07-01T00:00:00Z",
              thumbnail: "https://example.com/brand-new-video.jpg",
              url: "https://youtube.com/watch?v=brand-new-video",
            },
          ];
        }

        return [];
      });

      const config = {
        site: { title: "Example", description: "A test site" },
        channels: ["https://youtube.com/@existing", "https://youtube.com/@new"],
      };

      const dryRunResult = await syncYouTubeData(config, { dryRun: true });
      const snapshotBefore = {
        channels: await readFile(
          join(workingDir, "data", "channels.json"),
          "utf8",
        ),
        videos: await readFile(join(workingDir, "data", "videos.json"), "utf8"),
      };

      expect(
        dryRunResult.changeReport?.channels.added.map((channel) => channel.id),
      ).toEqual(["new-channel"]);
      expect(dryRunResult.changeReport?.channels.removed).toEqual([]);
      expect(
        dryRunResult.changeReport?.videos.changed.map((video) => video.id),
      ).toEqual(["existing-video"]);
      expect(
        dryRunResult.changeReport?.videos.added.map((video) => video.id),
      ).toEqual(["brand-new-video", "added-video"]);
      expect(snapshotBefore.channels).toBe(
        `${JSON.stringify(previousChannels, null, 2)}\n`,
      );
      expect(snapshotBefore.videos).toBe(
        `${JSON.stringify(previousVideos, null, 2)}\n`,
      );

      const realResult = await syncYouTubeData(config);
      expect(realResult.changeReport).toEqual(dryRunResult.changeReport);
      expect(
        await readFile(join(workingDir, "data", "channels.json"), "utf8"),
      ).toBe(`${JSON.stringify({ channels: realResult.channels }, null, 2)}\n`);
      expect(
        await readFile(join(workingDir, "data", "videos.json"), "utf8"),
      ).toBe(`${JSON.stringify({ videos: realResult.videos }, null, 2)}\n`);
    } finally {
      process.chdir(previousCwd);
      await rm(workingDir, { recursive: true, force: true });
    }
  });
});
