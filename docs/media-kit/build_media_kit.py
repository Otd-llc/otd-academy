"""
One Thousand Drones Academy — CJ Affiliate Publisher Media Kit (one-pager).

Regenerate after editing placeholders:
    python docs/media-kit/build_media_kit.py

Placeholders to replace with REAL values before uploading (CJ PSA s2(a) requires
accurate info): the [bracketed] metrics in STATS, and the screenshot images in
SHOTS (swap the gray placeholder boxes for real PNGs of the live app).
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Flowable,
)

# ---- palette -------------------------------------------------------------
NAVY       = HexColor(0x0F172A)
TEAL       = HexColor(0x0E9C92)
TEAL_DK    = HexColor(0x0B7A72)
TEAL_TINT  = HexColor(0xE7F7F5)
SLATE      = HexColor(0x44505F)
MUTED      = HexColor(0x6B7686)
LIGHT      = HexColor(0xF1F5F9)
BORDER     = HexColor(0xCBD5E1)
SHOT_BG    = HexColor(0xE9EDF2)

PAGE_W, PAGE_H = letter
HEADER_H = 96
FOOTER_H = 50

OUT = os.path.join(os.path.dirname(__file__), "otd-academy-media-kit.pdf")

# ---- editable content ----------------------------------------------------
SITE      = "academy.onethousanddrones.com"
TAGLINE   = "Project-based electronics & drone-hardware education"
CONTACT   = "Joshua Tollette   |   josh@onethousanddrones.com   |   " + SITE

# Pre-launch: we lead on intent + relevance, not traffic numbers (and we never
# fabricate metrics - CJ PSA s2(a)). Swap these to real figures once we have them.
AUDIENCE = [  # (value, label)
    ("Newly launched", "Platform stage - 2026"),
    ("High buyer-intent", "Every learner finishes with a BOM"),
    ("US-based", "HQ: Broken Arrow, OK - global-facing"),
]

SHOTS = [  # screenshot placeholder captions -- swap for real PNGs of the app
    "Screenshot:\nLesson page",
    "Screenshot:\nProject BOM / parts",
    "Screenshot:\nParts catalog",
]


# ---- header / footer bands (drawn on the canvas) -------------------------
def bands(canvas, doc):
    canvas.saveState()
    # header
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, PAGE_H - HEADER_H, PAGE_W, 4, fill=1, stroke=0)  # accent stripe
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 19)
    canvas.drawString(0.6 * inch, PAGE_H - 44, "ONE THOUSAND DRONES ACADEMY")
    canvas.setFillColor(HexColor(0x9FB0C3))
    canvas.setFont("Helvetica", 10)
    canvas.drawString(0.6 * inch, PAGE_H - 62, TAGLINE)
    canvas.setFillColor(TEAL)
    canvas.setFont("Helvetica-Bold", 9.5)
    canvas.drawString(0.6 * inch, PAGE_H - 82, "PUBLISHER MEDIA KIT")
    canvas.setFillColor(white)
    canvas.setFont("Helvetica", 10)
    canvas.drawRightString(PAGE_W - 0.6 * inch, PAGE_H - 82, SITE)

    # footer
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, FOOTER_H, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, FOOTER_H - 3, PAGE_W, 3, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawCentredString(PAGE_W / 2, FOOTER_H / 2 - 4, CONTACT)
    canvas.restoreState()


# ---- small flowable helpers ----------------------------------------------
class HRule(Flowable):
    def __init__(self, w, color=BORDER, thick=0.75):
        super().__init__(); self.w = w; self.color = color; self.thick = thick

    def wrap(self, *_):
        return (self.w, self.thick)

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thick)
        self.canv.line(0, 0, self.w, 0)


def build():
    doc = SimpleDocTemplate(
        OUT, pagesize=letter,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=HEADER_H + 16, bottomMargin=FOOTER_H + 14,
        title="One Thousand Drones Academy - Publisher Media Kit",
        author="Joshua Tollette",
    )
    content_w = PAGE_W - 1.2 * inch

    body = ParagraphStyle("body", fontName="Helvetica", fontSize=9.5,
                          leading=13.5, textColor=SLATE)
    h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=12,
                        leading=14, textColor=NAVY, spaceBefore=13, spaceAfter=5)
    callout_t = ParagraphStyle("ct", fontName="Helvetica-Bold", fontSize=14.5,
                               leading=17, textColor=NAVY)
    callout_s = ParagraphStyle("cs", fontName="Helvetica", fontSize=9.5,
                               leading=13.5, textColor=SLATE, spaceBefore=3)
    stat_num = ParagraphStyle("sn", fontName="Helvetica-Bold", fontSize=11.5,
                              leading=14, textColor=TEAL_DK, alignment=TA_CENTER)
    stat_lab = ParagraphStyle("sl", fontName="Helvetica", fontSize=8,
                              leading=10, textColor=MUTED, alignment=TA_CENTER)
    shot_cap = ParagraphStyle("shc", fontName="Helvetica", fontSize=8.5,
                              leading=11, textColor=MUTED, alignment=TA_CENTER)
    bullet = ParagraphStyle("bul", parent=body, leftIndent=12,
                            bulletIndent=2, spaceAfter=3)

    story = []

    # --- thesis callout ---
    callout = Table(
        [[Paragraph("Every project ends in a bill of materials.", callout_t)],
         [Paragraph(
             "Our learners aren't browsers - they finish each lesson with an itemized BOM and "
             "KiCad-ready footprints, so they reach a purchase decision with specific, high-intent "
             "demand for components, dev boards, and fabricated PCBs.", callout_s)]],
        colWidths=[content_w],
    )
    callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TEAL_TINT),
        ("LINEBEFORE", (0, 0), (0, -1), 3, TEAL),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(callout)

    # --- who we are ---
    story.append(Paragraph("Who we are", h2))
    story.append(Paragraph(
        "One Thousand Drones Academy is a project-based learning platform that teaches people to "
        "design and build real electronics and drone hardware - from reading a first schematic to "
        "laying out a custom PCB. Learners advance through a structured skill-tree curriculum of "
        "hands-on projects, each built around real components and a complete bill of materials. "
        "Registration is open and self-serve, with per-learner progress tracking that retains and "
        "re-engages an audience that buys repeatedly across projects.", body))

    # --- audience snapshot (qualitative; pre-launch, no fabricated metrics) ---
    story.append(Spacer(1, 12))
    snap_data = [[Paragraph(v, stat_num) for v, _ in AUDIENCE],
                 [Paragraph(l, stat_lab) for _, l in AUDIENCE]]
    cw = content_w / len(AUDIENCE)
    snap = Table(snap_data, colWidths=[cw] * len(AUDIENCE))
    snap.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.75, BORDER),
        ("TOPPADDING", (0, 0), (-1, 0), 9),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 9),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(snap)
    story.append(Paragraph(
        "One Thousand Drones Academy launched in 2026. We're building our audience now and "
        "partnering early - so the parts a learner buys are the ones our lessons already specify. "
        "Our pitch is intent and relevance, not scale; we'll add audience metrics as we grow.",
        ParagraphStyle("note", parent=body, fontSize=8.5, leading=12,
                       textColor=MUTED, spaceBefore=5)))

    # --- why advertisers convert ---
    story.append(Paragraph("Why advertisers convert here", h2))
    for b in [
        "<b>Purchase intent is built into the product</b> - a real parts catalog with structured "
        "BOMs, 3D part previews, and KiCad symbol/footprint data, not links bolted onto blog posts.",
        "<b>Contextual, first-party placement</b> - affiliate links sit inside the exact lesson and "
        "BOM where the learner already needs that part. No coupons, incentives, or pop-ups.",
        "<b>A renewing top-of-funnel</b> - beginner-friendly on-ramps bring a steady pipeline of new "
        "makers buying their first components, then more with every project they complete.",
    ]:
        story.append(Paragraph(b, bullet, bulletText="•"))

    # --- placements / screenshots ---
    story.append(Paragraph("Where your links appear", h2))
    shot_row = Table([[Paragraph(c.replace("\n", "<br/>"), shot_cap) for c in SHOTS]],
                     colWidths=[content_w / 3] * 3, rowHeights=[92])
    shot_row.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SHOT_BG),
        ("BOX", (0, 0), (-1, -1), 0.75, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 3, white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(shot_row)
    story.append(Paragraph(
        '<i>Placeholder boxes - swap for real screenshots of the live app.</i>',
        ParagraphStyle("note2", parent=body, fontSize=7.5, textColor=MUTED, spaceBefore=3)))

    # --- ideal partners ---
    story.append(Paragraph("Ideal partners", h2))
    story.append(Paragraph(
        "Electronic-component distributors, PCB fabrication services, and development-board and "
        "tool makers whose catalogs map directly to the parts our curriculum already specifies.",
        body))

    doc.build(story, onFirstPage=bands, onLaterPages=bands)
    print("wrote", OUT)


if __name__ == "__main__":
    build()
