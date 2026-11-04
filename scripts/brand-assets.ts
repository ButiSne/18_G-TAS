// pnpm brand-assets
//
// Builds the browser-tab icons and the link-share image from the owner's logo file:
//   brand/logo.svg (preferred) or brand/logo.png (at least 1024 px, transparent background)
// Writes, as Next.js file conventions (picked up automatically, no code changes):
//   app/favicon.ico          16, 32 and 48 px, for browsers that ask for /favicon.ico
//   app/icon.png             512 px browser-tab icon
//   app/apple-icon.png       180 px home-screen icon (onyx background: iOS has no transparency)
//   public/og/18gtas-share-vN.jpg  1200×630 link-preview card (path set by SHARE_IMAGE in
//                                  src/lib/site.ts; wired up in app/layout.tsx metadata)
// The share card is rendered in the brand fonts with a headless browser.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { SHARE_IMAGE } from "../src/lib/site.ts";

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

// The tab icons keep the original red and blue, with the triangle's corners made whole
// (see fullTriangle below).
const iconLogo = await fullTriangle(logo, "original");

/** The logo centred on a square canvas, with padding as a share of the side. */
async function square(size: number, padding: number, background = { ...ONYX, alpha: 0 }) {
  const inner = Math.round(size * (1 - 2 * padding));
  const mark = await sharp(iconLogo)
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

// --- The triangle, made whole ------------------------------------------------------

type Line = { a: number; b: number }; // x = a + b·y

/** Least-squares fit of x = a + b·y. */
function fitLine(points: [number, number][]): Line {
  const n = points.length;
  const my = points.reduce((s, [, y]) => s + y, 0) / n;
  const mx = points.reduce((s, [x]) => s + x, 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (y - my) * (x - mx);
    den += (y - my) ** 2;
  }
  const b = num / den;
  return { a: mx - b * my, b };
}

/**
 * The photo of the original logo crops the triangle's two bottom corners: the sides run off
 * the edge of the image. So the triangle is redrawn as a vector, with its sides fitted to
 * the photo's own edges and carried on to two full points on the base line. Only the
 * lettering comes from the photo.
 *   "original": red fill and blue outline, in the colours and outline width measured from
 *               the photo, with the blue lettering on top (the tab icons).
 *   "gold":     brand gold with the lettering cut out, so the dark card shows through (the
 *               share card: the red-and-blue original clashes with onyx and gold, owner's call).
 */
async function fullTriangle(input: Buffer, style: "original" | "gold"): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  // The logo's red and blue, not the faint grey a JPEG leaves around them.
  const ink = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
    return data[i + 3]! > 128 && Math.max(r, g, b) - Math.min(r, g, b) > 80;
  };

  // Edge points from rows where both sides are clear of the image border.
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  let baseY = 0;
  const firstInk = (y: number, from: number, step: 1 | -1) => {
    for (let x = from; x >= 0 && x < W; x += step) if (ink(x, y)) return x;
    return -1;
  };
  for (let y = 0; y < H; y++) {
    const l = firstInk(y, 0, 1);
    const r = firstInk(y, W - 1, -1);
    if (l < 0) continue;
    baseY = y;
    if (l > 2 && r < W - 3 && r - l > W * 0.1) {
      left.push([l, y]);
      right.push([r + 1, y]);
    }
  }
  const L = fitLine(left);
  const R = fitLine(right);
  const apexY = (R.a - L.a) / (L.b - R.b);
  const apexX = L.a + L.b * apexY;
  const base = baseY + 1;
  const cornerL = L.a + L.b * base;
  const cornerR = R.a + R.b * base;
  const pad = Math.ceil(Math.max(0, -cornerL, cornerR - W)) + 2;
  const median = (xs: number[]) => xs.sort((p, q) => p - q)[xs.length >> 1] ?? 0;
  const pixel = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
  };
  const isBlue = (x: number, y: number) => {
    const [r, g, b] = pixel(x, y);
    return b - Math.max(r, g) > 60;
  };
  // Outline width: the run of blue from the left edge inwards, measured across the edge.
  const outline = median(
    left.map(([x0, y]) => {
      let x = x0;
      while (x < W && isBlue(x, y)) x++;
      return (x - x0) / Math.sqrt(1 + L.b ** 2);
    }),
  );
  // The photo's own red and blue: medians of clearly red and clearly blue pixels.
  const reds: number[][] = [[], [], []];
  const blues: number[][] = [[], [], []];
  for (let y = 0; y < H; y += 2)
    for (let x = 0; x < W; x += 2) {
      if (!ink(x, y)) continue;
      const [r, g, b] = pixel(x, y);
      const into = r - Math.max(g, b) > 120 ? reds : b - Math.max(r, g) > 120 ? blues : null;
      if (into) [r, g, b].forEach((v, k) => into[k]!.push(v));
    }
  const hex = (cs: number[][]) =>
    "#" + cs.map((c) => median(c).toString(16).padStart(2, "0")).join("");
  const red = hex(reds);
  const blue = hex(blues);
  const blueRgb = [1, 3, 5].map((k) => Number.parseInt(blue.slice(k, k + 2), 16));

  console.log(
    `Triangle (${style}): apex (${apexX.toFixed(0)}, ${apexY.toFixed(0)}), corners ${cornerL.toFixed(0)} and ${cornerR.toFixed(0)} on y=${base} (photo is ${W} wide)`,
  );

  const W2 = W + 2 * pad;
  const A: [number, number] = [apexX + pad, apexY];
  const B: [number, number] = [cornerL + pad, base];
  const C: [number, number] = [cornerR + pad, base];
  const points = (ps: [number, number][]) => ps.map((p) => p.join(",")).join(" ");
  let shapes = `<polygon fill="#C9A24A" points="${points([A, B, C])}"/>`;
  if (style === "original") {
    const side = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const [a, b, c] = [side(B, C), side(A, C), side(A, B)];
    const incentre = [0, 1].map((k) => (a * A[k]! + b * B[k]! + c * C[k]!) / (a + b + c));
    const inradius =
      Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / (a + b + c);
    const k = (inradius - outline) / inradius;
    const inner = [A, B, C].map(
      (p) => [0, 1].map((i) => incentre[i]! + (p[i]! - incentre[i]!) * k) as [number, number],
    );
    shapes = `<polygon fill="${blue}" points="${points([A, B, C])}"/><polygon fill="${red}" points="${points(inner)}"/>`;
  }
  const triangle = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H}">${shapes}</svg>`,
    ),
  )
    .ensureAlpha()
    .raw()
    .toBuffer();

  // The lettering: every blue shape except the outline. The outline is found by flooding
  // through blue from the triangle's edges, no deeper than the outline is thick. The 8 sits
  // close to the right edge but behind a strip of red, so it comes through whole. The
  // vector edge replaces the outline.
  // Gold cuts the lettering out; the original paints it.
  const keepOf = (i: number) => {
    const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
    const redness = (r - Math.max(g, b)) / 255;
    return Math.max(0, Math.min(1, (redness - 0.15) / 0.35));
  };
  const distance = (line: Line, x: number, y: number) =>
    Math.abs(x - (line.a + line.b * y)) / Math.sqrt(1 + line.b ** 2);
  const edgeDistance = (x: number, y: number) =>
    Math.min(distance(L, x, y), distance(R, x, y), base - y);
  const blueAt = (p: number) => data[p * 4 + 3]! > 128 && keepOf(p * 4) < 0.5;
  // Only as far in as the outline is thick: the "1" touches the left edge, and the flood
  // must not run on through it into the lettering.
  const band = outline + 2.5;
  // The base line is drawn thicker than the sides: measure it on its own, up from the base.
  const baseOutline = median(
    Array.from({ length: 40 }, (_, k) => Math.round(W * (0.3 + (0.4 * k) / 40))).map((x) => {
      let y = baseY;
      while (y > 0 && blueAt(y * W + x)) y--;
      return baseY - y;
    }),
  );
  const baseBand = baseOutline + 2.5;
  const inBand = (x: number, y: number) =>
    distance(L, x, y) <= band || distance(R, x, y) <= band || base - y <= baseBand;
  console.log(`Outline: sides ${outline.toFixed(1)} px, base ${baseOutline} px thick`);
  const isOutline = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let p = 0; p < W * H; p++) {
    if (blueAt(p) && edgeDistance(p % W, Math.floor(p / W)) < 3) {
      isOutline[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop()!;
    const [x, y] = [p % W, Math.floor(p / W)];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      if (!isOutline[q] && blueAt(q) && inBand(nx, ny)) {
        isOutline[q] = 1;
        stack.push(q);
      }
    }
  }
  // The outline's soft inner fringe (purple, half red) is not lettering either.
  const nearOutline = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && isOutline[ny * W + nx]) return true;
      }
    return false;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3]! < 8) continue;
      if (edgeDistance(x, y) < 1.5 || nearOutline(x, y)) continue;
      const keep = keepOf(i);
      if (keep >= 1) continue;
      const j = (y * W2 + x + pad) * 4;
      if (style === "gold") triangle[j + 3] = Math.round(triangle[j + 3]! * keep);
      else
        for (let k = 0; k < 3; k++)
          triangle[j + k] = Math.round(triangle[j + k]! * keep + blueRgb[k]! * (1 - keep));
    }
  }
  return sharp(triangle, { raw: { width: W2, height: H, channels: 4 } })
    .trim()
    .png()
    .toBuffer();
}

const goldLogo = await fullTriangle(logo, "gold");
const logoData = `data:image/png;base64,${goldLogo.toString("base64")}`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Cinzel:wght@500;700&family=Space+Mono:wght@400;700&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{position:relative;background:radial-gradient(ellipse at 85% 0%,rgba(201,162,74,.26),transparent 60%),#0D0D0D;
       color:#F3EDE2;font-family:'Space Mono',monospace}
  .logo{position:absolute;right:62px;top:50%;transform:translateY(-50%);height:396px}
  .text{position:absolute;left:72px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center}
  .eyebrow{font-size:20px;letter-spacing:.3em;color:#C9A24A;text-transform:uppercase}
  .brand{font-family:Cinzel;font-weight:700;font-size:44px;letter-spacing:.3em;margin-top:16px}
  .big{font-family:'Archivo Black';font-size:124px;line-height:.86;text-transform:uppercase;margin-top:4px}
  .gold{color:#C9A24A}
  .line{display:flex;align-items:center;gap:16px;margin-top:28px;font-size:20px;letter-spacing:.2em;text-transform:uppercase}
  .line i{flex:1;height:2px;background:linear-gradient(90deg,rgba(201,162,74,.25),#C9A24A)}
  .cta{margin-top:28px;display:inline-block;background:#C9A24A;color:#0D0D0D;font-weight:700;font-size:22px;padding:12px 26px;border-radius:999px}
</style></head><body>
<img class="logo" src="${logoData}" alt="">
<div class="text">
  <div class="eyebrow">XVIII years · KZN · Mzansi</div>
  <div class="brand">18 G-TAS</div>
  <div class="big">is<br><span class="gold">back.</span></div>
  <div class="line"><span>Est. 2008</span><i></i><span class="gold">Back 2026</span></div>
  <div><span class="cta">Help choose the first drop →</span></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: "png" });
await browser.close();

// Baseline (not progressive) JPEG at a plain, versioned path: see SHARE_IMAGE in site.ts.
const card = await sharp(png)
  .jpeg({ quality: 86, progressive: false, chromaSubsampling: "4:2:0" })
  .toBuffer();
const target = `public${SHARE_IMAGE.path}`;
await mkdir(dirname(target), { recursive: true });
await writeFile(target, card);
console.log(
  `Share card: ${target} (${Math.round(card.length / 1024)} KB, 1200×630, baseline JPEG)`,
);
process.exit(0);
