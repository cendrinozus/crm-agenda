"""
Voice transcription route.
Supports:
  - OpenAI Whisper  (TRANSCRIPTION_PROVIDER=whisper)
  - Google Speech-to-Text (TRANSCRIPTION_PROVIDER=google)
"""
import os
import uuid
from pathlib import Path

from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from ..models import db, MeetingNote, Meeting

voice_bp = Blueprint("voice", __name__)

ALLOWED_EXTENSIONS = {"mp3", "wav", "webm", "ogg", "m4a", "mp4"}


def _allowed(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@voice_bp.post("/transcribe")
@jwt_required()
def transcribe():
    """
    Multipart upload: audio file (field 'audio').
    Optional field 'meeting_id' to attach to a meeting note.
    Returns: { transcript, note_id? }
    """
    if "audio" not in request.files:
        return jsonify(error="No audio file provided"), 400

    file = request.files["audio"]
    if not _allowed(file.filename):
        return jsonify(error="Unsupported audio format"), 400

    # Save file
    upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = upload_dir / filename
    file.save(str(filepath))

    # Transcribe
    try:
        transcript = _transcribe(str(filepath))
    except Exception as e:
        filepath.unlink(missing_ok=True)
        return jsonify(error=f"Transcription failed: {str(e)}"), 500

    # Optionally attach to meeting note
    note_id = None
    meeting_id = request.form.get("meeting_id", type=int)
    if meeting_id:
        user_id = int(get_jwt_identity())
        meeting = Meeting.query.filter_by(id=meeting_id, user_id=user_id).first()
        if meeting:
            note = MeetingNote(
                meeting_id=meeting_id,
                transcript=transcript,
                voice_file=filename,
            )
            db.session.add(note)
            db.session.commit()
            note_id = note.id

    return jsonify(transcript=transcript, voice_file=filename, note_id=note_id)


# ── Transcription backends ─────────────────────────────────────────────────────

def _transcribe(filepath: str) -> str:
    provider = os.getenv("TRANSCRIPTION_PROVIDER", "whisper").lower()
    if provider == "google":
        return _transcribe_google(filepath)
    return _transcribe_whisper(filepath)


def _transcribe_whisper(filepath: str) -> str:
    import openai
    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    with open(filepath, "rb") as f:
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            language="fr",
        )
    return result.text


def _transcribe_google(filepath: str) -> str:
    from google.cloud import speech
    import io

    # Convert to LINEAR16 if needed via pydub
    audio_path = filepath
    if not filepath.endswith(".wav"):
        from pydub import AudioSegment
        sound = AudioSegment.from_file(filepath)
        wav_path = filepath.rsplit(".", 1)[0] + "_converted.wav"
        sound = sound.set_frame_rate(16000).set_channels(1)
        sound.export(wav_path, format="wav")
        audio_path = wav_path

    cred_path = os.getenv("GOOGLE_SPEECH_CREDENTIALS_PATH")
    client = speech.SpeechClient.from_service_account_file(cred_path) if cred_path \
        else speech.SpeechClient()

    with io.open(audio_path, "rb") as f:
        content = f.read()

    audio   = speech.RecognitionAudio(content=content)
    config  = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
        language_code="fr-FR",
        enable_automatic_punctuation=True,
    )
    response = client.recognize(config=config, audio=audio)
    return " ".join(r.alternatives[0].transcript for r in response.results)
