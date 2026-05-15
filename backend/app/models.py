from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from cryptography.fernet import Fernet
import os

db = SQLAlchemy()

# ── Token encryption helper ────────────────────────────────────────────────────

def _fernet():
    key = os.getenv("ENCRYPTION_KEY", Fernet.generate_key())
    if isinstance(key, str):
        key = key.encode()
    return Fernet(key)

def encrypt_token(value: str) -> str:
    if not value:
        return value
    return _fernet().encrypt(value.encode()).decode()

def decrypt_token(value: str) -> str:
    if not value:
        return value
    return _fernet().decrypt(value.encode()).decode()


# ── Models ─────────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = "users"

    id              = db.Column(db.Integer, primary_key=True)
    google_id       = db.Column(db.String(128), unique=True, nullable=False)
    email           = db.Column(db.String(191), unique=True, nullable=False)
    name            = db.Column(db.String(256))
    picture         = db.Column(db.Text)
    _access_token   = db.Column("access_token",  db.Text)
    _refresh_token  = db.Column("refresh_token", db.Text)
    token_expiry    = db.Column(db.DateTime)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    clients  = db.relationship("Client",  back_populates="user", lazy="dynamic")
    meetings = db.relationship("Meeting", back_populates="user", lazy="dynamic")

    @property
    def access_token(self):
        return decrypt_token(self._access_token) if self._access_token else None

    @access_token.setter
    def access_token(self, value):
        self._access_token = encrypt_token(value)

    @property
    def refresh_token(self):
        return decrypt_token(self._refresh_token) if self._refresh_token else None

    @refresh_token.setter
    def refresh_token(self, value):
        self._refresh_token = encrypt_token(value)

    def to_dict(self):
        return {
            "id":         self.id,
            "email":      self.email,
            "name":       self.name,
            "picture":    self.picture,
            "created_at": self.created_at.isoformat(),
        }


class Client(db.Model):
    __tablename__ = "clients"

    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name         = db.Column(db.String(256), nullable=False)
    company      = db.Column(db.String(256))
    email        = db.Column(db.String(256))
    phone        = db.Column(db.String(64))
    notes        = db.Column(db.Text)
    aliases      = db.Column(db.JSON, default=list)   # variants detected
    color          = db.Column(db.String(16), default="#3B82F6")
    workflow_stage = db.Column(db.String(64), nullable=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user     = db.relationship("User",    back_populates="clients")
    meetings = db.relationship("Meeting", back_populates="client", lazy="dynamic")

    def to_dict(self, include_stats=False):
        data = {
            "id":         self.id,
            "name":       self.name,
            "company":    self.company,
            "email":      self.email,
            "phone":      self.phone,
            "notes":      self.notes,
            "aliases":    self.aliases or [],
            "color":          self.color,
            "workflow_stage": self.workflow_stage,
            "created_at":     self.created_at.isoformat(),
        }
        if include_stats:
            now = datetime.utcnow()
            all_m = self.meetings.order_by(Meeting.start_time.desc()).all()
            past  = [m for m in all_m if m.start_time < now]
            upcoming = [m for m in all_m if m.start_time >= now]
            data["total_meetings"]    = len(all_m)
            data["last_meeting"]      = past[0].to_dict()   if past     else None
            data["next_meeting"]      = upcoming[-1].to_dict() if upcoming else None
        return data


class Meeting(db.Model):
    __tablename__ = "meetings"

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey("users.id"),   nullable=False)
    client_id       = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=True)
    google_event_id = db.Column(db.String(191), unique=True)
    title           = db.Column(db.String(512))
    start_time      = db.Column(db.DateTime)
    end_time        = db.Column(db.DateTime)
    location        = db.Column(db.String(512))
    description     = db.Column(db.Text)
    attendees       = db.Column(db.JSON, default=list)
    status          = db.Column(db.String(32), default="confirmed")
    # confirmed | pending | excluded
    review_status   = db.Column(db.String(32), default="confirmed")
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user   = db.relationship("User",   back_populates="meetings")
    client = db.relationship("Client", back_populates="meetings")
    notes  = db.relationship("MeetingNote", back_populates="meeting",
                             cascade="all, delete-orphan", lazy="dynamic")
    review = db.relationship("MeetingReview", back_populates="meeting",
                             uselist=False, cascade="all, delete-orphan")

    def to_dict(self, include_notes=False):
        data = {
            "id":              self.id,
            "google_event_id": self.google_event_id,
            "client_id":       self.client_id,
            "title":           self.title,
            "start_time":      self.start_time.isoformat() if self.start_time else None,
            "end_time":        self.end_time.isoformat()   if self.end_time   else None,
            "location":        self.location,
            "description":     self.description,
            "attendees":       self.attendees or [],
            "status":          self.status,
            "review_status":   self.review_status,
            "review":          self.review.to_dict() if self.review else None,
        }
        if include_notes:
            data["notes"] = [n.to_dict() for n in self.notes.order_by(MeetingNote.created_at.desc())]
        return data


class MeetingNote(db.Model):
    __tablename__ = "meeting_notes"

    id             = db.Column(db.Integer, primary_key=True)
    meeting_id     = db.Column(db.Integer, db.ForeignKey("meetings.id"), nullable=False)
    note_text      = db.Column(db.Text)
    next_actions   = db.Column(db.Text)
    voice_file     = db.Column(db.String(512))
    transcript     = db.Column(db.Text)
    ai_summary     = db.Column(db.Text)
    ai_next_agenda = db.Column(db.Text)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    meeting = db.relationship("Meeting", back_populates="notes")

    def to_dict(self):
        return {
            "id":             self.id,
            "meeting_id":     self.meeting_id,
            "note_text":      self.note_text,
            "next_actions":   self.next_actions,
            "voice_file":     self.voice_file,
            "transcript":     self.transcript,
            "ai_summary":     self.ai_summary,
            "ai_next_agenda": self.ai_next_agenda,
            "created_at":     self.created_at.isoformat(),
        }


class MeetingReview(db.Model):
    """
    Stores the AI detection suggestion for events that need manual review.
    review_status on Meeting: 'pending' | 'confirmed' | 'excluded'
    """
    __tablename__ = "meeting_reviews"

    id               = db.Column(db.Integer, primary_key=True)
    meeting_id       = db.Column(db.Integer, db.ForeignKey("meetings.id"),
                                 unique=True, nullable=False)
    suggested_client = db.Column(db.String(256))
    confidence       = db.Column(db.Float, default=0.0)
    detection_method = db.Column(db.String(64))
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    meeting = db.relationship("Meeting", back_populates="review")

    def to_dict(self):
        return {
            "id":               self.id,
            "suggested_client": self.suggested_client,
            "confidence":       round(self.confidence, 2),
            "detection_method": self.detection_method,
        }


class ExclusionRule(db.Model):
    """
    Per-user regex patterns for events to exclude from client tracking.
    E.g. pattern="^CC$" will exclude your recurring CC block.
    """
    __tablename__ = "exclusion_rules"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    pattern    = db.Column(db.String(512), nullable=False)
    label      = db.Column(db.String(256))        # human-readable description
    active     = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id":      self.id,
            "pattern": self.pattern,
            "label":   self.label,
            "active":  self.active,
        }
