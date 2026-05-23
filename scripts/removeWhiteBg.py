"""
PNG の純白背景 (#FFFFFF) と純黒 (#000000) を透過処理
黄金/オレンジ系の細かいディティールは保持する
"""
from PIL import Image
import sys

def process(input_path, output_path):
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    px = img.load()
    changed = 0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]

            # ── 純白のみ除去 (R,G,B すべて 252+, ごく厳格) ──
            # フェード幅わずか3段階 (252→255) でエッジのみ半透明
            if r >= 252 and g >= 252 and b >= 252:
                w_val = min(r, g, b)
                t = (w_val - 252) / 3.0      # 252→0%, 255→100% 透過
                new_a = round(a * (1 - t))
                px[x, y] = (r, g, b, new_a)
                if new_a != a: changed += 1
                continue

            # それ以外は一切変更しない (黒・黄金・グレーすべて保持)

    img.save(output_path, 'PNG')
    print(f"完了: {output_path}  ({w}x{h}px, 変更:{changed:,}px)")

if __name__ == '__main__':
    inp = sys.argv[1] if len(sys.argv) > 1 else 'assets/material/specialField.png'
    out = sys.argv[2] if len(sys.argv) > 2 else inp.replace('.png', '_transparent.png')
    process(inp, out)
