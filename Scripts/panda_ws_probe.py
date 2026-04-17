#!/usr/bin/env python3
"""
Probe PandaLive danmaku websocket and print live chat messages.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import ssl
import subprocess
import sys
from typing import Any

try:
    import websockets
except ImportError as exc:  # pragma: no cover - local tool guard
    raise SystemExit(
        "Missing dependency: websockets. Install it or run in an environment that already has it."
    ) from exc


DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
)
WEB_BASE = "https://www.pandalive.co.kr"
API_BASE = "https://api.pandalive.co.kr"
WS_URL = "wss://chat-ws.neolive.kr/connection/websocket"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch PandaLive play info, connect danmaku websocket, and print live chat messages."
    )
    parser.add_argument(
        "--room-id",
        required=True,
        help="PandaLive room ID / user ID, for example anothercp.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=5,
        help="Number of chatter messages to collect. Default: 5.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Per-frame receive timeout in seconds. Default: 10.",
    )
    parser.add_argument(
        "--verify-tls",
        action="store_true",
        help=(
            "Verify websocket TLS certificate chain. "
            "By default this probe skips verification because chat-ws.neolive.kr may fail local issuer validation."
        ),
    )
    return parser.parse_args()


def curl_json(url: str, referer: str, body: str) -> dict[str, Any]:
    result = subprocess.run(
        [
            "curl",
            "-sS",
            url,
            "-H",
            f"User-Agent: {DEFAULT_UA}",
            "-H",
            "Accept: application/json, text/plain, */*",
            "-H",
            "Accept-Language: ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "-H",
            f"Origin: {WEB_BASE}",
            "-H",
            f"Referer: {referer}",
            "-H",
            "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
            "--data",
            body,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def fetch_play_payload(room_id: str) -> dict[str, Any]:
    member = curl_json(
        f"{API_BASE}/v1/member/bj",
        f"{WEB_BASE}/play/{room_id}",
        f"userId={room_id}",
    )
    if not member.get("result") or "bjInfo" not in member:
        raise RuntimeError(member.get("message") or "member lookup failed")
    user_idx = str(member["bjInfo"]["idx"])
    play = curl_json(
        f"{API_BASE}/v1/live/play",
        f"{WEB_BASE}/play/{room_id}",
        f"action=watch&userId={user_idx}",
    )
    if not play.get("result"):
        raise RuntimeError(play.get("message") or "live play lookup failed")
    if "channel" not in play or "token" not in play:
        raise RuntimeError("live play response is missing channel/token")
    return {
        "roomId": room_id,
        "userIdx": user_idx,
        "channel": str(play["channel"]),
        "token": str(play["token"]),
        "chatServerToken": str((play.get("chatServer") or {}).get("token") or ""),
        "play": play,
    }


def make_ssl_context(verify_tls: bool) -> ssl.SSLContext | None:
    if verify_tls:
        return None
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


async def collect_messages(
    room_id: str,
    count: int,
    timeout: float,
    verify_tls: bool,
) -> dict[str, Any]:
    payload = fetch_play_payload(room_id)
    channel = payload["channel"]
    token = payload["token"]
    connect_message = {
        "params": {
            "token": token,
            "name": "js",
        },
        "method": 0,
        "id": 1,
    }
    subscribe_message = {
        "params": {
            "channel": channel,
        },
        "method": 1,
        "id": 2,
    }

    messages: list[dict[str, Any]] = []
    raw_frames: list[str] = []
    connected = False
    subscribed = False

    async with websockets.connect(
        WS_URL,
        origin=WEB_BASE,
        additional_headers={
            "User-Agent": DEFAULT_UA,
        },
        ssl=make_ssl_context(verify_tls),
    ) as websocket:
        await websocket.send(json.dumps(connect_message) + "\n")

        while len(messages) < count:
            frame = await asyncio.wait_for(websocket.recv(), timeout=timeout)
            raw_frames.append(str(frame))

            for line in str(frame).split("\n"):
                line = line.strip()
                if not line:
                    continue
                obj = json.loads(line)

                if obj.get("id") == 1 and "result" in obj and not connected:
                    connected = True
                    await websocket.send(json.dumps(subscribe_message) + "\n")
                    continue

                if obj.get("id") == 2 and "result" in obj and not subscribed:
                    subscribed = True
                    continue

                result = obj.get("result") or {}
                data = result.get("data") or {}
                inner = data.get("data") or {}
                if inner.get("type") != "chatter":
                    continue
                message = str(inner.get("message") or "").strip()
                if not message:
                    continue
                messages.append(
                    {
                        "nickname": inner.get("nk") or inner.get("id") or "",
                        "message": message,
                        "created_at": inner.get("created_at"),
                        "offset": data.get("offset"),
                    }
                )
                if len(messages) >= count:
                    break

    return {
        "roomId": room_id,
        "channel": channel,
        "chatServerToken": payload["chatServerToken"],
        "count": len(messages),
        "messages": messages,
        "connected": connected,
        "subscribed": subscribed,
        "rawFrameCount": len(raw_frames),
    }


def main() -> int:
    args = parse_args()
    try:
        result = asyncio.run(
            collect_messages(
                room_id=args.room_id,
                count=max(1, args.count),
                timeout=max(1.0, args.timeout),
                verify_tls=args.verify_tls,
            )
        )
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(exc.stderr or str(exc))
        return 1
    except Exception as exc:
        sys.stderr.write(f"{type(exc).__name__}: {exc}\n")
        return 1

    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
