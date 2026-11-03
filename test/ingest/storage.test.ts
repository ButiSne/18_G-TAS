import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ head: vi.fn(), put: vi.fn() }));
vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  head: sdk.head,
  put: sdk.put,
}));

const { BlobNotFoundError, BlobServiceNotAvailable } = await import("@vercel/blob");
const { blobStore } = await import("@/src/ingest/storage");

const body = Buffer.from("webp");

describe("blobStore", () => {
  beforeEach(() => {
    sdk.head.mockReset();
    sdk.put.mockReset();
  });

  it("uploads when the pathname does not exist yet", async () => {
    sdk.head.mockRejectedValue(new BlobNotFoundError());
    sdk.put.mockResolvedValue({
      url: "https://x.public.blob.vercel-storage.com/designs/a-1600.webp",
    });
    const r = await blobStore("token").put("designs/a-1600.webp", body, "image/webp");
    expect(r).toEqual({
      url: "https://x.public.blob.vercel-storage.com/designs/a-1600.webp",
      uploaded: true,
    });
    expect(sdk.put).toHaveBeenCalledWith(
      "designs/a-1600.webp",
      body,
      expect.objectContaining({ access: "public", addRandomSuffix: false }),
    );
  });

  it("reuses an existing blob without uploading again", async () => {
    sdk.head.mockResolvedValue({
      url: "https://x.public.blob.vercel-storage.com/designs/a-1600.webp",
    });
    const r = await blobStore("token").put("designs/a-1600.webp", body, "image/webp");
    expect(r.uploaded).toBe(false);
    expect(sdk.put).not.toHaveBeenCalled();
  });

  it("does not treat other errors as 'missing'", async () => {
    sdk.head.mockRejectedValue(new BlobServiceNotAvailable());
    await expect(
      blobStore("token").put("designs/a-1600.webp", body, "image/webp"),
    ).rejects.toThrow();
    expect(sdk.put).not.toHaveBeenCalled();
  });
});
