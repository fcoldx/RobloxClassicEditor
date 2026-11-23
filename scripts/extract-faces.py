import sys, json
from collections import deque
from PIL import Image

PALETTE = {
    (226, 35, 26): 'Front',
    (0, 116, 189): 'Back',
    (246, 183, 2): 'Left',
    (2, 183, 87): 'Right',
    (0, 162, 255): 'Up',
    (246, 136, 2): 'Down',
}

def boxes(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    px = im.load()
    seen = [[False] * W for _ in range(H)]
    out = []
    for y in range(H):
        for x in range(W):
            if seen[y][x]:
                continue
            face = PALETTE.get(px[x, y])
            if not face:
                seen[y][x] = True
                continue
            q = deque([(x, y)]); seen[y][x] = True; pts = []
            while q:
                cx, cy = q.popleft(); pts.append((cx, cy))
                for nx, ny in ((cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and PALETTE.get(px[nx, ny]) == face:
                        seen[ny][nx] = True; q.append((nx, ny))
            if len(pts) < 2000:
                continue
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            out.append({'face': face, 'x': min(xs), 'y': min(ys),
                        'w': max(xs) - min(xs) + 1, 'h': max(ys) - min(ys) + 1})
    return W, H, out

for path in sys.argv[1:]:
    W, H, bs = boxes(path)
    print('#', path, W, 'x', H, '->', len(bs), 'faces')
    print(json.dumps(sorted(bs, key=lambda b: (b['y'], b['x']))))
