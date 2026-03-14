import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublishedPostsMock, getCanonicalSiteUrlMock, existsSyncMock } = vi.hoisted(() => ({
  getPublishedPostsMock: vi.fn(),
  getCanonicalSiteUrlMock: vi.fn(),
  existsSyncMock: vi.fn(),
}));

vi.mock("fs", () => ({
  default: {
    existsSync: existsSyncMock,
    readFileSync: vi.fn(),
  },
  existsSync: existsSyncMock,
  readFileSync: vi.fn(),
}));

vi.mock("@/lib/services/blog-service", () => ({
  getPublishedPosts: getPublishedPostsMock,
}));

vi.mock("@/lib/site-url", () => ({
  getCanonicalSiteUrl: getCanonicalSiteUrlMock,
}));

import sitemap from "@/app/sitemap";

describe("sitemap blog metadata", () => {
  beforeEach(() => {
    getPublishedPostsMock.mockReset();
    getCanonicalSiteUrlMock.mockReset();
    existsSyncMock.mockReset();

    getCanonicalSiteUrlMock.mockReturnValue("https://repomind.in");
    existsSyncMock.mockReturnValue(false);
  });

  it("uses each blog post updatedAt as sitemap lastModified", async () => {
    const updatedAt = new Date("2026-03-14T12:00:00.000Z");
    getPublishedPostsMock.mockResolvedValue([
      {
        slug: "my-post",
        updatedAt,
      },
    ]);

    const routes = await sitemap();
    const blogRoute = routes.find((entry) => entry.url === "https://repomind.in/blog/my-post");

    expect(blogRoute?.lastModified).toEqual(updatedAt);
  });
});
