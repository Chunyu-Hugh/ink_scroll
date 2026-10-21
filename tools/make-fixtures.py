#!/usr/bin/env python3
"""
Build the fake-camera video the test suite feeds to Chromium.

    python3 tools/make-fixtures.py

Produces:
    tools/fixtures/face.y4m    a still portrait  (exercises the hand/face pipelines)
    tools/fixtures/moving.y4m  a moving white bar (exercises real frame-differencing)

The portrait is Mae Jemison's official NASA portrait (public domain, NASA).
If Pillow is missing:  pip install pillow
"""
import os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "fixtures")
SRC = "https://upload.wikimedia.org/wikipedia/commons/5/55/Mae_Carol_Jemison.jpg"
# a real pair of open hands (so the hand model is exercised with a real subject)
SRC_HANDS = ("https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/"
             "Human-Hands-Front-Back.jpg/960px-Human-Hands-Front-Back.jpg")
# fixtures stay local (gitignored); sources: NASA (public domain) and
# Evan-Amos / Wikimedia Commons (CC BY-SA 3.0)
W, H, FPS = 640, 480, 15


def y4m(path, frames, draw=None, blend=0.0):
    from PIL import Image, ImageDraw
    im = Image.open(os.path.join(OUT, "face.jpg")).convert("RGB").resize((W, H), Image.LANCZOS)
    if blend:
        im = Image.blend(im, Image.new("RGB", (W, H), (20, 20, 20)), blend)
    with open(path, "wb") as f:
        f.write(f"YUV4MPEG2 W{W} H{H} F{FPS}:1 Ip A1:1 C420jpeg\n".encode())
        for n in range(frames):
            frame = im.copy()
            if draw:
                draw(ImageDraw.Draw(frame), n, frames)
            y, cb, cr = frame.convert("YCbCr").split()
            f.write(b"FRAME\n")
            f.write(y.tobytes())
            f.write(cb.resize((W // 2, H // 2), Image.BILINEAR).tobytes())
            f.write(cr.resize((W // 2, H // 2), Image.BILINEAR).tobytes())
    print("  wrote", path, f"({os.path.getsize(path)//1048576} MB)")


def main():
    os.makedirs(OUT, exist_ok=True)
    hands = os.path.join(OUT, "hand.jpg")
    if not os.path.exists(hands):
        print("  downloading a real hands photo…")
        req = urllib.request.Request(SRC_HANDS, headers={"User-Agent": "ink-scroll-tests/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(hands, "wb") as f:
            f.write(r.read())
    jpg = os.path.join(OUT, "face.jpg")
    if not os.path.exists(jpg):
        print("  downloading a public-domain NASA portrait…")
        req = urllib.request.Request(SRC, headers={"User-Agent": "ink-scroll-tests/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(jpg, "wb") as f:
            f.write(r.read())
    print("  encoding fixtures…")
    y4m(os.path.join(OUT, "face.y4m"), frames=240)                       # 16 s still
    def bar(d, n, total):
        cx = int(W * 0.15 + W * 0.7 * n / total)
        d.rectangle([cx - 45, H // 2 - 120, cx + 45, H // 2 + 120], fill=(245, 245, 240))
    y4m(os.path.join(OUT, "moving.y4m"), frames=240, draw=bar, blend=0.55)
    # same still frame, two extra camera feeds used to prove real recognition
    def still(src, out):
        from PIL import Image, ImageDraw
        im = Image.open(src).convert("RGB").resize((W, H), Image.LANCZOS)
        with open(out, "wb") as f:
            f.write(f"YUV4MPEG2 W{W} H{H} F{FPS}:1 Ip A1:1 C420jpeg\n".encode())
            for _ in range(240):
                y, cb, cr = im.convert("YCbCr").split()
                f.write(b"FRAME\n"); f.write(y.tobytes())
                f.write(cb.resize((W // 2, H // 2), Image.BILINEAR).tobytes())
                f.write(cr.resize((W // 2, H // 2), Image.BILINEAR).tobytes())
    still(os.path.join(OUT, "face.jpg"), os.path.join(OUT, "facecam.y4m"))
    still(hands, os.path.join(OUT, "hand.y4m"))
    print("  wrote hand.y4m / facecam.y4m (real recognition fixtures)")
    print("  done — now run: node tools/test.js")


if __name__ == "__main__":
    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit("Pillow is required:  pip install pillow")
    main()
