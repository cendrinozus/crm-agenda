from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import db, User, Meeting, Client, ExclusionRule, MeetingReview
from ..services.calendar_service import CalendarService

calendar_bp = Blueprint("calendar", __name__)


# ── Sync & Status ──────────────────────────────────────────────────────────────

@calendar_bp.post("/sync")
@jwt_required()
def sync():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify(error="User not found"), 404
    result = CalendarService(user).sync()
    return jsonify(result)


@calendar_bp.get("/status")
@jwt_required()
def status():
    user = User.query.get(int(get_jwt_identity()))
    count   = Meeting.query.filter_by(user_id=user.id).count()
    pending = Meeting.query.filter_by(user_id=user.id, review_status="pending").count()
    return jsonify({
        "connected":      bool(user.access_token),
        "token_expiry":   user.token_expiry.isoformat() if user.token_expiry else None,
        "total_synced":   count,
        "pending_review": pending,
    })


# ── Preview (dry-run before sync) ─────────────────────────────────────────────

@calendar_bp.get("/preview")
@jwt_required()
def preview():
    """Returns detection results without writing to DB — for the review UI."""
    user = User.query.get(int(get_jwt_identity()))
    results = CalendarService(user).preview(limit=100)
    return jsonify(results)


# ── Review queue ───────────────────────────────────────────────────────────────

@calendar_bp.get("/review")
@jwt_required()
def review_queue():
    """List meetings pending manual review."""
    user_id = int(get_jwt_identity())
    meetings = (
        Meeting.query
        .filter_by(user_id=user_id, review_status="pending")
        .order_by(Meeting.start_time.desc())
        .limit(200)
        .all()
    )
    return jsonify([m.to_dict() for m in meetings])


@calendar_bp.post("/review/<int:meeting_id>")
@jwt_required()
def resolve_review(meeting_id):
    """
    Resolve a pending meeting.
    Body: { "action": "confirm" | "exclude" | "assign", "client_id"?: int, "new_client_name"?: str }
    """
    user_id = int(get_jwt_identity())
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=user_id).first_or_404()
    body    = request.get_json() or {}
    action  = body.get("action")

    if action == "exclude":
        meeting.client_id     = None
        meeting.review_status = "excluded"

    elif action == "confirm":
        # Keep current auto-detected client, just mark confirmed
        meeting.review_status = "confirmed"

    elif action == "assign":
        client_id       = body.get("client_id")
        new_client_name = body.get("new_client_name")

        if client_id:
            meeting.client_id = client_id
        elif new_client_name:
            from ..services.calendar_service import _get_or_create_client
            client = _get_or_create_client(
                User.query.get(user_id), new_client_name
            )
            meeting.client_id = client.id if client else None
        meeting.review_status = "confirmed"

    else:
        return jsonify(error="Invalid action"), 400

    db.session.commit()
    return jsonify(meeting.to_dict())


@calendar_bp.post("/review/bulk")
@jwt_required()
def bulk_resolve():
    """
    Bulk resolve multiple meetings.
    Body: { "meeting_ids": [1,2,3], "action": "exclude" | "confirm" }
    """
    user_id = int(get_jwt_identity())
    body    = request.get_json() or {}
    ids     = body.get("meeting_ids", [])
    action  = body.get("action")

    if action not in ("exclude", "confirm"):
        return jsonify(error="Invalid action"), 400

    meetings = Meeting.query.filter(
        Meeting.id.in_(ids), Meeting.user_id == user_id
    ).all()

    for m in meetings:
        if action == "exclude":
            m.client_id     = None
            m.review_status = "excluded"
        else:
            m.review_status = "confirmed"

    db.session.commit()
    return jsonify(updated=len(meetings))


# ── Exclusion rules ────────────────────────────────────────────────────────────

@calendar_bp.get("/exclusions")
@jwt_required()
def list_exclusions():
    user_id = int(get_jwt_identity())
    rules = ExclusionRule.query.filter_by(user_id=user_id).order_by(ExclusionRule.id).all()
    return jsonify([r.to_dict() for r in rules])


@calendar_bp.post("/exclusions")
@jwt_required()
def create_exclusion():
    user_id = int(get_jwt_identity())
    body    = request.get_json() or {}
    pattern = body.get("pattern", "").strip()
    label   = body.get("label", "").strip()
    if not pattern:
        return jsonify(error="pattern required"), 400

    # Validate regex
    import re
    try:
        re.compile(pattern)
    except re.error as e:
        return jsonify(error=f"Invalid regex: {e}"), 400

    rule = ExclusionRule(user_id=user_id, pattern=pattern, label=label or pattern)
    db.session.add(rule)
    db.session.commit()
    return jsonify(rule.to_dict()), 201


@calendar_bp.delete("/exclusions/<int:rule_id>")
@jwt_required()
def delete_exclusion(rule_id):
    user_id = int(get_jwt_identity())
    rule = ExclusionRule.query.filter_by(id=rule_id, user_id=user_id).first_or_404()
    db.session.delete(rule)
    db.session.commit()
    return jsonify(message="Deleted")


@calendar_bp.patch("/exclusions/<int:rule_id>")
@jwt_required()
def toggle_exclusion(rule_id):
    user_id = int(get_jwt_identity())
    rule = ExclusionRule.query.filter_by(id=rule_id, user_id=user_id).first_or_404()
    rule.active = not rule.active
    db.session.commit()
    return jsonify(rule.to_dict())
