import json
import os
import pathlib
import hashlib
import hmac
import secrets
import sqlite3
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT = pathlib.Path(__file__).resolve().parent
load_env_path = ROOT / ".env.local"


def load_env_file(file_path: pathlib.Path) -> None:
    if not file_path.exists():
        return

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file(load_env_path)

HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "3000"))
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
API_KEY = os.environ.get("GEMINI_API_KEY", "")
AUTH_DB_PATH = ROOT / "auth.db"
PBKDF2_ITERATIONS = 200_000

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
}


def init_auth_db() -> None:
    with sqlite3.connect(AUTH_DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(email, role)
            )
            """
        )
        connection.commit()


def hash_password(password: str, salt_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return digest.hex()


def normalize_email(value: str) -> str:
    return value.strip().lower()


def is_valid_role(value: str) -> bool:
    return value in {"manager", "member"}


def is_valid_email(value: str) -> bool:
    return bool(value) and "@" in value and "." in value and " " not in value


def create_or_verify_user(email: str, role: str, password: str):
    now = current_timestamp()
    with sqlite3.connect(AUTH_DB_PATH) as connection:
        row = connection.execute(
            """
            SELECT password_hash, password_salt
            FROM users
            WHERE email = ? AND role = ?
            """,
            (email, role),
        ).fetchone()

        if row is None:
            salt_hex = secrets.token_hex(16)
            password_hash = hash_password(password, salt_hex)
            connection.execute(
                """
                INSERT INTO users (email, role, password_hash, password_salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (email, role, password_hash, salt_hex, now, now),
            )
            connection.commit()
            return {"email": email, "role": role, "created": True}

        password_hash, password_salt = row
        supplied_hash = hash_password(password, password_salt)
        if not hmac.compare_digest(password_hash, supplied_hash):
            return None

        connection.execute(
            """
            UPDATE users
            SET updated_at = ?
            WHERE email = ? AND role = ?
            """,
            (now, email, role),
        )
        connection.commit()
        return {"email": email, "role": role, "created": False}


class ProjectTrackerHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/health":
            self.write_json(200, {"ok": True, "model": MODEL})
            return

        self.serve_static()

    def do_POST(self):
        if self.path == "/api/auth/login":
            self.handle_auth_login()
            return

        if self.path == "/api/agent":
            self.handle_agent_request()
            return

        self.write_json(405, {"error": "Method not allowed."})

    def handle_auth_login(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self.write_json(400, {"error": "Invalid JSON body."})
            return

        email = normalize_email(str(payload.get("email", "")))
        password = str(payload.get("password", ""))
        role = str(payload.get("role", "")).strip().lower()

        if not is_valid_role(role):
            self.write_json(400, {"error": "Choose either project manager or team member."})
            return

        if not is_valid_email(email):
            self.write_json(400, {"error": "A valid email address is required."})
            return

        if len(password) < 6:
            self.write_json(400, {"error": "Password must be at least 6 characters."})
            return

        user = create_or_verify_user(email, role, password)
        if user is None:
            self.write_json(401, {"error": "Incorrect password for that account."})
            return

        self.write_json(
            200,
            {
                "ok": True,
                "created": user["created"],
                "user": {
                    "email": user["email"],
                    "role": user["role"],
                },
            },
        )

    def handle_agent_request(self):
        if not API_KEY:
            self.write_json(500, {"error": "GEMINI_API_KEY is missing in .env.local."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self.write_json(400, {"error": "Invalid JSON body."})
            return

        message = str(payload.get("message", "")).strip()
        project = payload.get("project", {})
        role = payload.get("role") or "unknown"
        team_id = payload.get("teamId")
        chat_history = payload.get("chatHistory") or []

        if not message:
            self.write_json(400, {"error": "A message is required."})
            return

        active_team = None
        for team in project.get("teams", []):
            if team.get("id") == team_id:
                active_team = team.get("name")
                break

        system_instruction = "\n".join(
            [
                "You are Quantum Assistant, a Gemini-powered project tracker agent.",
                "Answer using only the project data provided below. If the answer is not in the data, say that clearly instead of inventing details.",
                "Be concise, practical, and helpful.",
                "You can summarize blockers, deadlines, team structure, notes, bugs, and scheduled tasks.",
                "You do not directly edit the project from chat in this version; tell the user to use the manager tools in the app when they ask to change data.",
                f"Gemini model in use: {MODEL}.",
                f"Current app role: {role}.",
                f"Current active team: {active_team or 'none selected'}.",
                "Project data:",
                json.dumps(project),
            ]
        )

        contents = []
        for item in chat_history[-12:]:
            text = str(item.get("text", "")).strip()
            role_name = item.get("role") or "user"
            if not text:
                continue
            contents.append({"role": role_name, "parts": [{"text": text}]})

        if not contents or contents[-1]["parts"][0]["text"] != message:
            contents.append({"role": "user", "parts": [{"text": message}]})

        request_body = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
        }

        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{MODEL}:generateContent"
        )

        request = urllib.request.Request(
            endpoint,
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": API_KEY,
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            try:
                error_payload = json.loads(error.read().decode("utf-8"))
                error_message = (
                    error_payload.get("error", {}).get("message")
                    or "Gemini request failed."
                )
            except Exception:
                error_message = "Gemini request failed."

            self.write_json(error.code, {"error": error_message})
            return
        except Exception as error:
            self.write_json(500, {"error": f"Gemini request failed: {error}"})
            return

        text = extract_response_text(response_payload)
        self.write_json(200, {"text": text})

    def serve_static(self):
        request_path = "/index.html" if self.path == "/" else self.path
        relative = pathlib.Path(request_path.lstrip("/"))
        file_path = (ROOT / relative).resolve()

        if ROOT not in file_path.parents and file_path != ROOT / "index.html":
            self.write_json(403, {"error": "Forbidden."})
            return

        if not file_path.exists() or not file_path.is_file():
            self.write_json(404, {"error": "Not found."})
            return

        self.send_response(200)
        self.send_cors_headers()
        self.send_header("Content-Type", MIME_TYPES.get(file_path.suffix.lower(), "application/octet-stream"))
        self.end_headers()
        self.wfile.write(file_path.read_bytes())

    def write_json(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def log_message(self, fmt, *args):
        return


def extract_response_text(payload):
    candidates = payload.get("candidates") or []
    for candidate in candidates:
      content = candidate.get("content") or {}
      parts = content.get("parts") or []
      texts = [part.get("text", "") for part in parts if part.get("text")]
      if texts:
          return "\n".join(texts).strip()

    prompt_feedback = payload.get("promptFeedback")
    if prompt_feedback:
        return f"Gemini returned no text. Feedback: {json.dumps(prompt_feedback)}"

    return "Gemini returned no text."


def main():
    init_auth_db()
    server = ThreadingHTTPServer((HOST, PORT), ProjectTrackerHandler)
    print(f"Quantum Scope Python server running at http://{HOST}:{PORT}")
    server.serve_forever()


def current_timestamp() -> str:
    return __import__("datetime").datetime.utcnow().isoformat() + "Z"


if __name__ == "__main__":
    main()
