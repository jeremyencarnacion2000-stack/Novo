"""Loopback-only OpenJarvis inference for Novo's authorized project snapshots."""

import hmac
import json
import logging
import os
import re
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path


UPSTREAM = "484de900c7238442d4e049e185de6af679519192"
MAX_REQUEST = 32_768


def load_upstream():
    root = Path(os.environ["NOVO_OPENJARVIS_CHECKOUT"]).resolve(strict=True)
    commit = subprocess.check_output(
        ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
    ).strip()
    dirty = subprocess.check_output(
        ["git", "-C", str(root), "status", "--porcelain", "--untracked-files=all", "--", "src"],
        text=True,
    )
    if commit != UPSTREAM or dirty:
        raise SystemExit("OpenJarvis source must match the clean pinned checkout")
    sys.path.insert(0, str(root / "src"))


def read_project_snapshot(snapshot):
    from openjarvis.core.types import ToolResult
    from openjarvis.mcp.client import MCPClient
    from openjarvis.mcp.server import MCPServer
    from openjarvis.mcp.transport import InProcessTransport
    from openjarvis.tools._stubs import BaseTool, ToolSpec

    class ProjectSnapshot(BaseTool):
        tool_id = "novo_project_snapshot"
        spec = ToolSpec(
            name=tool_id,
            description="Read the project snapshot authorized by Novo for this turn.",
            parameters={"type": "object", "properties": {}, "additionalProperties": False},
        )

        def execute(self, **params):
            return ToolResult(
                tool_name=self.tool_id,
                content=snapshot if not params else "This tool accepts no arguments.",
                success=not params,
            )

    with MCPClient(InProcessTransport(MCPServer(tools=[ProjectSnapshot()]))) as client:
        result = client.call_tool("novo_project_snapshot", {})
    if result.get("isError"):
        raise RuntimeError("project snapshot unavailable")
    return result["content"][0]["text"]


def answer(payload, model, engine_name, api_key):
    from openjarvis.agents._stubs import AgentContext
    from openjarvis.agents.simple import SimpleAgent
    from openjarvis.core.types import Conversation, Message, Role
    from openjarvis.engine.openai_compat_engines import OpenAICompatEngine
    from psutil import Process

    wall, cpu = time.perf_counter(), time.process_time()
    evidence = read_project_snapshot(payload["evidence"])
    if engine_name == "groq":
        host, key = "https://api.groq.com/openai", api_key
    else:
        host, key = "http://127.0.0.1:11434", "local-no-credential"
    engine = OpenAICompatEngine(host=host, api_key=key, timeout=10)
    usage = {}

    # The pinned engine estimates prompt tokens if the provider omits usage.
    # Record only provider-reported counts for the comparison.
    def reported_usage(response):
        if response.is_success:
            values = response.read()
            usage.update(json.loads(values).get("usage") or {})

    engine._client.event_hooks["response"].append(reported_usage)
    try:
        context = AgentContext(conversation=Conversation(messages=[
            Message(role=Role.SYSTEM, content=f"{payload['system']}\n{evidence}"),
        ]))
        response = SimpleAgent(engine, model, temperature=0.2, max_tokens=1024).run(
            payload["message"], context=context
        )
    finally:
        engine.close()
    content = re.sub(r"<think>.*?</think>", "", response.content, flags=re.S).strip()
    if not content or "<think>" in content or len(content) > 12_000:
        raise ValueError("invalid inference result")
    return {
        "content": content,
        "inputTokens": usage.get("prompt_tokens"),
        "outputTokens": usage.get("completion_tokens"),
        "elapsedMs": round((time.perf_counter() - wall) * 1_000, 2),
        "cpuMs": round((time.process_time() - cpu) * 1_000, 2),
        "rssBytes": Process().memory_info().rss,
    }


class InferenceHandler(BaseHTTPRequestHandler):
    timeout = 15

    def log_message(self, format, *args):
        pass

    def send_json(self, status, value):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        if self.path != "/v1/novo/answer":
            return self.send_json(404, {"error": "not_found"})
        authorization = self.headers.get("Authorization", "").encode("utf-8")
        if not hmac.compare_digest(authorization, self.server.authorization):
            return self.send_json(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if self.headers.get("Transfer-Encoding") or not 0 < length <= MAX_REQUEST:
                raise ValueError("invalid length")
            payload = json.loads(self.rfile.read(length))
            if (
                not isinstance(payload, dict)
                or set(payload) != {"system", "message", "model", "evidence"}
                or payload["model"] != self.server.model
                or not all(isinstance(payload[key], str) and payload[key].strip()
                           for key in ("system", "message", "evidence"))
                or not len(payload["message"]) <= 1_024
            ):
                raise ValueError("invalid request")
        except (ValueError, OSError, RecursionError):
            return self.send_json(400, {"error": "invalid_request"})
        try:
            result = answer(payload, self.server.model, self.server.engine, self.server.api_key)
        except Exception:
            return self.send_json(503, {"error": "inference_unavailable"})
        self.send_json(200, result)


def main():
    token = os.environ["NOVO_OPENJARVIS_TOKEN"]
    model = os.environ["NOVO_OPENJARVIS_MODEL"]
    engine = os.environ["NOVO_OPENJARVIS_ENGINE"]
    api_key = os.environ.get("GROQ_API_KEY")
    if (not re.fullmatch(r"[!-~]{32,256}", token)
            or not re.fullmatch(r"[\w./:-]{1,120}", model)
            or engine not in {"groq", "ollama"}
            or (engine == "groq" and not api_key)):
        raise SystemExit("Invalid Novo inference configuration")
    load_upstream()
    # Do not log provider errors, prompts or tool results via upstream loggers.
    logging.disable(logging.CRITICAL)
    with HTTPServer(("127.0.0.1", int(os.environ.get("NOVO_OPENJARVIS_PORT", "8764"))), InferenceHandler) as server:
        server.authorization = f"Bearer {token}".encode()
        server.model, server.engine, server.api_key = model, engine, api_key
        server.serve_forever()


if __name__ == "__main__":
    main()
