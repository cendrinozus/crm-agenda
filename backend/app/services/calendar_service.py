"""
CalendarService — Smart sync with:
  - Confidence scoring for client detection
  - Exclusion rules (internal events, personal blocks)
  - Pending review queue for ambiguous events
  - Fuzzy deduplication of client names
"""
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from ..models import db, User, Client, Meeting, ExclusionRule, MeetingReview

# ── Default exclusion patterns (applied to all users) ─────────────────────────
# Matches against event title (case-insensitive, partial match)
DEFAULT_EXCLUSIONS = [
    # Internal / ops blocks
    r"^CC$",                        # your recurring "CC" block
    r"^office\s*h(ours?)?$",        # Office Hours
    r"^\[?\d+\s*(off|break|pause)\]?$",  # [30 Off], [1-hour buffer]
    r"^buffer$",
    r"\bhour\s+buffer\b",
    r"^\[?buffer\]?$",
    r"^focus\s+time$",
    r"^blocked?$",
    r"^(lunch|déjeuner|diner|dinner|breakfast|petit.déjeuner)$",
    r"^(holiday|férié|congé|vacances|vacation)$",
    r"^(commute|trajet)$",
    r"^(gym|sport|yoga|meditation|méditation)$",
    r"^mother'?s?\s+day$",
    r"^(birthday|anniversaire)",
    # All-day personal
    r"^(weekend|samedi|dimanche)$",
]

# Confidence thresholds
CONFIDENCE_HIGH   = 0.80   # auto-assign client, no review needed
CONFIDENCE_MEDIUM = 0.50   # assign but flag for review
CONFIDENCE_LOW    = 0.0    # mark as "unclassified", put in review queue


class CalendarService:
    def __init__(self, user: User):
        self.user = user
        self._service = None
        self._user_exclusions: Optional[list] = None

    # ── Google API client ──────────────────────────────────────────────────────

    def _get_service(self):
        if self._service:
            return self._service

        creds = Credentials(
            token=self.user.access_token,
            refresh_token=self.user.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.environ["GOOGLE_CLIENT_ID"],
            client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        )
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            self.user.access_token = creds.token
            self.user.token_expiry = creds.expiry
            db.session.commit()

        self._service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        return self._service

    # ── Fetch events from Google ───────────────────────────────────────────────

    def fetch_events(self, months_past=6, months_ahead=3):
        service = self._get_service()
        now = datetime.now(timezone.utc)
        time_min = (now - timedelta(days=months_past * 30)).isoformat()
        time_max = (now + timedelta(days=months_ahead * 30)).isoformat()

        events, page_token = [], None
        while True:
            result = service.events().list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                maxResults=500,
                singleEvents=True,
                orderBy="startTime",
                pageToken=page_token,
            ).execute()
            events.extend(result.get("items", []))
            page_token = result.get("nextPageToken")
            if not page_token:
                break
        return events

    # ── Load user exclusion rules ──────────────────────────────────────────────

    def _get_exclusions(self) -> list:
        if self._user_exclusions is None:
            rows = ExclusionRule.query.filter_by(user_id=self.user.id, active=True).all()
            self._user_exclusions = [r.pattern for r in rows]
        return DEFAULT_EXCLUSIONS + self._user_exclusions

    # ── Main sync ──────────────────────────────────────────────────────────────

    def sync(self):
        raw_events = self.fetch_events()
        stats = {"synced": 0, "excluded": 0, "pending_review": 0, "total": len(raw_events)}

        for ev in raw_events:
            if ev.get("status") == "cancelled":
                continue

            title     = ev.get("summary", "")
            start_raw = ev.get("start", {})
            end_raw   = ev.get("end", {})
            start_dt  = _parse_dt(start_raw.get("dateTime") or start_raw.get("date"))
            end_dt    = _parse_dt(end_raw.get("dateTime")   or end_raw.get("date"))
            is_allday = "date" in start_raw and "dateTime" not in start_raw

            attendees = [
                {
                    "email": a.get("email"),
                    "name":  a.get("displayName"),
                    "self":  a.get("self", False),
                }
                for a in ev.get("attendees", [])
            ]

            # ── Step 1: exclusion check ────────────────────────────────────────
            if _should_exclude(title, is_allday, attendees, self._get_exclusions()):
                _upsert_meeting(self.user, ev, start_dt, end_dt, attendees,
                                client_id=None, review_status="excluded")
                stats["excluded"] += 1
                continue

            # ── Step 2: client detection with confidence score ─────────────────
            detection = _detect_client_with_confidence(ev, attendees)
            client_name = detection["name"]
            confidence  = detection["confidence"]
            method      = detection["method"]

            client = None
            review_status = "confirmed"

            if confidence >= CONFIDENCE_HIGH and client_name:
                client = _get_or_create_client(self.user, client_name)
                review_status = "confirmed"
            elif confidence >= CONFIDENCE_MEDIUM and client_name:
                client = _get_or_create_client(self.user, client_name)
                review_status = "pending"
                stats["pending_review"] += 1
            else:
                review_status = "pending"
                stats["pending_review"] += 1

            meeting = _upsert_meeting(self.user, ev, start_dt, end_dt, attendees,
                                      client_id=client.id if client else None,
                                      review_status=review_status)

            # Create/update review record for pending items
            if review_status == "pending":
                _upsert_review(meeting, detection)

            stats["synced"] += 1

        db.session.commit()
        return stats

    # ── Preview: what would be detected (without saving) ──────────────────────

    def preview(self, limit=50):
        """
        Returns a list of events with their detection result,
        for the frontend review UI — does NOT write to DB.
        """
        raw_events = self.fetch_events(months_past=2, months_ahead=2)
        results = []

        for ev in raw_events[:limit]:
            if ev.get("status") == "cancelled":
                continue
            title    = ev.get("summary", "")
            start_r  = ev.get("start", {})
            is_allday = "date" in start_r and "dateTime" not in start_r
            attendees = [
                {"email": a.get("email"), "name": a.get("displayName"), "self": a.get("self", False)}
                for a in ev.get("attendees", [])
            ]

            excluded = _should_exclude(title, is_allday, attendees, self._get_exclusions())
            detection = _detect_client_with_confidence(ev, attendees) if not excluded else {}

            results.append({
                "google_event_id": ev["id"],
                "title":           title,
                "start":           start_r.get("dateTime") or start_r.get("date"),
                "is_allday":       is_allday,
                "excluded":        excluded,
                "detected_client": detection.get("name"),
                "confidence":      detection.get("confidence", 0),
                "method":          detection.get("method"),
            })

        return results


# ── Detection engine ───────────────────────────────────────────────────────────

def _detect_client_with_confidence(event: dict, attendees: list) -> dict:
    """
    Returns {"name": str, "confidence": float, "method": str}

    Scoring rules:
    - External attendee with display name  → 0.95
    - External attendee email only         → 0.80
    - "Session with X" / "with X" pattern → 0.85
    - "1st/2nd/Xth session with X"        → 0.90
    - Prefix keyword (RDV, Meeting…) + name→ 0.75
    - Separator pattern (- | –)            → 0.65
    - Bare title (no separators)           → 0.40
    """
    # 1. External attendee
    for a in attendees:
        if not a.get("self"):
            if a.get("name"):
                return {"name": a["name"], "confidence": 0.95, "method": "attendee_name"}
            if a.get("email"):
                name = a["email"].split("@")[0].replace(".", " ").title()
                return {"name": name, "confidence": 0.80, "method": "attendee_email"}

    title = event.get("summary", "").strip()

    # 2. "Xth Session with NAME" — your most common pattern
    m = re.search(r"(?:\d+(?:st|nd|rd|th)?\s+)?session\s+with\s+(.+)$", title, re.IGNORECASE)
    if m:
        return {"name": m.group(1).strip(), "confidence": 0.90, "method": "session_with"}

    # 3. "with NAME" at end
    m = re.search(r"\bwith\s+(.+)$", title, re.IGNORECASE)
    if m:
        return {"name": m.group(1).strip(), "confidence": 0.85, "method": "with_pattern"}

    # 4. "avec NAME"
    m = re.search(r"\bavec\s+(.+)$", title, re.IGNORECASE)
    if m:
        return {"name": m.group(1).strip(), "confidence": 0.85, "method": "avec_pattern"}

    # 5. Keyword prefix: "RDV NAME", "Réunion NAME", "Appel NAME"
    m = re.search(
        r"^(?:RDV|Réunion|Meeting|Point|Suivi|Appel|Call|Entretien|Consultation|Coaching|Formation)\s+(.+)$",
        title, re.IGNORECASE
    )
    if m:
        candidate = m.group(1).strip()
        # Exclude if candidate is also a keyword
        if not re.match(r"^(de|du|avec|with|sur|pour)$", candidate, re.IGNORECASE):
            return {"name": candidate, "confidence": 0.75, "method": "keyword_prefix"}

    # 6. Separator: "NAME - something" or "something - NAME" or "NAME | ..."
    m = re.search(r"^(.+?)\s*[-–|]\s*(.+)$", title)
    if m:
        left, right = m.group(1).strip(), m.group(2).strip()
        # Heuristic: proper name is usually shorter and doesn't contain verbs
        candidate = left if len(left) <= len(right) else right
        return {"name": candidate, "confidence": 0.65, "method": "separator"}

    # 7. Fallback: bare title
    if title and len(title) <= 60:
        return {"name": title, "confidence": 0.40, "method": "bare_title"}

    return {"name": None, "confidence": 0.0, "method": "none"}


# ── Exclusion engine ───────────────────────────────────────────────────────────

def _should_exclude(title: str, is_allday: bool, attendees: list, patterns: list) -> bool:
    """Return True if this event should NOT be assigned to any client."""
    t = title.strip()

    # All-day events with no external attendees → likely personal/holiday
    external = [a for a in attendees if not a.get("self")]
    if is_allday and not external:
        return True

    # Empty title
    if not t:
        return True

    # Match against exclusion patterns
    for pattern in patterns:
        if re.search(pattern, t, re.IGNORECASE):
            return True

    return False


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _upsert_meeting(user, ev, start_dt, end_dt, attendees,
                    client_id=None, review_status="confirmed"):
    meeting = Meeting.query.filter_by(
        google_event_id=ev["id"], user_id=user.id
    ).first()
    is_new = meeting is None
    if is_new:
        meeting = Meeting(user_id=user.id, google_event_id=ev["id"])
        db.session.add(meeting)

    # Always refresh metadata from Google
    meeting.title       = ev.get("summary", "Sans titre")
    meeting.start_time  = start_dt
    meeting.end_time    = end_dt
    meeting.location    = ev.get("location")
    meeting.description = ev.get("description")
    meeting.attendees   = attendees
    meeting.status      = ev.get("status", "confirmed")

    # Preserve manual decisions: only assign client/status for new or still-pending meetings
    if is_new or meeting.review_status == "pending":
        meeting.client_id     = client_id
        meeting.review_status = review_status

    db.session.flush()
    return meeting


def _upsert_review(meeting: "Meeting", detection: dict):
    review = MeetingReview.query.filter_by(meeting_id=meeting.id).first()
    if not review:
        review = MeetingReview(meeting_id=meeting.id)
        db.session.add(review)
    review.suggested_client = detection.get("name")
    review.confidence       = detection.get("confidence", 0)
    review.detection_method = detection.get("method")


def _parse_dt(value):
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=None)
        except ValueError:
            continue
    return None


def _normalize_name(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r"\s+(lomé|abidjan|dakar|sarl|sa|sas|ltd|inc|group|groupe)$", "", name)
    name = re.sub(r"\s+", " ", name)
    return name


def _get_or_create_client(user: User, name: str) -> Optional[Client]:
    if not name:
        return None
    normalized = _normalize_name(name)
    for c in Client.query.filter_by(user_id=user.id).all():
        if _normalize_name(c.name) == normalized:
            return c
        if any(_normalize_name(a) == normalized for a in (c.aliases or [])):
            return c
    client = Client(user_id=user.id, name=name, aliases=[name])
    db.session.add(client)
    db.session.flush()
    return client
