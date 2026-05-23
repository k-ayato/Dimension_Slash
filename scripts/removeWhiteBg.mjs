import sharp from 'sharp';

const INPUT  = 'assets/material/specialField.png';
const OUTPUT = 'assets/material/specialField_transparent.png';

const { data, info } = await sharp(INPUT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const px = new Uint8Array(data);

for (let i = 0; i < px.length; i += 4) {
  const r = px[i], g = px[i + 1], b = px[i + 2];

  // 純白背景を除去 (#FFFFFF 付近: R,G,B すべて 240+)
  // 黄金色は B が低いため誤爆しない
  if (r >= 240 && g >= 240 && b >= 240) {
    const w = Math.min(r, g, b);
    const t = (w - 240) / 15;          // 240→0%, 255→100% の透過率
    px[i + 3] = Math.round(255 * (1 - t));
    continue;
  }

  // 純黒を除去 (#000000: R,G,B すべて 15 以下)
  if (r <= 15 && g <= 15 && b <= 15) {
    const dark = Math.max(r, g, b);
    const t = 1 - dark / 15;           // 0→100%, 15→0% の透過率
    px[i + 3] = Math.round(255 * (1 - t));
    continue;
  }
}

await sharp(Buffer.from(px.buffer), {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .toFile(OUTPUT);

console.log(`完了: ${OUTPUT} (${info.width}x${info.height})`);
