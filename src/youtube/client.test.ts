import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLatestVideos,
  parseChannelReference,
  normalizeChannelUrl,
} from "./client.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("YouTube URL Normalization", () => {
  it("should normalize @handle input", () => {
    expect(normalizeChannelUrl("@cable8mm")).toBe(
      "https://www.youtube.com/@cable8mm",
    );
  });

  it("should normalize youtube.com domain input", () => {
    expect(normalizeChannelUrl("youtube.com/@cable8mm")).toBe(
      "https://youtube.com/@cable8mm",
    );
  });

  it("should parse @handle references", () => {
    expect(parseChannelReference("@cable8mm")).toEqual({
      kind: "handle",
      value: "@cable8mm",
    });
    expect(parseChannelReference("https://www.youtube.com/@cable8mm")).toEqual({
      kind: "handle",
      value: "@cable8mm",
    });
  });

  it("should parse /channel/ ID references", () => {
    const url = "https://www.youtube.com/channel/UC1234567890";
    expect(parseChannelReference(url)).toEqual({
      kind: "id",
      value: "UC1234567890",
    });
  });

  it("should parse /c/ custom URL references", () => {
    expect(parseChannelReference("https://www.youtube.com/c/TED")).toEqual({
      kind: "query",
      value: "TED",
    });
  });

  it("should parse /user/ username references", () => {
    expect(parseChannelReference("https://www.youtube.com/user/TED")).toEqual({
      kind: "username",
      value: "TED",
    });
  });

  it("should parse legacy direct paths as query", () => {
    expect(parseChannelReference("https://youtube.com/TED")).toEqual({
      kind: "query",
      value: "TED",
    });
  });

  it("should throw for invalid or reserved URLs", () => {
    expect(() =>
      parseChannelReference("https://youtube.com/watch?v=123"),
    ).toThrow();
  });

  it("should fetch all videos across multiple YouTube pages", async () => {
    const calls: URLSearchParams[] = [];
    const fetchMock = vi.fn(async (url: URL | string) => {
      const requestUrl = typeof url === "string" ? new URL(url) : url;
      calls.push(new URLSearchParams(requestUrl.search));

      const token = requestUrl.searchParams.get("pageToken");
      const page = token === "next" ? 2 : 1;

      return {
        ok: true,
        json: async () => ({
          items:
            page === 1
              ? [
                  {
                    contentDetails: {
                      videoId: "video-1",
                      videoPublishedAt: "2024-01-01T00:00:00Z",
                    },
                    snippet: {
                      channelId: "channel-123",
                      title: "First video",
                      publishedAt: "2024-01-01T00:00:00Z",
                      thumbnails: {
                        high: { url: "https://example.com/1.jpg" },
                      },
                    },
                  },
                  {
                    contentDetails: {
                      videoId: "video-2",
                      videoPublishedAt: "2024-01-02T00:00:00Z",
                    },
                    snippet: {
                      channelId: "channel-123",
                      title: "Second video",
                      publishedAt: "2024-01-02T00:00:00Z",
                      thumbnails: {
                        high: { url: "https://example.com/2.jpg" },
                      },
                    },
                  },
                ]
              : [
                  {
                    contentDetails: {
                      videoId: "video-3",
                      videoPublishedAt: "2024-01-03T00:00:00Z",
                    },
                    snippet: {
                      channelId: "channel-123",
                      title: "Third video",
                      publishedAt: "2024-01-03T00:00:00Z",
                      thumbnails: {
                        high: { url: "https://example.com/3.jpg" },
                      },
                    },
                  },
                ],
          nextPageToken: page === 1 ? "next" : undefined,
        }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const videos = await fetchLatestVideos(
      {
        id: "channel-123",
        title: "Example",
        url: "https://youtube.com/channel/channel-123",
        thumbnail: "https://example.com/channel.jpg",
      },
      "uploads-playlist",
      "test-key",
    );

    expect(videos.map((video) => video.id)).toEqual([
      "video-1",
      "video-2",
      "video-3",
    ]);
    expect(calls.map((search) => search.get("pageToken"))).toEqual([
      null,
      "next",
    ]);
  });
});
