#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


BUILT_IN_ACCOUNTS = {
    "tester001@qscope": "test001",
    "admin@qscope": "admin",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the QScope project tracker server.")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on.")
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to. Use 0.0.0.0 to listen on all interfaces.",
    )
    return parser.parse_args()


def json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict[str, object]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def html_response(handler: SimpleHTTPRequestHandler, status: int, title: str, message: str) -> None:
    body = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      body {{
        font-family: system-ui, sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #97b1ea;
        color: #334e7f;
      }}
      main {{
        background: #f8df9d;
        padding: 32px;
        border-radius: 24px;
        max-width: 640px;
        margin: 24px;
        box-shadow: 0 24px 50px rgba(56, 76, 133, 0.16);
      }}
      a {{
        color: inherit;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>{title}</h1>
      <p>{message}</p>
      <p><a href="/">Back to the app</a></p>
    </main>
  </body>
</html>"""
    data = body.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "text/html; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return hashlib.sha256(f"qscope::{password}".encode("utf-8")).hexdigest()


def load_state(state_file: Path) -> dict[str, list[dict[str, object]]]:
    if not state_file.exists():
        return {"approved_accounts": [], "pending_accounts": []}

    try:
        with state_file.open("r", encoding="utf-8") as file_handle:
            state = json.load(file_handle)
    except (json.JSONDecodeError, OSError):
        return {"approved_accounts": [], "pending_accounts": []}

    if not isinstance(state, dict):
        return {"approved_accounts": [], "pending_accounts": []}

    approved_accounts = state.get("approved_accounts", [])
    pending_accounts = state.get("pending_accounts", [])
    return {
        "approved_accounts": approved_accounts if isinstance(approved_accounts, list) else [],
        "pending_accounts": pending_accounts if isinstance(pending_accounts, list) else [],
    }


def save_state(state_file: Path, state: dict[str, list[dict[str, object]]]) -> None:
    with state_file.open("w", encoding="utf-8") as file_handle:
        json.dump(state, file_handle, indent=2)


def send_approval_email(
    recipient: str,
    approval_link: str,
    denial_link: str,
    applicant_email: str,
) -> None:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_password or not smtp_from:
        raise RuntimeError(
            "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM."
        )

    message = EmailMessage()
    message["Subject"] = f"QScope registration approval needed for {applicant_email}"
    message["From"] = smtp_from
    message["To"] = recipient
    message.set_content(
        "\n".join(
            [
                f"A registration request was submitted for {applicant_email}.",
                "",
                f"Approve: {approval_link}",
                f"Deny: {denial_link}",
            ]
        )
    )

    context = ssl.create_default_context()
    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
        smtp.starttls(context=context)
        smtp.login(smtp_user, smtp_password)
        smtp.send_message(message)


class AppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, state_file: Path, approval_email: str, **kwargs):
        self.state_file = state_file
        self.approval_email = approval_email
        super().__init__(*args, **kwargs)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        print(format % args)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/approve":
            self.handle_decision(parsed, approved=True)
            return

        if parsed.path == "/deny":
            self.handle_decision(parsed, approved=False)
            return

        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)

        if parsed.path == "/api/login":
            self.handle_login()
            return

        if parsed.path == "/api/register":
            self.handle_register()
            return

        json_response(self, 404, {"ok": False, "message": "Unknown endpoint."})

    def read_json(self) -> dict[str, object]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"
        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            return {}
        return payload if isinstance(payload, dict) else {}

    def handle_login(self) -> None:
        payload = self.read_json()
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not email or not password:
            json_response(self, 400, {"ok": False, "message": "Email and password are required."})
            return

        if BUILT_IN_ACCOUNTS.get(email) == password:
            json_response(self, 200, {"ok": True, "email": email, "source": "built-in"})
            return

        state = load_state(self.state_file)
        for account in state["approved_accounts"]:
            if account.get("email") == email and account.get("password_hash") == hash_password(password):
                json_response(self, 200, {"ok": True, "email": email, "source": "approved"})
                return

        json_response(self, 401, {"ok": False, "message": "Invalid email or password."})

    def handle_register(self) -> None:
        payload = self.read_json()
        email = str(payload.get("email", "")).strip().lower()
        password = str(payload.get("password", ""))

        if not email or not password:
            json_response(self, 400, {"ok": False, "message": "Email and password are required."})
            return

        if email in BUILT_IN_ACCOUNTS:
            json_response(self, 409, {"ok": False, "message": "That account already exists."})
            return

        state = load_state(self.state_file)
        if any(account.get("email") == email for account in state["approved_accounts"]):
            json_response(self, 409, {"ok": False, "message": "That account already exists."})
            return

        if any(account.get("email") == email for account in state["pending_accounts"]):
            json_response(self, 409, {"ok": False, "message": "That account is already waiting for approval."})
            return

        token = hashlib.sha256(f"{email}:{password}:{now_iso()}".encode("utf-8")).hexdigest()
        pending_account = {
            "email": email,
            "password_hash": hash_password(password),
            "token": token,
            "created_at": now_iso(),
        }

        base_url = os.getenv("APPROVAL_BASE_URL", f"http://127.0.0.1:{self.server.server_address[1]}")
        approval_link = f"{base_url}/approve?token={token}"
        denial_link = f"{base_url}/deny?token={token}"

        try:
            send_approval_email(self.approval_email, approval_link, denial_link, email)
        except Exception as error:  # noqa: BLE001
            json_response(
                self,
                500,
                {
                    "ok": False,
                    "message": f"Approval email could not be sent: {error}",
                },
            )
            return

        state["pending_accounts"].append(pending_account)
        save_state(self.state_file, state)

        json_response(
            self,
            200,
            {
                "ok": True,
                "message": f"Registration request sent to {self.approval_email} for approval.",
            },
        )

    def handle_decision(self, parsed, approved: bool) -> None:
        query = parse_qs(parsed.query)
        token = query.get("token", [""])[0]

        if not token:
            html_response(self, 400, "Missing token", "This approval link is missing its token.")
            return

        state = load_state(self.state_file)
        pending_accounts = state["pending_accounts"]
        match_index = next(
            (index for index, account in enumerate(pending_accounts) if account.get("token") == token),
            None,
        )

        if match_index is None:
            html_response(self, 404, "Request not found", "That registration request was not found or was already handled.")
            return

        pending_account = pending_accounts.pop(match_index)
        if approved:
            state["approved_accounts"].append(
                {
                    "email": pending_account["email"],
                    "password_hash": pending_account["password_hash"],
                    "approved_at": now_iso(),
                }
            )
            save_state(self.state_file, state)
            html_response(
                self,
                200,
                "Account approved",
                f"{pending_account['email']} is now approved and can log in.",
            )
            return

        save_state(self.state_file, state)
        html_response(
            self,
            200,
            "Account denied",
            f"{pending_account['email']} was denied registration.",
        )


def main() -> None:
    args = parse_args()
    web_root = Path(__file__).resolve().parent
    os.chdir(web_root)
    state_file = web_root / "server_state.json"
    approval_email = os.getenv("APPROVAL_EMAIL", "mail2farhan.aws@gmail.com")

    def handler(*handler_args, **handler_kwargs):
        return AppHandler(*handler_args, state_file=state_file, approval_email=approval_email, **handler_kwargs)

    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {web_root} at http://{args.host}:{args.port}")
    print(f"Approval emails will be sent to {approval_email}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
