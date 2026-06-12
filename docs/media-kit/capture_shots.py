"""
Capture media-kit screenshots from the LIVE site (all public pages, no auth).

    python docs/media-kit/capture_shots.py

Writes landscape PNGs into docs/media-kit/shots/ which build_media_kit.py embeds.
"""

import os
from playwright.sync_api import sync_playwright

OUT_DIR = os.path.join(os.path.dirname(__file__), "shots")
os.makedirs(OUT_DIR, exist_ok=True)

BASE = "https://academy.onethousanddrones.com"
SHOTS = [
    ("lesson",  f"{BASE}/projects/l1-01-wroom-breakout/v1/guide/SCHEMATIC"),
    ("bom",     f"{BASE}/projects/l1-01-wroom-breakout/v1/guide/BOM_SOURCING"),
    ("catalog", f"{BASE}/parts"),
]

# Landscape viewport (~1.9:1) so thumbnails match the media-kit boxes.
VW, VH = 1440, 760


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": VW, "height": VH},
                                  device_scale_factor=2)
        page = ctx.new_page()
        for name, url in SHOTS:
            page.goto(url, wait_until="networkidle", timeout=45000)
            page.wait_for_timeout(1200)  # let fonts/diagrams settle
            dest = os.path.join(OUT_DIR, f"{name}.png")
            page.screenshot(path=dest)  # viewport only (clean above-the-fold)
            print("captured", name, "->", dest)
        browser.close()


if __name__ == "__main__":
    main()
