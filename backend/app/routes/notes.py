from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import db, Meeting, MeetingNote

notes_bp = Blueprint("notes", __name__)


def _check_meeting(meeting_id, user_id):
    return Meeting.query.filter_by(id=meeting_id, user_id=user_id).first_or_404()


@notes_bp.post("/meeting/<int:meeting_id>")
@jwt_required()
def create_note(meeting_id):
    user_id = int(get_jwt_identity())
    _check_meeting(meeting_id, user_id)
    body = request.get_json() or {}
    note = MeetingNote(
        meeting_id=meeting_id,
        note_text=body.get("note_text"),
        next_actions=body.get("next_actions"),
    )
    db.session.add(note)
    db.session.commit()
    return jsonify(note.to_dict()), 201


@notes_bp.put("/<int:note_id>")
@jwt_required()
def update_note(note_id):
    user_id = int(get_jwt_identity())
    note = MeetingNote.query.get_or_404(note_id)
    _check_meeting(note.meeting_id, user_id)
    body = request.get_json() or {}
    for field in ("note_text", "next_actions", "ai_summary", "ai_next_agenda"):
        if field in body:
            setattr(note, field, body[field])
    db.session.commit()
    return jsonify(note.to_dict())


@notes_bp.delete("/<int:note_id>")
@jwt_required()
def delete_note(note_id):
    user_id = int(get_jwt_identity())
    note = MeetingNote.query.get_or_404(note_id)
    _check_meeting(note.meeting_id, user_id)
    db.session.delete(note)
    db.session.commit()
    return jsonify(message="Note deleted")
