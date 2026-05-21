"""
AI features powered by Claude (Anthropic).
Endpoints:
  POST /ai/summarize/<meeting_id>   → summarize meeting notes
  POST /ai/next-agenda/<meeting_id> → prepare next meeting agenda
  POST /ai/detect-tasks/<meeting_id>→ extract overdue/pending tasks
"""
import os
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import anthropic

from ..models import db, Meeting, MeetingNote

ai_bp = Blueprint("ai", __name__)


def _client():
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def _get_meeting_context(meeting: Meeting) -> str:
    notes = meeting.notes.order_by(MeetingNote.created_at.desc()).all()
    parts = [
        f"Réunion : {meeting.title}",
        f"Date : {meeting.start_time.strftime('%d/%m/%Y %H:%M') if meeting.start_time else 'N/A'}",
        f"Lieu : {meeting.location or 'N/A'}",
        f"Description : {meeting.description or 'Aucune'}",
    ]
    if meeting.attendees:
        names = [a.get("name") or a.get("email", "") for a in meeting.attendees if not a.get("self")]
        parts.append(f"Participants : {', '.join(names)}")
    for n in notes:
        if n.note_text:
            parts.append(f"\nNotes :\n{n.note_text}")
        if n.transcript:
            parts.append(f"\nTranscription vocale :\n{n.transcript}")
        if n.next_actions:
            parts.append(f"\nActions prévues :\n{n.next_actions}")
    return "\n".join(parts)


@ai_bp.post("/summarize/<int:meeting_id>")
@jwt_required()
def summarize(meeting_id):
    user_id = int(get_jwt_identity())
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=user_id).first_or_404()
    context = _get_meeting_context(meeting)

    message = _client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": (
                "Tu es un assistant professionnel. "
                "Génère un compte rendu professionnel et concis (max 200 mots) "
                "à partir des informations suivantes :\n\n"
                + context
            ),
        }],
    )
    summary = message.content[0].text

    # Persist on latest note
    note = meeting.notes.order_by(MeetingNote.created_at.desc()).first()
    if not note:
        note = MeetingNote(meeting_id=meeting_id)
        db.session.add(note)
    note.ai_summary = summary
    db.session.commit()

    return jsonify(summary=summary, note_id=note.id)


@ai_bp.post("/next-agenda/<int:meeting_id>")
@jwt_required()
def next_agenda(meeting_id):
    user_id = int(get_jwt_identity())
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=user_id).first_or_404()
    context = _get_meeting_context(meeting)

    client_name = meeting.client.name if meeting.client else "ce client"
    message = _client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": (
                f"Tu es un assistant professionnel. "
                f"Sur la base des notes et actions de la dernière réunion avec {client_name}, "
                f"prépare un ordre du jour structuré pour le prochain rendez-vous.\n\n"
                f"Informations de la réunion précédente :\n{context}\n\n"
                "Format : liste numérotée de points à aborder, avec durée estimée."
            ),
        }],
    )
    agenda = message.content[0].text

    note = meeting.notes.order_by(MeetingNote.created_at.desc()).first()
    if not note:
        note = MeetingNote(meeting_id=meeting_id)
        db.session.add(note)
    note.ai_next_agenda = agenda
    db.session.commit()

    return jsonify(agenda=agenda, note_id=note.id)


@ai_bp.post("/detect-tasks/<int:meeting_id>")
@jwt_required()
def detect_tasks(meeting_id):
    user_id = int(get_jwt_identity())
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=user_id).first_or_404()
    context = _get_meeting_context(meeting)

    message = _client().messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": (
                "Analyse les notes de cette réunion et extrait toutes les tâches, "
                "actions à réaliser et engagements pris. "
                "Indique pour chacune : la tâche, le responsable si mentionné, "
                "et la date limite si mentionnée.\n\n"
                "Format JSON uniquement : [{\"task\": ..., \"owner\": ..., \"due\": ...}]\n\n"
                + context
            ),
        }],
    )
    import json, re
    raw = message.content[0].text
    # Extract JSON array robustly
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    try:
        tasks = json.loads(match.group()) if match else []
    except Exception:
        tasks = []

    return jsonify(tasks=tasks)
