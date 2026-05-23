"""
カード画像を 320×480 (2:3) に統一
・アスペクト比を保ったまま内側にフィットリサイズ
・余白は透明でセンタリング
"""
from PIL import Image
import os

TARGET_W = 320
TARGET_H = 480
CARDS_DIR = 'assets/material/cards'

def normalize(fname):
    path = os.path.join(CARDS_DIR, fname)
    src  = Image.open(path).convert('RGBA')
    w, h = src.size

    scale = min(TARGET_W / w, TARGET_H / h)
    new_w = round(w * scale)
    new_h = round(h * scale)

    resized = src.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new('RGBA', (TARGET_W, TARGET_H), (0, 0, 0, 0))
    paste_x = (TARGET_W - new_w) // 2
    paste_y = (TARGET_H - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)
    canvas.save(path, 'PNG')

    print(f"  {fname}: {w}x{h} → {new_w}x{new_h} (pad {paste_x}px/{paste_y}px) → {TARGET_W}x{TARGET_H}")

if __name__ == '__main__':
    files = sorted(f for f in os.listdir(CARDS_DIR) if f.endswith('.png'))
    print(f"ターゲット: {TARGET_W}x{TARGET_H} (2:3)\n処理対象: {len(files)}ファイル")
    for f in files:
        normalize(f)
    print("完了!")
