#!/usr/bin/env python3
"""Build a 2-page quick-reference version of the Drivewell AutoCRM user manual."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_LEFT
from reportlab.lib import colors
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    FrameBreak,
    NextPageTemplate,
    PageBreak,
)

OUTPUT = "/home/user/AutoCRM/Drivewell-CRM-Quick-Reference.pdf"

BRAND = colors.HexColor("#0F172A")
ACCENT = colors.HexColor("#2563EB")
MUTED = colors.HexColor("#475569")
RULE = colors.HexColor("#E2E8F0")
BG = colors.HexColor("#F1F5F9")

_base = getSampleStyleSheet()
S = {
    "title": ParagraphStyle("title", parent=_base["Title"], fontName="Helvetica-Bold",
                            fontSize=22, leading=26, textColor=BRAND, alignment=TA_LEFT, spaceAfter=2),
    "subtitle": ParagraphStyle("subtitle", parent=_base["Normal"], fontName="Helvetica",
                               fontSize=10, leading=13, textColor=MUTED, spaceAfter=8),
    "h2": ParagraphStyle("h2", parent=_base["Heading2"], fontName="Helvetica-Bold",
                         fontSize=11, leading=13, textColor=ACCENT, spaceBefore=4, spaceAfter=3),
    "feature": ParagraphStyle("feature", parent=_base["BodyText"], fontName="Helvetica-Bold",
                              fontSize=9.5, leading=12, textColor=BRAND, spaceAfter=1),
    "route": ParagraphStyle("route", parent=_base["BodyText"], fontName="Courier",
                            fontSize=7.5, leading=10, textColor=MUTED, spaceAfter=2),
    "body": ParagraphStyle("body", parent=_base["BodyText"], fontName="Helvetica",
                           fontSize=8.5, leading=11, textColor=BRAND, spaceAfter=2),
    "small": ParagraphStyle("small", parent=_base["BodyText"], fontName="Helvetica",
                            fontSize=7.5, leading=10, textColor=MUTED, spaceAfter=1),
    "footer": ParagraphStyle("footer", parent=_base["BodyText"], fontName="Helvetica-Oblique",
                             fontSize=7.5, leading=10, textColor=MUTED, alignment=TA_LEFT),
}


def card(title, route, body_lines):
    """A compact feature card: title + route + bullet list."""
    head = Paragraph(title, S["feature"])
    rt = Paragraph(route, S["route"])
    bullets = [Paragraph(f"• {b}", S["body"]) for b in body_lines]
    content = [[head], [rt]] + [[b] for b in bullets]
    t = Table(content, colWidths=[8.0 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG),
        ("LINEBEFORE", (0, 0), (0, -1), 1.5, ACCENT),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (0, 0), 5),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 5),
    ]))
    return t


# ────────────────────────────────────────────────────────────
# Feature cards — kept tight; 3–4 bullets each
# ────────────────────────────────────────────────────────────
FEATURES = [
    ("Sign in / sign up", "/login",
     ["Sign up tab: name + email + 8-char password.",
      "Sign in tab: email + password.",
      "First sign-up sends you to Onboarding."]),
    ("Onboarding", "/onboarding",
     ["Tick your roles.",
      "Write your KPIs and bottlenecks.",
      "Click Complete profile. An admin still has to approve before you can edit."]),
    ("Overview", "/dashboard",
     ["Read-only situational view.",
      "Filter chips: Failed, Due today, Parts not available.",
      "Click a row to open the client."]),
    ("Clients directory", "/clients",
     ["New client — full intake form.",
      "Import — paste / upload CSV; template available.",
      "Bulk message — WhatsApp or Email with {{firstName}}/{{vehicle}} placeholders.",
      "Delete all — wipes everything (no undo)."]),
    ("Client detail", "/clients/:id",
     ["Edit contact, status, vehicles.",
      "Orders: status flow PENDING → IN_PROGRESS → COMPLETED.",
      "FAILED / ON_HOLD require a reason.",
      "Draft apology — AI draft, saved (not sent).",
      "Log feedback (1–5 stars) and daily updates."]),
    ("My tasks", "/tasks",
     ["Add task — title + priority + day.",
      "Update status from the card.",
      "Last week's open items carry over automatically."]),
    ("Team board", "/team",
     ["List or Kanban view.",
      "Filter by person, status, priority.",
      "Drag cards on Kanban to change status."]),
    ("Peer reviews", "/reviews",
     ["Cycle-based.",
      "Score peers on Deliverables & Communication (1–5).",
      "Reviewee + Admin/Manager see individual scores; everyone else sees the average."]),
    ("KPI board", "/kpi",
     ["Create KPIs with name, category, target, period.",
      "Star-vote each KPI's performance.",
      "Group by category for long lists."]),
    ("Monthly reports", "/reports",
     ["Pick a month + a view (Summary / Employee / Client).",
      "Download CSV, copy to clipboard, or email it.",
      "Clear activity is ADMIN-only."]),
    ("Reminders centre", "/reminders",
     ["Buckets: Overdue, Due today, Upcoming.",
      "Mark done or snooze each card.",
      "Click to jump to the linked client / order."]),
    ("Attendance", "/attendance",
     ["Clock in / Clock out.",
      "Times are in WAT (UTC+1).",
      "Today's roster visible to whole team."]),
    ("Notifications", "/notifications",
     ["Pull-based; refreshes on tab focus.",
      "Mark read per row or Mark all as read."]),
    ("Profile", "/profile",
     ["Edit name, photo, KPIs, bottlenecks.",
      "See your average peer-review score.",
      "Delete account is irreversible — prefer Deactivate via Admin."]),
    ("User Admin", "/admin/users",
     ["ADMIN only.",
      "Roles dialog assigns capabilities.",
      "Deactivate = reversible; Delete = permanent.",
      "Can't deactivate / delete yourself."]),
    ("Connect WhatsApp & Email", "/admin/messaging",
     ["ADMIN/MANAGER only.",
      "WhatsApp: Phone Number ID + permanent System User token.",
      "Email: Resend API key + verified sender.",
      "Use Send test to verify each channel."]),
]


def build():
    doc = BaseDocTemplate(
        OUTPUT, pagesize=A4,
        leftMargin=1.4 * cm, rightMargin=1.4 * cm,
        topMargin=1.4 * cm, bottomMargin=1.4 * cm,
        title="Drivewell AutoCRM — Quick Reference", author="Drivewell",
    )

    # Two-column frame for the cards
    col_w = (A4[0] - 2.8 * cm - 0.6 * cm) / 2
    col_h = A4[1] - 2.8 * cm - 3.5 * cm  # leave room for the header

    header_frame = Frame(
        1.4 * cm, A4[1] - 1.4 * cm - 3.0 * cm,
        A4[0] - 2.8 * cm, 3.0 * cm,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        showBoundary=0,
    )
    left = Frame(1.4 * cm, 1.4 * cm, col_w, col_h,
                 leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                 showBoundary=0)
    right = Frame(1.4 * cm + col_w + 0.6 * cm, 1.4 * cm, col_w, col_h,
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                  showBoundary=0)

    # Cover page has the header frame plus two columns underneath.
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[header_frame, left, right]),
        # Continuation: two full-height columns, no header.
        PageTemplate(id="cont",
                     frames=[
                         Frame(1.4 * cm, 1.4 * cm, col_w, A4[1] - 2.8 * cm,
                               leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                               showBoundary=0),
                         Frame(1.4 * cm + col_w + 0.6 * cm, 1.4 * cm, col_w, A4[1] - 2.8 * cm,
                               leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
                               showBoundary=0),
                     ]),
    ])

    story = []
    # Header
    story.append(Paragraph("Drivewell AutoCRM — Quick Reference", S["title"]))
    story.append(Paragraph(
        "One-page cheat sheet covering every page in the CRM. For full step-by-step "
        "instructions, see the long-form user manual.",
        S["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=0, spaceAfter=6))
    story.append(FrameBreak())  # End the header frame, move to left column

    # Cards: alternate columns by FrameBreak. We balance by putting the first
    # half in the left column and the second half in the right.
    half = (len(FEATURES) + 1) // 2
    for title, route, lines in FEATURES[:half]:
        story.append(card(title, route, lines))
        story.append(Spacer(1, 4))

    story.append(FrameBreak())  # Move to right column

    for title, route, lines in FEATURES[half:]:
        story.append(card(title, route, lines))
        story.append(Spacer(1, 4))

    # Switch template for any overflow (no header)
    story.append(NextPageTemplate("cont"))

    doc.build(story)
    print("Wrote", OUTPUT)


if __name__ == "__main__":
    build()
