// Where display images go. Production uses Vercel Blob (CLAUDE.md §3). Local development
// can run with no cloud service at all: images land in public/_local/ (git-ignored) and
// Next serves them from /_local/…
// Both stores skip a pathname that already exists, so a second ingest uploads nothing.

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { BlobNotFoundError, head, put } from "@vercel/blob";

export type ImageStore = {
  name: string;
  /** Stores `body` at `pathname` unless it is already there. Returns the public URL. */
  put(
    pathname: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ url: string; uploaded: boolean }>;
};

export function localStore(publicDir = "public", prefix = "_local"): ImageStore {
  return {
    name: `local (${join(publicDir, prefix)})`,
    async put(pathname, body) {
      const file = join(publicDir, prefix, pathname);
      const url = `/${prefix}/${pathname}`;
      try {
        await stat(file);
        return { url, uploaded: false };
      } catch {
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, body);
        return { url, uploaded: true };
      }
    },
  };
}

export function blobStore(token: string): ImageStore {
  return {
    name: "Vercel Blob",
    async put(pathname, body, contentType) {
      try {
        const existing = await head(pathname, { token });
        return { url: existing.url, uploaded: false };
      } catch (error) {
        // The SDK's error.name is not reliable; the class is.
        if (!(error instanceof BlobNotFoundError)) throw error;
      }
      const blob = await put(pathname, body, {
        access: "public",
        token,
        contentType,
        addRandomSuffix: false,
        cacheControlMaxAge: 60 * 60 * 24 * 365, // pathnames change when content does
      });
      return { url: blob.url, uploaded: true };
    },
  };
}
