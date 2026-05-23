"""
カード画像の縁に合わせたクリーニング＆クロップスクリプト

アルゴリズム:
1. 画像端から4連結フラッドフィル
2. 端に繋がっている明るいピクセル(luminance > THRESHOLD)を透過
   ※ 暗いカードフレーム(lum <= THRESHOLD)がフラッドフィルを止める
3. 透明ピクセルのバウンディングボックスにクロップ
"""
from PIL import Image
from collections import deque
import os, sys

THRESHOLD = 90      # lum > 90 = 背景残留, lum <= 90 = カードフレーム(除去しない)
INPUT_DIR  = 'assets/material/cards'
OUTPUT_DIR = 'assets/material/cards'   # 上書き保存

def flood_remove(img):
    w, h = img.size
    data = list(img.getdata())

    def idx(x, y):
        return y * w + x

    visited = bytearray(w * h)  # 0=未訪問, 1=訪問済み
    queue   = deque()

    # 4辺の不透明ピクセルをキューに追加
    edges = [(x, y) for x in range(w) for y in [0, h - 1]] + \
            [(x, y) for y in range(h) for x in [0, w - 1]]
    for x, y in edges:
        i = idx(x, y)
        if data[i][3] > 0 and not visited[i]:
            visited[i] = 1
            queue.append((x, y))

    removed = 0
    while queue:
        x, y = queue.popleft()
        i     = idx(x, y)
        r, g, b, a = data[i]
        if a == 0:
            continue                    # 既に透明 → スキップ
        lum = (int(r) + int(g) + int(b)) // 3
        if lum <= THRESHOLD:
            continue                    # 暗いカードフレーム → 止まる

        # 明るい残留背景 → 透過化
        data[i] = (r, g, b, 0)
        removed += 1

        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h:
                ni = idx(nx, ny)
                if not visited[ni]:
                    visited[ni] = 1
                    queue.append((nx, ny))

    img.putdata(data)
    return removed

def process(fname):
    path = os.path.join(INPUT_DIR, fname)
    img  = Image.open(path).convert('RGBA')
    w0, h0 = img.size

    removed = flood_remove(img)

    # タイトなバウンディングボックスにクロップ
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w1, h1 = img.size

    out_path = os.path.join(OUTPUT_DIR, fname)
    img.save(out_path, 'PNG')
    print(f"  {fname}: {w0}x{h0} → {w1}x{h1}  (除去:{removed}px)")

if __name__ == '__main__':
    targets = sys.argv[1:] if len(sys.argv) > 1 else \
              [f for f in sorted(os.listdir(INPUT_DIR)) if f.endswith('.png')]
    print(f"処理対象: {len(targets)}ファイル")
    for fname in targets:
        process(fname)
    print("完了!")
