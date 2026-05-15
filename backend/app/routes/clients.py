from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import db, User, Client, Meeting
from datetime import datetime

clients_bp = Blueprint("clients", __name__)


@clients_bp.get("")
@jwt_required()
def list_clients():
    user_id = int(get_jwt_identity())
    q = request.args.get("q", "").strip()
    query = Client.query.filter_by(user_id=user_id)
    if q:
        query = query.filter(Client.name.ilike(f"%{q}%"))
    clients = query.order_by(Client.name).all()
    return jsonify([c.to_dict(include_stats=True) for c in clients])


@clients_bp.get("/<int:client_id>")
@jwt_required()
def get_client(client_id):
    user_id = int(get_jwt_identity())
    client = Client.query.filter_by(id=client_id, user_id=user_id).first_or_404()
    data = client.to_dict(include_stats=True)
    # Full meeting list
    meetings = (
        client.meetings
        .order_by(Meeting.start_time.desc())
        .all()
    )
    data["meetings"] = [m.to_dict(include_notes=True) for m in meetings]
    return jsonify(data)


@clients_bp.put("/<int:client_id>")
@jwt_required()
def update_client(client_id):
    user_id = int(get_jwt_identity())
    client = Client.query.filter_by(id=client_id, user_id=user_id).first_or_404()
    body = request.get_json() or {}
    for field in ("name", "company", "email", "phone", "notes", "color"):
        if field in body:
            setattr(client, field, body[field])
    if "aliases" in body:
        client.aliases = body["aliases"]
    db.session.commit()
    return jsonify(client.to_dict())


@clients_bp.patch("/<int:client_id>/workflow")
@jwt_required()
def set_workflow_stage(client_id):
    user_id = int(get_jwt_identity())
    client = Client.query.filter_by(id=client_id, user_id=user_id).first_or_404()
    body = request.get_json() or {}
    client.workflow_stage = body.get("stage")  # None clears the stage
    db.session.commit()
    return jsonify({"workflow_stage": client.workflow_stage})


@clients_bp.post("/<int:client_id>/merge")
@jwt_required()
def merge_clients(client_id):
    """Merge another client into this one."""
    user_id = int(get_jwt_identity())
    body = request.get_json() or {}
    source_id = body.get("source_id")
    if not source_id:
        return jsonify(error="source_id required"), 400

    target = Client.query.filter_by(id=client_id, user_id=user_id).first_or_404()
    source = Client.query.filter_by(id=source_id, user_id=user_id).first_or_404()

    # Reassign meetings
    Meeting.query.filter_by(client_id=source.id).update({"client_id": target.id})

    # Merge aliases
    aliases = list(set((target.aliases or []) + (source.aliases or []) + [source.name]))
    target.aliases = aliases

    db.session.delete(source)
    db.session.commit()
    return jsonify(target.to_dict(include_stats=True))


@clients_bp.delete("/<int:client_id>")
@jwt_required()
def delete_client(client_id):
    user_id = int(get_jwt_identity())
    client = Client.query.filter_by(id=client_id, user_id=user_id).first_or_404()
    db.session.delete(client)
    db.session.commit()
    return jsonify(message="Client deleted")
