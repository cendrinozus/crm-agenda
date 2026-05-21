from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import db, Meeting, MeetingNote

meetings_bp = Blueprint("meetings", __name__)


@meetings_bp.get("")
@jwt_required()
def list_meetings():
    user_id = int(get_jwt_identity())
    client_id = request.args.get("client_id", type=int)
    query = Meeting.query.filter_by(user_id=user_id)
    if client_id:
        query = query.filter_by(client_id=client_id)
    meetings = query.order_by(Meeting.start_time.desc()).limit(100).all()
    return jsonify([m.to_dict() for m in meetings])


@meetings_bp.get("/<int:meeting_id>")
@jwt_required()
def get_meeting(meeting_id):
    user_id = int(get_jwt_identity())
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=user_id).first_or_404()
    return jsonify(meeting.to_dict(include_notes=True))


@meetings_bp.put("/<int:meeting_id>/client")
@jwt_required()
def assign_client(meeting_id):
    """Manually assign or reassign a client to a meeting."""
    user_id = int(get_jwt_identity())
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=user_id).first_or_404()
    body = request.get_json() or {}
    meeting.client_id = body.get("client_id")
    db.session.commit()
    return jsonify(meeting.to_dict())
