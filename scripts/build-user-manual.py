#!/usr/bin/env python3
"""Build the Drivewell AutoCRM user manual as a PDF using reportlab."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
    KeepTogether,
    ListFlowable,
    ListItem,
    HRFlowable,
)

OUTPUT = "/home/user/AutoCRM/Drivewell-CRM-User-Manual.pdf"

# ────────────────────────────────────────────────────────────
# Style sheet
# ────────────────────────────────────────────────────────────
BRAND = colors.HexColor("#0F172A")  # slate-900
ACCENT = colors.HexColor("#2563EB")  # blue-600
MUTED = colors.HexColor("#475569")  # slate-600
SUBTLE = colors.HexColor("#94A3B8")  # slate-400
RULE = colors.HexColor("#E2E8F0")  # slate-200
BG_BOX = colors.HexColor("#F1F5F9")  # slate-100
WARN_BG = colors.HexColor("#FEF3C7")  # amber-100
WARN_RULE = colors.HexColor("#F59E0B")  # amber-500


_base = getSampleStyleSheet()
styles = {
    "title": ParagraphStyle(
        "title",
        parent=_base["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=BRAND,
        alignment=TA_LEFT,
        spaceAfter=4,
    ),
    "subtitle": ParagraphStyle(
        "subtitle",
        parent=_base["Normal"],
        fontName="Helvetica",
        fontSize=14,
        leading=20,
        textColor=MUTED,
        spaceAfter=18,
    ),
    "h1": ParagraphStyle(
        "h1",
        parent=_base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=BRAND,
        spaceBefore=4,
        spaceAfter=4,
    ),
    "h2": ParagraphStyle(
        "h2",
        parent=_base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=BRAND,
        spaceBefore=14,
        spaceAfter=4,
    ),
    "h3": ParagraphStyle(
        "h3",
        parent=_base["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=ACCENT,
        spaceBefore=10,
        spaceAfter=2,
    ),
    "body": ParagraphStyle(
        "body",
        parent=_base["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=BRAND,
        alignment=TA_LEFT,
        spaceAfter=4,
    ),
    "muted": ParagraphStyle(
        "muted",
        parent=_base["BodyText"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=12,
        textColor=MUTED,
        spaceAfter=4,
    ),
    "meta": ParagraphStyle(
        "meta",
        parent=_base["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=MUTED,
        spaceAfter=2,
    ),
    "step": ParagraphStyle(
        "step",
        parent=_base["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=BRAND,
        leftIndent=14,
        spaceAfter=2,
    ),
    "bullet": ParagraphStyle(
        "bullet",
        parent=_base["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=BRAND,
        leftIndent=14,
        spaceAfter=2,
    ),
    "callout": ParagraphStyle(
        "callout",
        parent=_base["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=BRAND,
        spaceAfter=2,
    ),
    "code": ParagraphStyle(
        "code",
        parent=_base["BodyText"],
        fontName="Courier",
        fontSize=9,
        leading=12,
        textColor=BRAND,
        backColor=BG_BOX,
        borderPadding=4,
        spaceAfter=4,
    ),
    "toc_item": ParagraphStyle(
        "toc_item",
        parent=_base["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=18,
        textColor=BRAND,
    ),
    "toc_section": ParagraphStyle(
        "toc_section",
        parent=_base["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=20,
        textColor=ACCENT,
        spaceBefore=8,
    ),
}


def hr():
    return HRFlowable(width="100%", thickness=0.6, color=RULE, spaceBefore=2, spaceAfter=8)


def numbered(items):
    return ListFlowable(
        [ListItem(Paragraph(t, styles["step"]), leftIndent=10) for t in items],
        bulletType="1",
        bulletFontName="Helvetica-Bold",
        bulletFontSize=10,
        bulletColor=ACCENT,
        leftIndent=14,
    )


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, styles["bullet"]), leftIndent=10) for t in items],
        bulletType="bullet",
        start="•",
        bulletFontName="Helvetica",
        bulletFontSize=10,
        bulletColor=ACCENT,
        leftIndent=12,
    )


def callout(label, body, color=ACCENT, bg=BG_BOX):
    """A coloured rounded box used for Tip / Note / Warning."""
    inner = [
        Paragraph(f'<font color="{color.hexval()}"><b>{label}</b></font>  {body}', styles["callout"]),
    ]
    t = Table([[inner]], colWidths=[16.5 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBEFORE", (0, 0), (0, -1), 2, color),
                ("BOX", (0, 0), (-1, -1), 0.25, RULE),
            ]
        )
    )
    return t


def meta_row(label, value):
    return Table(
        [[Paragraph(f'<font color="{MUTED.hexval()}"><b>{label}</b></font>', styles["meta"]),
          Paragraph(value, styles["meta"])]],
        colWidths=[2.6 * cm, 13.9 * cm],
        style=TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        ),
    )


# ────────────────────────────────────────────────────────────
# Header / footer
# ────────────────────────────────────────────────────────────
def on_page(canvas, doc):
    canvas.saveState()
    # Top rule
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, A4[1] - 1.4 * cm, A4[0] - 2 * cm, A4[1] - 1.4 * cm)
    # Header text
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(BRAND)
    canvas.drawString(2 * cm, A4[1] - 1.1 * cm, "Drivewell AutoCRM")
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(A4[0] - 2 * cm, A4[1] - 1.1 * cm, "User Manual")
    # Footer rule
    canvas.setStrokeColor(RULE)
    canvas.line(2 * cm, 1.4 * cm, A4[0] - 2 * cm, 1.4 * cm)
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(2 * cm, 1 * cm, "v1.0")
    canvas.drawCentredString(A4[0] / 2, 1 * cm, "Drivewell AutoCRM User Manual")
    canvas.drawRightString(A4[0] - 2 * cm, 1 * cm, f"Page {doc.page}")
    canvas.restoreState()


# ────────────────────────────────────────────────────────────
# Feature content
# Each entry: title, route, audience, purpose, sections (list of (heading, kind, items))
# kind: "steps" | "bullets" | "para" | "tip" | "note" | "warn" | "code"
# ────────────────────────────────────────────────────────────
SECTIONS = []


def add(title, route, audience, purpose, sections):
    SECTIONS.append(
        dict(title=title, route=route, audience=audience, purpose=purpose, sections=sections)
    )


# 1. Sign in / Sign up
add(
    "1. Signing in & creating an account",
    "/login",
    "Anyone with a Drivewell account; new users start here.",
    "The single entry point for the CRM. Same screen handles new sign-ups and returning sign-ins.",
    [
        ("Sign in", "steps", [
            "Open the app URL in your browser.",
            "Click the <b>Sign in</b> tab if the form shows Sign up.",
            "Enter your work email and password.",
            "Click <b>Sign in</b>. You land on the Overview page if your profile is complete, otherwise on the Onboarding wizard.",
        ]),
        ("Create a new account", "steps", [
            "Click the <b>Sign up</b> tab.",
            "Enter your full name, a work email, and a password of at least 8 characters.",
            "Click <b>Create account</b>. You are signed in automatically.",
            "You are sent to the Onboarding wizard to finish your profile before you can use the rest of the app.",
        ]),
        ("If you forget the difference", "tip",
         "The two tabs share the same screen — if you submit the wrong one you get an error toast, no harm done."),
    ],
)

# 2. Onboarding
add(
    "2. Completing your profile (Onboarding)",
    "/onboarding",
    "Every new user, automatically the first time they log in.",
    "Finishes the profile fields that the rest of the app expects: role(s), KPIs, and bottlenecks. You can't skip it.",
    [
        ("Steps", "steps", [
            "After signing up you are redirected here automatically.",
            "Tick one or more roles that describe what you do (Technician, Service Advisor, Manager, etc.).",
            "Optionally write your <b>KPIs</b> — what you're focused on this period.",
            "Optionally write your <b>Bottlenecks</b> — what's slowing you down.",
            "Optionally upload a profile photo and set a job title.",
            "Click <b>Complete profile</b>. You are taken to the Overview.",
        ]),
        ("Approval", "note",
         "An admin still has to <b>approve</b> your account before you can edit most things. Until then you can browse but not write."),
    ],
)

# 3. Dashboard / Overview
add(
    "3. Overview (Dashboard)",
    "/dashboard",
    "All signed-in team members.",
    "The 'what's happening today' page. A summary strip plus a searchable client / order table.",
    [
        ("Reading the page", "bullets", [
            "Summary cards at the top: active jobs, parts pending, overdue orders, vehicles in progress.",
            "Client table below: one row per client, with their most recent order on the right.",
            "Quick filter chips: <b>Failed</b>, <b>Due today</b>, <b>Parts not available</b>.",
            "Status dropdown lets you filter to a single order status.",
        ]),
        ("Common tasks", "steps", [
            "To find a job, type the client name, phone, or plate into the search box.",
            "Click a row to open the full client detail page.",
            "Click <b>Failed</b> or <b>Due today</b> to triage urgent work.",
        ]),
        ("Refreshing", "tip",
         "Data refetches automatically when you switch back to this browser tab — there's no Refresh button to hunt for."),
    ],
)

# 4. Clients list
add(
    "4. Managing the client directory",
    "/clients",
    "All signed-in users. Bulk message requires ADMIN, MANAGER or SERVICE_ADVISOR.",
    "Master client list. From here you create one client at a time, import many at once, send bulk messages, or delete the whole list.",
    [
        ("Create a single client", "steps", [
            "Click <b>New client</b> top-right.",
            "Fill the intake form: name (required), phone, email, WhatsApp, address, preferred channel.",
            "Optionally add the first vehicle (make / model / year / plate) and a first service order in the same form.",
            "Click <b>Save</b>. You're taken to the new client's detail page.",
        ]),
        ("Bulk-import from a spreadsheet", "steps", [
            "Click <b>Import</b>.",
            "Click <b>Download template</b> if you don't already have a CSV — it shows the column names the app accepts.",
            "Either upload a .csv / .xlsx file or paste rows directly into the textarea.",
            "Review the preview table — rows with no name are flagged and skipped.",
            "Click <b>Import N clients</b> to commit.",
        ]),
        ("Column names the importer understands", "bullets", [
            "<b>Name</b> / Client name / Full name — required.",
            "<b>Phone</b> / Mobile / Tel.",
            "<b>Email</b> / Email address.",
            "<b>WhatsApp</b> / WhatsApp number.",
            "<b>Address</b>.",
            "<b>preferredChannel</b> / Channel (values: SMS, WHATSAPP, EMAIL).",
        ]),
        ("Bulk message clients (WhatsApp / Email)", "steps", [
            "Click <b>Bulk message</b>.",
            "Pick a <b>Channel</b>: WhatsApp or Email. Email also asks for a subject.",
            "Pick an <b>Audience</b>: <b>All clients</b> or <b>Selected</b>.",
            "On the <b>Recipients</b> tab, tick the clients you want. Clients without a usable destination are shown in red.",
            "On the <b>Compose</b> tab, write your message. Use placeholders so each client gets a personal version: <font face='Courier'>{{name}}</font>, <font face='Courier'>{{firstName}}</font>, <font face='Courier'>{{vehicle}}</font>, <font face='Courier'>{{phone}}</font>, <font face='Courier'>{{email}}</font>, <font face='Courier'>{{plate}}</font>.",
            "Check the counter (e.g. <i>Send to 42 clients</i>) and click the send button.",
            "Review the result panel: sent / failed / skipped, and per-recipient errors.",
        ]),
        ("Delete the whole list", "warn",
         "<b>Delete all</b> wipes every client and their cascaded orders, vehicles, parts and communications. There is no undo. It is meant for clearing a sandbox, not for production use."),
    ],
)

# 5. Client detail
add(
    "5. Working a client and their orders",
    "/clients/<i>:id</i>",
    "All signed-in users; some actions are role-gated as noted.",
    "Everything about one client — contact info, vehicles, orders, parts, daily updates, communications, feedback and a full audit trail.",
    [
        ("Edit contact info", "steps", [
            "Click <b>Edit client</b> in the header.",
            "Change phone / email / WhatsApp / address / preferred channel.",
            "Click <b>Save</b>.",
        ]),
        ("Change the client's status", "steps", [
            "Use the <b>Client status</b> dropdown (Prospect / Active / Inactive / Archived).",
            "Use the <b>Service status</b> dropdown to override what shows on the dashboard filters.",
        ]),
        ("Add a vehicle", "steps", [
            "Scroll to <b>Vehicles</b>, click <b>Add vehicle</b>.",
            "Enter make, model, year (required), and optional plate / VIN / colour / mileage.",
            "Click <b>Save</b>.",
        ]),
        ("Create a service order", "steps", [
            "In <b>Orders</b>, click <b>New order</b> (the client must already have at least one vehicle).",
            "Pick the vehicle, write the description of the work.",
            "Optionally set <b>Expected date</b> and <b>Assigned technician</b>.",
            "Click <b>Save</b>.",
        ]),
        ("Change order status", "steps", [
            "On the order card, open the <b>Status</b> dropdown.",
            "Move through PENDING → IN_PROGRESS → COMPLETED as work progresses.",
            "If the job stalls or fails, pick <b>FAILED</b> or <b>ON_HOLD</b>. You will be prompted to write a <b>Reason</b> — it's required.",
        ]),
        ("Manage parts (role: PARTS_STAFF or higher)", "steps", [
            "On the order card, open the parts list.",
            "Click <b>Add part</b> to add a new line.",
            "Use the availability dropdown to flip parts between Not available, On order and Available.",
        ]),
        ("Draft an AI apology (role: SERVICE_ADVISOR or higher)", "steps", [
            "On a FAILED, ON_HOLD or overdue order, click <b>Draft apology</b>.",
            "Pick a <b>tone</b> (formal, warm, brief) and a <b>channel</b> (SMS / WhatsApp / Email).",
            "Click <b>Generate</b>. Claude writes a draft using the client + order context.",
            "Edit the draft if needed, then click <b>Save draft</b>. The draft appears in <b>Communications</b> as DRAFT — it is <b>not</b> sent.",
        ]),
        ("Log feedback", "steps", [
            "Click <b>Log feedback</b> in the header.",
            "Pick a 1–5 star rating, optionally link the related order, and write comments.",
            "Click <b>Save</b>. The client's average rating and trend chart update immediately.",
        ]),
        ("Add a daily update", "steps", [
            "In <b>Daily updates</b>, click <b>Add update</b>.",
            "Write a short note (e.g. 'Diagnostics complete — waiting for parts').",
            "Click <b>Save</b>. Your name and timestamp are recorded next to the note.",
        ]),
        ("Reading the activity log", "note",
         "Every change made to this client (you or anyone else) is recorded with who / when / what at the bottom of the page."),
    ],
)

# 6. Tasks
add(
    "6. Your weekly tasks",
    "/tasks",
    "Every signed-in user (your own tasks).",
    "A personal to-do list for the current work week, grouped by day, with anything you didn't finish last week carried over.",
    [
        ("Add a task for yourself", "steps", [
            "Click <b>Add task</b>.",
            "Enter title (required), description, priority, the work day and optional due date.",
            "Leave assignee as yourself.",
            "Click <b>Save</b>.",
        ]),
        ("Update progress on a task", "steps", [
            "On the task card, open the <b>Status</b> dropdown.",
            "Move PENDING → IN_PROGRESS while you work on it.",
            "Mark COMPLETED when done, or FAILED with a reason if it can't be finished.",
        ]),
        ("Carry-over", "note",
         "Tasks from previous weeks that are still PENDING or IN_PROGRESS appear at the top of this week, tagged <b>Carried over</b>."),
    ],
)

# 7. Team board
add(
    "7. The shared team board",
    "/team",
    "All signed-in users (read-only of others' work).",
    "Same task data as your /tasks page, but for the whole team. Two views and rich filters.",
    [
        ("Switch views", "steps", [
            "Use the tabs at the top: <b>List</b> (cards grouped by day) or <b>Kanban</b> (four columns by status).",
            "List view is best for planning; Kanban is best for daily standups and drag-to-update.",
        ]),
        ("Filter what you see", "steps", [
            "Use the <b>Person</b> dropdown to focus on one teammate (or yourself).",
            "Use the <b>Status</b> dropdown to hide completed work.",
            "Use the <b>Priority</b> dropdown to surface urgent items only.",
        ]),
        ("Assign a task to someone else", "steps", [
            "Click <b>Add task</b>.",
            "In the assignee field, pick another team member.",
            "Save. They get a notification and the task appears on their /tasks page too.",
        ]),
        ("Drag to change status (Kanban)", "tip",
         "Drag a card from PENDING to IN_PROGRESS to COMPLETED — same effect as opening the card and changing the status dropdown."),
    ],
)

# 8. Reviews
add(
    "8. Peer performance reviews",
    "/reviews",
    "All signed-in users. ADMIN/MANAGER and the reviewee see individual scores; everyone else sees the team average only.",
    "Each cycle (e.g. a week or a month) every team member rates every other team member on a small set of criteria.",
    [
        ("Submit a review", "steps", [
            "Open /reviews. You see a card per teammate (you are excluded).",
            "Click <b>Review</b> on the person you want to rate.",
            "Score them on <b>Deliverables</b> (1–5) and <b>Communication</b> (1–5).",
            "Optionally add a comment.",
            "Click <b>Save</b>. If you've already reviewed them this cycle, your previous scores are pre-filled and updated in place.",
        ]),
        ("Read the aggregate", "bullets", [
            "The big number on each card is the average for that person this cycle.",
            "If you are the reviewee or an Admin / Manager, you also see who gave which score.",
            "Otherwise you only see the average — individual scores are hidden from peers.",
        ]),
    ],
)

# 9. KPI board
add(
    "9. The company KPI board",
    "/kpi",
    "All signed-in users; everyone can create KPIs and vote.",
    "Collaborative tracker for company-wide KPIs. Anyone on the team can add a KPI, group it by category, and rate how the team is doing.",
    [
        ("Create a KPI", "steps", [
            "Click <b>Create KPI</b>.",
            "Fill in name, optional description, optional <b>category</b> (e.g. 'Customer Service').",
            "Set <b>target value</b>, <b>unit</b>, and the <b>period</b> (start / end dates).",
            "Click <b>Save</b>.",
        ]),
        ("Vote on performance", "steps", [
            "On the KPI card, tap a star (1 = poor, 5 = excellent) to record your vote.",
            "Tap the same star again to remove your vote.",
            "The team average and total voter count update immediately.",
        ]),
        ("Group by category", "tip",
         "Tick <b>Group by category</b> at the top to organise cards under category headings — handy when you have a long list."),
    ],
)

# 10. Reports
add(
    "10. Monthly reports",
    "/reports",
    "All signed-in users; the <b>Clear activity</b> button is ADMIN only.",
    "Activity reports rolled up by month. Pick a month, pick a view, and export.",
    [
        ("Switch the month", "steps", [
            "Use the month picker at the top.",
            "The three tabs (<b>Summary</b>, <b>By Employee</b>, <b>By Client</b>) all refresh to the selected month.",
        ]),
        ("Download or share a report", "bullets", [
            "<b>Download CSV</b> — full spreadsheet export.",
            "<b>Copy to clipboard</b> — plain text version, useful for pasting into a message.",
            "<b>Email report</b> — sends the report (uses your configured email channel) to the address you enter.",
        ]),
        ("Reading the columns", "bullets", [
            "<b>By Employee</b> — rows per employee, columns per week of the month, plus a total.",
            "<b>By Client</b> — rows per client with status, activity counts per week, and total.",
            "Numbers count distinct activity records (orders touched, communications, feedback, daily updates).",
        ]),
    ],
)

# 11. Reminders
add(
    "11. Reminders centre",
    "/reminders",
    "All signed-in users.",
    "Pulls together every reminder attached to clients / orders, sorted by due status so you can sweep through what needs attention.",
    [
        ("Triage your reminders", "steps", [
            "Open /reminders.",
            "Start with the <b>Overdue</b> group at the top (red).",
            "Move on to <b>Due today</b> (amber).",
            "Glance at <b>Upcoming</b> last so you know what's coming.",
        ]),
        ("Complete or defer", "steps", [
            "On a reminder card, click <b>Mark done</b> when handled.",
            "Or click <b>Snooze</b> and pick how long to push it.",
            "Click the linked client / order to jump straight to the related record.",
        ]),
    ],
)

# 12. Attendance
add(
    "12. Clock in / out (Attendance)",
    "/attendance",
    "All signed-in users.",
    "Daily clock-in / clock-out record. Today's roster is visible to the whole team.",
    [
        ("Clock in", "steps", [
            "Open /attendance when you arrive.",
            "Click <b>Clock in</b>. A toast confirms the time.",
        ]),
        ("Clock out", "steps", [
            "At end of day, click <b>Clock out</b>.",
            "Your row in <b>Today</b> now shows both timestamps and total hours.",
        ]),
        ("Times are in WAT", "note",
         "All clock-in / clock-out timestamps are interpreted as West Africa Time (UTC+1)."),
    ],
)

# 13. Notifications
add(
    "13. Notifications centre",
    "/notifications",
    "All signed-in users (your own notifications only).",
    "Every notification raised for you — task assigned to you, low rating on a client you serve, reminder due, etc.",
    [
        ("Read and dismiss", "steps", [
            "Open /notifications.",
            "Unread items have a red badge.",
            "Click the title to jump to the related entity (a task, a client, etc.).",
            "Click <b>Mark read</b> per item, or <b>Mark all as read</b> at the top.",
        ]),
        ("Auto refresh", "tip",
         "The list reloads whenever you focus the browser tab — no need to refresh manually."),
    ],
)

# 14. Profile
add(
    "14. Your profile",
    "/profile",
    "Only yourself.",
    "Edit personal details, see how peers have rated you, or delete your account.",
    [
        ("Edit your info", "steps", [
            "On the profile card, change name, job title, photo, KPIs and bottlenecks.",
            "Click <b>Save</b>.",
        ]),
        ("Read your performance card", "bullets", [
            "Shows your average score across all peer reviews.",
            "As the reviewee you always see individual attributed scores and comments.",
        ]),
        ("Delete account", "warn",
         "The <b>Delete account</b> button at the bottom is irreversible — it removes your user record. Ask an admin to deactivate instead if you only need a temporary pause."),
    ],
)

# 15. Admin / users
add(
    "15. User Admin",
    "/admin/users",
    "ADMIN only — non-admins are redirected to the dashboard.",
    "Approve new sign-ups, assign roles, deactivate or delete user accounts.",
    [
        ("Approve a new user", "steps", [
            "Open /admin/users.",
            "Find the new account in the table.",
            "Open the <b>Roles</b> dialog and tick the right roles (Technician, Service Advisor, Manager, etc.).",
            "Save. The user can now perform role-gated actions.",
        ]),
        ("Deactivate vs delete", "bullets", [
            "<b>Deactivate</b> — temporarily blocks sign-in. Reversible: click again to reactivate.",
            "<b>Delete</b> — permanently removes the user. Cascades to anything that belongs to them (tasks they created, reviews they gave, etc.). Confirm twice before doing this in production.",
        ]),
        ("You can't lock yourself out", "note",
         "The Deactivate and Delete buttons on your own row are disabled — the app refuses to let you remove the account you're currently signed in as."),
    ],
)

# 16. Admin / messaging
add(
    "16. Connect WhatsApp & Email (Messaging)",
    "/admin/messaging",
    "ADMIN and MANAGER only.",
    "Configure Drivewell's outbound messaging credentials so the team can send personalised WhatsApp and Email messages from the Clients page.",
    [
        ("Before you start", "bullets", [
            "<b>WhatsApp</b> — you need a Meta Business account and a permanent System User access token with the <font face='Courier'>whatsapp_business_messaging</font> scope. Note the <b>Phone Number ID</b> from your WhatsApp Business Account.",
            "<b>Email</b> — you need a Resend account, a verified sender domain, and an API key.",
        ]),
        ("Connect WhatsApp", "steps", [
            "Open /admin/messaging and stay on the <b>WhatsApp</b> tab.",
            "Tick <b>Enable WhatsApp sending</b>.",
            "Paste the <b>Phone Number ID</b> from Meta.",
            "Paste the <b>Access Token</b>. If a token is already saved you can leave this field blank to keep it.",
            "Optionally fill in the business number and display name.",
            "Click <b>Save WhatsApp settings</b>.",
            "Use <b>Send test</b> with your own phone number to confirm the integration works end-to-end.",
        ]),
        ("Connect Email", "steps", [
            "Switch to the <b>Email</b> tab.",
            "Tick <b>Enable email sending</b>.",
            "Pick <b>Resend (HTTPS API)</b> as the provider.",
            "Fill in <b>From name</b> and a verified <b>From address</b>.",
            "Paste the Resend <b>API key</b>. Leave blank to keep an existing key.",
            "Click <b>Save email settings</b>.",
            "Use <b>Send test</b> to confirm.",
        ]),
        ("If a test fails", "note",
         "The error toast contains the raw provider response. A 401 from WhatsApp almost always means the access token has expired or doesn't have the <font face='Courier'>whatsapp_business_messaging</font> scope. A 422 from Resend usually means the sender address isn't verified."),
        ("Where the credentials live", "tip",
         "Credentials are stored in a single MessagingSettings row in the database. Only ADMIN/MANAGER can read this page, and the API tokens are never returned to the browser — the page only shows whether a token is set."),
    ],
)

# 17. Bulk messaging cross-reference appendix
add(
    "17. End-to-end: sending a personalised message to all clients",
    "/clients (after /admin/messaging is configured)",
    "ADMIN, MANAGER or SERVICE_ADVISOR.",
    "A worked example tying the messaging setup and the Clients page together.",
    [
        ("Steps", "steps", [
            "Make sure WhatsApp and / or Email are enabled in /admin/messaging.",
            "Go to /clients and click <b>Bulk message</b>.",
            "Pick the channel.",
            "Leave audience on <b>All clients</b> for a broadcast, or switch to <b>Selected</b> and tick the rows you want.",
            "On the Compose tab, write a template like the example below.",
            "Click <b>Send to N clients</b>.",
            "On the result panel, confirm <b>Sent</b> vs <b>Failed</b> vs <b>Skipped</b>. Each successful send is also recorded on the target client's <b>Communications</b> timeline.",
        ]),
        ("Example template (WhatsApp)", "code",
         "Hi {{firstName}},\n\nWe wanted to let you know your {{vehicle}} is ready for collection.\nDrop by anytime between 9 am and 6 pm.\n\n— The Drivewell team"),
        ("Example template (Email)", "code",
         "Subject: Service update on your {{vehicle}}\n\nHi {{firstName}},\n\nWe've finished the work on your {{vehicle}} ({{plate}}). Reply to this email if you'd like to schedule the next service.\n\n— The Drivewell team"),
        ("Why some clients are skipped", "bullets", [
            "WhatsApp: the client has neither a WhatsApp number nor a phone number on file.",
            "Email: the client has no email on file.",
            "Skipped rows still appear on the result panel so you know who to add contact info for.",
        ]),
    ],
)


# ────────────────────────────────────────────────────────────
# Build flowables
# ────────────────────────────────────────────────────────────
def build_story():
    story = []

    # Cover page
    story.append(Spacer(1, 5 * cm))
    story.append(Paragraph("Drivewell AutoCRM", styles["title"]))
    story.append(Paragraph("User Manual", styles["subtitle"]))
    story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, spaceAfter=18))
    story.append(Paragraph(
        "A step-by-step guide to every feature of the Drivewell automotive service CRM — "
        "from signing in, through running a daily workshop, to broadcasting personalised "
        "WhatsApp and email messages to every client.",
        styles["body"],
    ))
    story.append(Spacer(1, 0.6 * cm))
    story.append(meta_row("Audience", "Drivewell staff (Admins, Managers, Service Advisors, Technicians, Parts Staff)."))
    story.append(meta_row("Version", "1.0"))
    story.append(meta_row("Status", "Living document — updated as features ship."))
    story.append(Spacer(1, 1 * cm))
    story.append(callout(
        "How to use this manual",
        "Each feature is a self-contained section. Skim the <b>Purpose</b> line at the top of a section to decide if it's the one you need, then follow the numbered steps. Sections are ordered the way a new team member would learn the app: sign in first, then daily work, then admin tasks.",
    ))
    story.append(PageBreak())

    # TOC page
    story.append(Paragraph("Contents", styles["h1"]))
    story.append(hr())
    story.append(Paragraph("Getting started", styles["toc_section"]))
    for s in SECTIONS[:2]:
        story.append(Paragraph(s["title"], styles["toc_item"]))
    story.append(Paragraph("Daily work", styles["toc_section"]))
    for s in SECTIONS[2:13]:
        story.append(Paragraph(s["title"], styles["toc_item"]))
    story.append(Paragraph("Personal & admin", styles["toc_section"]))
    for s in SECTIONS[13:]:
        story.append(Paragraph(s["title"], styles["toc_item"]))
    story.append(PageBreak())

    # Feature sections
    for s in SECTIONS:
        story.append(Paragraph(s["title"], styles["h1"]))
        story.append(hr())
        story.append(meta_row("Where", f'<font face="Courier">{s["route"]}</font>'))
        story.append(meta_row("Who", s["audience"]))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>Purpose.</b> {s['purpose']}", styles["body"]))
        story.append(Spacer(1, 4))

        for heading, kind, payload in s["sections"]:
            story.append(Paragraph(heading, styles["h3"]))
            if kind == "steps":
                story.append(numbered(payload))
            elif kind == "bullets":
                story.append(bullets(payload))
            elif kind == "para":
                story.append(Paragraph(payload, styles["body"]))
            elif kind == "tip":
                story.append(callout("Tip", payload, color=ACCENT, bg=BG_BOX))
            elif kind == "note":
                story.append(callout("Note", payload, color=MUTED, bg=BG_BOX))
            elif kind == "warn":
                story.append(callout("Warning", payload, color=WARN_RULE, bg=WARN_BG))
            elif kind == "code":
                # Preserve line breaks
                html = payload.replace("\n", "<br/>")
                story.append(Paragraph(html, styles["code"]))
            story.append(Spacer(1, 2))

        story.append(PageBreak())

    # Final page: glossary
    story.append(Paragraph("Glossary", styles["h1"]))
    story.append(hr())
    rows = [
        ("ADMIN", "Top-level role. Can manage users, configure messaging, and see all reviews."),
        ("MANAGER", "Can configure messaging, set KPI targets, and edit clients / orders. Sees all individual review scores."),
        ("SERVICE_ADVISOR", "Front-desk role. Can edit clients / orders, draft AI apologies, and send bulk messages."),
        ("TECHNICIAN", "Updates the status of orders assigned to them."),
        ("PARTS_STAFF", "Updates parts availability on orders."),
        ("Order status", "PENDING → IN_PROGRESS → COMPLETED. Side states: FAILED, ON_HOLD (both require a reason)."),
        ("Client status", "PROSPECT, ACTIVE, INACTIVE, ARCHIVED — manually set on the client detail page."),
        ("Service status", "Optional override at the client level so a client with no orders can still appear in dashboard filters."),
        ("Cycle (Reviews)", "A named review window, e.g. <font face='Courier'>2026-W21</font>. Each (reviewer, reviewee, cycle) pair is unique."),
        ("WAT", "West Africa Time (UTC+1). All clock-in / clock-out timestamps use it."),
        ("Bulk message", "A single send campaign — one BulkMessage row plus one BulkMessageRecipient row per client."),
    ]
    data = [[Paragraph(f"<b>{t}</b>", styles["body"]), Paragraph(d, styles["body"])] for t, d in rows]
    table = Table(data, colWidths=[4 * cm, 12.5 * cm])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.25, RULE),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)

    return story


def main():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=1.8 * cm,
        title="Drivewell AutoCRM — User Manual",
        author="Drivewell",
    )
    doc.build(build_story(), onFirstPage=on_page, onLaterPages=on_page)
    print("Wrote", OUTPUT)


if __name__ == "__main__":
    main()
