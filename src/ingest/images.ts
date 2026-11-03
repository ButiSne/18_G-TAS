// Image work for ingest (CLAUDE.md §4.5): WebP at 1600 px plus a 480 px thumbnail, a tiny
// blur placeholder, and a sleeve-colour sample for the tee colour.

import { createHash } from "node:crypto";
import sharp from "sharp";

export const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

export async function renderImage(source: Buffer) {
  const image = sharp(source, { failOn: "none" }).rotate();
  const [full, thumb, blur] = await Promise.all([
    image
      .clone()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer(),
    image.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer(),
    image.clone().resize({ width: 16 }).webp({ quality: 40 }).toBuffer(),
  ]);
  return { full, thumb, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}` };
}

/**
 * Average colour of two patches on the sleeves. Every mockup template in the archive
 * draws the tee in the same place and only all-over prints reach the sleeves.
 * Averages raw pixels: sharp's stats() ignores extract() and would average the whole image.
 */
export async function sampleSleeveColour(source: Buffer): Promise<[number, number, number]> {
  const { width = 0, height = 0 } = await sharp(source).metadata();
  const size = Math.max(8, Math.round(width * 0.02));
  const sums = [0, 0, 0];
  let pixels = 0;
  for (const [x, y] of [
    [0.15, 0.3],
    [0.85, 0.3],
  ] as const) {
    const { data, info } = await sharp(source)
      .extract({
        left: Math.round(width * x - size / 2),
        top: Math.round(height * y - size / 2),
        width: size,
        height: size,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      for (let c = 0; c < 3; c++) sums[c]! += data[i + c]!;
      pixels++;
    }
  }
  return sums.map((s) => Math.round(s / pixels)) as [number, number, number];
}
