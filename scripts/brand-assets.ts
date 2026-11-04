// pnpm brand-assets
//
// Builds the browser-tab icons and the link-share image from the owner's logo file:
//   brand/logo.svg (preferred) or brand/logo.png (at least 1024 px, transparent background)
// Writes, as Next.js file conventions (picked up automatically, no code changes):
//   app/favicon.ico          16, 32 and 48 px, for browsers that ask for /favicon.ico
//   app/icon.png             512 px browser-tab icon
//   app/apple-icon.png       180 px home-screen icon (onyx background: iOS has no transparency)
//   app/opengraph-image.jpg  1200×630 share card for WhatsApp, Facebook and X (< 300 KB)
//   app/twitter-image.jpg    the same card for X
// The share card is rendered in the brand fonts with a headless browser.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ONYX = { r: 13, g: 13, b: 13, alpha: 1 };
const source = ["brand/logo.svg", "brand/logo.png", "brand/logo.jpeg", "brand/logo.jpg"].find((f) =>
  existsSync(f),
);
if (!source) {
  console.error("Put the logo at brand/logo.svg, .png or .jpeg, then run again.");
  process.exit(1);
}

/**
 * A logo on a white background (a JPEG has no transparency) gets the white lifted out:
 * near-white becomes transparent, with a soft edge so the outline doesn't look cut out.
 * The logo's own colours are left exactly as they are.
 */
async function liftWhite(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lightest = Math.min(data[i]!, data[i + 1]!, data[i + 2]!);
    // ≤ 200: logo (opaque) · ≥ 245: background (clear) · between: a soft edge.
    const alpha =
      lightest <= 200 ? 255 : lightest >= 245 ? 0 : Math.round(((245 - lightest) / 45) * 255);
    data[i + 3] = Math.min(data[i + 3]!, alpha);
    // De-matte the soft edge: take the white back out of the colour, so the outline meets
    // a dark background cleanly instead of with a grey fringe.
    if (alpha > 0 && alpha < 255) {
      const a = alpha / 255;
      for (let c = 0; c < 3; c++) {
        data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c]! - 255 * (1 - a)) / a)));
      }
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

const raw = await readFile(source);
const opaque = !(await sharp(raw).metadata()).hasAlpha;
const cleaned = opaque ? await liftWhite(raw) : await sharp(raw, { density: 600 }).png().toBuffer();
// Trim empty margins so every output is sized to the mark itself.
const logo = await sharp(cleaned).trim().png().toBuffer();
const meta = await sharp(logo).metadata();
console.log(`Logo: ${source}, ${meta.width}×${meta.height} after trimming`);

/** The logo centred on a square canvas, with padding as a share of the side. */
async function square(size: number, padding: number, background = { ...ONYX, alpha: 0 }) {
  const inner = Math.round(size * (1 - 2 * padding));
  const mark = await sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

/** A .ico holding PNG images (supported by every current browser). */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const icoSizes = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await square(size, 0.04) })),
);
await writeFile("app/favicon.ico", ico(icoSizes));
await writeFile("app/icon.png", await square(512, 0.06));
await writeFile("app/apple-icon.png", await square(180, 0.14, ONYX));
console.log("Icons: app/favicon.ico, app/icon.png, app/apple-icon.png");

// --- Share card, rendered with the brand fonts -----------------------------------
const logoData = `data:image/png;base64,${logo.toString("base64")}`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Cinzel:wght@500;700&family=Space+Mono:wght@400;700&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{background:radial-gradient(ellipse at 85% 0%,rgba(201,162,74,.28),transparent 60%),#0D0D0D;color:#F3EDE2;
       display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box;font-family:'Space Mono',monospace}
  .logo{width:380px;height:380px;flex:none;display:grid;place-items:center}
  .logo img{max-width:100%;max-height:100%;object-fit:contain}
  .eyebrow{font-size:20px;letter-spacing:.3em;color:#C9A24A;text-transform:uppercase}
  .brand{font-family:Cinzel;font-weight:700;font-size:44px;letter-spacing:.3em;margin-top:18px}
  .big{font-family:'Archivo Black';font-size:116px;line-height:.86;text-transform:uppercase;margin-top:6px}
  .gold{color:#C9A24A}
  .line{display:flex;align-items:center;gap:16px;margin-top:30px;font-size:20px;letter-spacing:.2em;text-transform:uppercase}
  .line i{flex:1;height:2px;background:linear-gradient(90deg,rgba(201,162,74,.25),#C9A24A)}
  .cta{margin-top:30px;display:inline-block;background:#C9A24A;color:#0D0D0D;font-weight:700;font-size:22px;padding:12px 26px;border-radius:999px}
</style></head><body>
<div class="logo"><img src="${logoData}" alt=""></div>
<div style="flex:1">
  <div class="eyebrow">XVIII years · KZN · Mzansi</div>
  <div class="brand">18 G-TAS</div>
  <div class="big">is<br><span class="gold">back.</span></div>
  <div class="line"><span>Est. 2008</span><i></i><span class="gold">Back 2026</span></div>
  <div class="cta">Help choose the first drop →</div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: "png" });
await browser.close();

const card = await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
await writeFile("app/opengraph-image.jpg", card);
await writeFile("app/twitter-image.jpg", card);
const alt =
  "18 G-TAS is back: the 18 G-TAS logo, Est. 2008, back 2026. Help choose the first drop.";
await writeFile("app/opengraph-image.alt.txt", alt);
await writeFile("app/twitter-image.alt.txt", alt);
console.log(`Share card: app/opengraph-image.jpg (${Math.round(card.length / 1024)} KB, 1200×630)`);
process.exit(0);
