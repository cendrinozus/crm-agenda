import os
from datetime import datetime, timedelta

from flask import Blueprint, redirect, request, jsonify, session
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from google.oauth2 import id_token
from google_auth_oauthlib.flow import Flow
from google.auth.transport import requests as google_requests

from ..models import db, User

auth_bp = Blueprint("auth", __name__)

SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.readonly",
]


def _build_flow(state=None):
    return Flow.from_client_config(
        {
            "web": {
                "client_id":     os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri":      "https://accounts.google.com/o/oauth2/auth",
                "token_uri":     "https://oauth2.googleapis.com/token",
                "redirect_uris": [os.environ["GOOGLE_REDIRECT_URI"]],
            }
        },
        scopes=SCOPES,
        redirect_uri=os.environ["GOOGLE_REDIRECT_URI"],
        state=state,
    )


@auth_bp.get("/google")
def google_login():
    flow = _build_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    session["oauth_state"] = state
    return redirect(auth_url)


@auth_bp.get("/google/callback")
def google_callback():
    flow = _build_flow(state=session.get("oauth_state"))
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials

    id_info = id_token.verify_oauth2_token(
        credentials.id_token,
        google_requests.Request(),
        os.environ["GOOGLE_CLIENT_ID"],
    )

    google_id = id_info["sub"]
    user = User.query.filter_by(google_id=google_id).first()

    if not user:
        user = User(
            google_id=google_id,
            email=id_info["email"],
            name=id_info.get("name"),
            picture=id_info.get("picture"),
        )
        db.session.add(user)

    user.access_token  = credentials.token
    user.refresh_token = credentials.refresh_token or user.refresh_token
    user.token_expiry  = credentials.expiry
    db.session.commit()

    access_token  = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return redirect(
        f"{frontend_url}/auth/callback"
        f"?access_token={access_token}"
        f"&refresh_token={refresh_token}"
    )


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    new_token = create_access_token(identity=user_id)
    return jsonify(access_token=new_token)


@auth_bp.get("/me")
@jwt_required()
def me():
    user = User.query.get(int(get_jwt_identity()))
    if not user:
        return jsonify(error="User not found"), 404
    return jsonify(user.to_dict())


@auth_bp.post("/logout")
@jwt_required()
def logout():
    return jsonify(message="Logged out successfully")
