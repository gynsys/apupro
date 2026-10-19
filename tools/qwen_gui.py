"""Servidor web y GUI local para interactuar con Qwen 2.5 en GPU mediante Ollama.

Proporciona una interfaz web moderna, oscura y ultra ligera (estilo ChatGPT)
con soporte nativo para streaming en tiempo real, selección de memoria de contexto
(8,192 tokens por defecto), renderizado de Markdown y resaltado de sintaxis de código.
"""

import asyncio
import json
import logging
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger: logging.Logger = logging.getLogger("qwen_gui")

OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
DEFAULT_MODEL: str = "qwen2.5:7b"
DEFAULT_CTX: int = 8192
PORT: int = 7860

app = FastAPI(title="Qwen Local Chat GUI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = Field(..., description="Rol del emisor: system, user o assistant")
    content: str = Field(..., description="Contenido textual del mensaje")


class ChatRequest(BaseModel):
    model: str = Field(default=DEFAULT_MODEL, description="Nombre del modelo en Ollama")
    messages: List[ChatMessage] = Field(..., description="Historial de mensajes")
    num_ctx: int = Field(default=DEFAULT_CTX, description="Tamaño de ventana de contexto en tokens")
    temperature: float = Field(default=0.7, description="Temperatura de generación")


_OLLAMA_STARTED_ONCE: bool = False


def is_ollama_online(timeout: float = 4.0) -> bool:
    """Verifica si el servicio de Ollama está respondiendo en el puerto local."""
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags", headers={"User-Agent": "QwenGUI"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def get_ollama_executable() -> Optional[str]:
    """Busca la ruta del ejecutable de Ollama en el sistema o en LocalAppData."""
    cmd = shutil.which("ollama")
    if cmd and os.path.isfile(cmd):
        return cmd
    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        candidate = os.path.join(local_app_data, "Programs", "Ollama", "ollama.exe")
        if os.path.isfile(candidate):
            return candidate
    return None


def ensure_ollama_running() -> None:
    """Inicia el servidor de Ollama en segundo plano sin mostrar ninguna ventana de consola."""
    global _OLLAMA_STARTED_ONCE
    if is_ollama_online(timeout=2.0):
        _OLLAMA_STARTED_ONCE = True
        logger.info("Ollama ya se encuentra activo en %s", OLLAMA_BASE_URL)
        return

    exe = get_ollama_executable()
    if not exe:
        logger.error("No se encontró el ejecutable de Ollama en el sistema ni en LocalAppData.")
        return

    logger.info("Iniciando Ollama en segundo plano desde: %s", exe)
    try:
        if sys.platform == "win32":
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0  # SW_HIDE
            subprocess.Popen(
                [exe, "serve"],
                creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS,
                startupinfo=si,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            subprocess.Popen(
                [exe, "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
    except Exception as exc:
        logger.error("No se pudo iniciar automáticamente 'ollama serve': %s", exc, exc_info=True)
        return

    # Esperar hasta 6 segundos para que el servidor responda
    for _ in range(12):
        time.sleep(0.5)
        if is_ollama_online():
            logger.info("Ollama inició exitosamente y está listo.")
            return

    logger.warning("Ollama se ejecutó pero aún no responde en %s. Continuando...", OLLAMA_BASE_URL)


@app.get("/api/status")
async def get_status() -> Dict[str, Any]:
    """Retorna el estado de conexión con Ollama y la lista de modelos disponibles."""
    online = is_ollama_online()
    models: List[str] = []
    if online:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", []) if m.get("name")]
        except Exception as exc:
            logger.error("Error al consultar modelos en Ollama: %s", exc, exc_info=True)

    if not models and online:
        models = [DEFAULT_MODEL]

    return {
        "status": "online" if online else "offline",
        "models": models,
        "default_model": DEFAULT_MODEL,
        "default_ctx": DEFAULT_CTX,
    }


async def stream_ollama(payload: ChatRequest) -> AsyncGenerator[str, None]:
    """Generador asíncrono que retransmite el stream de Ollama hacia el navegador cliente."""
    ollama_payload = {
        "model": payload.model,
        "messages": [{"role": m.role, "content": m.content} for m in payload.messages],
        "options": {
            "num_ctx": payload.num_ctx,
            "temperature": payload.temperature,
        },
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OLLAMA_BASE_URL}/api/chat",
                json=ollama_payload,
            ) as response:
                if response.status_code != 200:
                    err_msg = f"Error de Ollama ({response.status_code})"
                    logger.error("Fallo al conectar con Ollama: %s", response.status_code)
                    yield f"data: {json.dumps({'error': err_msg})}\n\n"
                    return

                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        content = chunk.get("message", {}).get("content", "")
                        done = chunk.get("done", False)

                        out_data = {
                            "token": content,
                            "done": done,
                        }
                        if done:
                            eval_count = chunk.get("eval_count", 0)
                            eval_duration = chunk.get("eval_duration", 1)
                            # tokens por segundo
                            speed = (eval_count / (eval_duration / 1e9)) if eval_duration else 0.0
                            out_data["speed"] = round(speed, 1)
                            out_data["eval_count"] = eval_count

                        yield f"data: {json.dumps(out_data)}\n\n"
                    except json.JSONDecodeError:
                        continue

    except Exception as exc:
        logger.error("Excepción durante el streaming de Ollama: %s", exc, exc_info=True)
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest) -> StreamingResponse:
    """Endpoint de streaming en tiempo real usando Server-Sent Events (SSE)."""
    global _OLLAMA_STARTED_ONCE
    if not is_ollama_online(timeout=2.0) and not _OLLAMA_STARTED_ONCE:
        ensure_ollama_running()
        if not is_ollama_online(timeout=3.0):
            raise HTTPException(
                status_code=503,
                detail="El servicio local de Ollama no está disponible. Verifica que esté instalado.",
            )
    _OLLAMA_STARTED_ONCE = True

    return StreamingResponse(
        stream_ollama(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


HTML_CONTENT = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qwen 2.5 — Local GPU Chat</title>
    <!-- Fuentes y librerías modernas -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        :root {
            --bg-main: #0f1117;
            --bg-sidebar: #161922;
            --bg-card: #1c202c;
            --bg-user-msg: #282f42;
            --bg-bot-msg: #181c26;
            --text-main: #f1f5f9;
            --text-muted: #94a3b8;
            --accent: #6366f1;
            --accent-hover: #4f46e5;
            --accent-glow: rgba(99, 102, 241, 0.25);
            --border-color: #2a3143;
            --code-bg: #12151e;
            --success: #10b981;
            --danger: #ef4444;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg-main);
            color: var(--text-main);
            height: 100vh;
            display: flex;
            overflow: hidden;
        }

        /* SIDEBAR */
        #sidebar {
            width: 290px;
            background-color: var(--bg-sidebar);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            padding: 20px 16px;
            gap: 20px;
            flex-shrink: 0;
            z-index: 10;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1.15rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #fff;
        }

        .brand-badge {
            background: linear-gradient(135deg, #6366f1, #a855f7);
            color: white;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            box-shadow: 0 2px 8px var(--accent-glow);
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 0.8rem;
            padding: 6px 12px;
            border-radius: 20px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            width: fit-content;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: var(--danger);
        }

        .status-dot.online {
            background-color: var(--success);
            box-shadow: 0 0 8px var(--success);
        }

        .section-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            font-weight: 600;
            margin-bottom: 6px;
        }

        .control-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        select, input {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 9px 12px;
            border-radius: 8px;
            font-size: 0.88rem;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
        }

        select:focus, input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .btn {
            background-color: var(--accent);
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn:hover {
            background-color: var(--accent-hover);
        }

        .btn:active {
            transform: scale(0.98);
        }

        .btn-outline {
            background-color: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
        }

        .btn-outline:hover {
            background-color: var(--bg-card);
            color: var(--text-main);
            border-color: #3f475d;
        }

        .sidebar-footer {
            margin-top: auto;
            font-size: 0.76rem;
            color: var(--text-muted);
            text-align: center;
            line-height: 1.4;
            border-top: 1px solid var(--border-color);
            padding-top: 14px;
        }

        /* MAIN CHAT AREA */
        #chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: 100vh;
            position: relative;
            background-color: var(--bg-main);
        }

        #messages-list {
            flex: 1;
            overflow-y: auto;
            padding: 24px 20px 140px 20px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            scroll-behavior: smooth;
        }

        .message-row {
            display: flex;
            max-width: 900px;
            width: 100%;
            margin: 0 auto;
            gap: 16px;
        }

        .message-row.user {
            justify-content: flex-end;
        }

        .avatar {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.85rem;
            flex-shrink: 0;
        }

        .avatar.assistant {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            box-shadow: 0 2px 10px var(--accent-glow);
        }

        .avatar.user {
            background-color: #3b82f6;
            color: white;
            order: 2;
        }

        .bubble {
            background-color: var(--bg-bot-msg);
            border: 1px solid var(--border-color);
            padding: 14px 18px;
            border-radius: 12px;
            color: var(--text-main);
            font-size: 0.95rem;
            line-height: 1.6;
            max-width: calc(100% - 60px);
            word-break: break-word;
            position: relative;
        }

        .message-row.user .bubble {
            background-color: var(--bg-user-msg);
            border-color: #3d4660;
            order: 1;
        }

        .bubble p {
            margin-bottom: 10px;
        }
        .bubble p:last-child {
            margin-bottom: 0;
        }

        .bubble ul, .bubble ol {
            margin: 10px 0 10px 24px;
        }

        .bubble table {
            border-collapse: collapse;
            margin: 12px 0;
            width: 100%;
            font-size: 0.9rem;
        }

        .bubble th, .bubble td {
            border: 1px solid var(--border-color);
            padding: 8px 12px;
            text-align: left;
        }

        .bubble th {
            background-color: var(--bg-card);
        }

        .bubble pre {
            background-color: var(--code-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            margin: 12px 0;
            position: relative;
            overflow: hidden;
        }

        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.04);
            border-bottom: 1px solid var(--border-color);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .copy-btn {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.72rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .copy-btn:hover {
            color: #fff;
            background: var(--bg-card);
        }

        .bubble code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.88rem;
        }

        .bubble pre code {
            display: block;
            padding: 14px;
            overflow-x: auto;
        }

        .bubble :not(pre) > code {
            background-color: rgba(255, 255, 255, 0.08);
            padding: 2px 6px;
            border-radius: 4px;
            color: #38bdf8;
        }

        .meta-info {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* INPUT BAR */
        #input-box {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(180deg, rgba(15, 17, 23, 0) 0%, rgba(15, 17, 23, 0.95) 30%, #0f1117 100%);
            padding: 20px;
            display: flex;
            justify-content: center;
        }

        .input-wrapper {
            max-width: 900px;
            width: 100%;
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
            transition: border-color 0.2s;
        }

        .input-wrapper:focus-within {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow), 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        textarea {
            background: transparent;
            border: none;
            color: var(--text-main);
            font-family: inherit;
            font-size: 0.96rem;
            resize: none;
            outline: none;
            min-height: 44px;
            max-height: 200px;
            line-height: 1.5;
        }

        .input-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .input-hints {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .send-btn {
            background-color: var(--accent);
            color: white;
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .send-btn:hover {
            background-color: var(--accent-hover);
        }

        .send-btn:disabled {
            background-color: #374151;
            cursor: not-allowed;
            opacity: 0.6;
        }

        /* ADJUNTOS Y DRAG & DROP */
        .attachments-tray {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--border-color);
            max-height: 160px;
            overflow-y: auto;
        }

        .tray-summary-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.78rem;
            color: var(--text-muted);
            width: 100%;
            gap: 10px;
        }

        .token-gauge {
            font-size: 0.74rem;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .token-gauge.ok {
            background: rgba(16, 185, 129, 0.15);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.35);
        }

        .token-gauge.warn {
            background: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.35);
        }

        .token-gauge.danger {
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.45);
        }

        .chips-container {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            max-height: 100px;
            overflow-y: auto;
            padding-top: 4px;
        }

        .attach-chip {
            background: #23293a;
            border: 1px solid #3b445c;
            color: var(--text-main);
            font-size: 0.76rem;
            padding: 3px 8px;
            border-radius: 6px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            max-width: 260px;
        }

        .attach-chip span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .attach-chip button {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-weight: bold;
            font-size: 0.85rem;
            padding: 0 2px;
        }

        .attach-chip button:hover {
            color: var(--danger);
        }

        .action-icon-btn {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            padding: 6px 10px;
            border-radius: 8px;
            font-size: 0.8rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }

        .action-icon-btn:hover {
            color: var(--text-main);
            background: var(--bg-card);
            border-color: #4a5568;
        }

        #drop-overlay {
            position: absolute;
            inset: 0;
            background: rgba(15, 17, 23, 0.90);
            backdrop-filter: blur(4px);
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            border: 3px dashed var(--accent);
            z-index: 100;
            pointer-events: none;
        }

        #drop-overlay.active {
            display: flex;
        }

        .drop-icon {
            font-size: 3.5rem;
            animation: bounce 1s infinite alternate;
        }

        @keyframes bounce {
            from { transform: translateY(0); }
            to { transform: translateY(-10px); }
        }

        /* EMPTY STATE */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: auto;
            text-align: center;
            gap: 16px;
            max-width: 600px;
        }

        .empty-icon {
            font-size: 2.8rem;
            background: linear-gradient(135deg, #6366f1, #a855f7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .quick-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            margin-top: 10px;
        }

        .chip {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            padding: 8px 14px;
            border-radius: 20px;
            font-size: 0.85rem;
            color: var(--text-muted);
            cursor: pointer;
            transition: all 0.2s;
        }

        .chip:hover {
            border-color: var(--accent);
            color: var(--text-main);
            background: #252b3b;
        }

        /* SCROLLBAR */
        ::-webkit-scrollbar {
            width: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #2a3143;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #3f475d;
        }
    </style>
</head>
<body>

    <!-- BARRA LATERAL -->
    <div id="sidebar">
        <div class="brand">
            <span>⚡ Qwen Local</span>
            <span class="brand-badge">GPU 1080</span>
        </div>

        <div class="status-pill" id="status-container">
            <span class="status-dot" id="status-dot"></span>
            <span id="status-text">Conectando...</span>
        </div>

        <div class="control-group">
            <span class="section-label">Modelo Local</span>
            <select id="model-select">
                <option value="qwen2.5:7b">qwen2.5:7b (Cargando...)</option>
            </select>
        </div>

        <div class="control-group">
            <span class="section-label">Memoria de Contexto</span>
            <select id="context-select">
                <option value="8192" selected>8,192 tokens (Recomendado)</option>
                <option value="4096">4,096 tokens (Rápido)</option>
                <option value="16384">16,384 tokens (Memoria Extrema)</option>
                <option value="2048">2,048 tokens (Básico)</option>
            </select>
        </div>

        <div class="control-group">
            <span class="section-label">Rol del Asistente</span>
            <select id="preset-select">
                <option value="general">Asistente General</option>
                <option value="apu_expert">Experto APU / Costos de Obra</option>
                <option value="fullstack_dev">Senior Python & React Dev</option>
                <option value="security_auditor">Auditor de Seguridad y Código</option>
            </select>
        </div>

        <button class="btn btn-outline" id="clear-btn">
            🧹 Limpiar Conversación
        </button>

        <div class="sidebar-footer">
            <strong>Costo: $0.00</strong><br>
            100% Privado & Offline<br>
            Ollama en GPU NVIDIA
        </div>
    </div>

    <!-- AREA DE CHAT -->
    <div id="chat-container">
        <!-- DROP OVERLAY -->
        <div id="drop-overlay">
            <div class="drop-icon">📂</div>
            <h2>Suelta tus archivos o carpetas aquí</h2>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Qwen leerá su contenido para responder a tu consulta</p>
        </div>

        <div id="messages-list">
            <div class="empty-state" id="empty-state">
                <div class="empty-icon">🤖</div>
                <h2>¿En qué te puedo ayudar hoy?</h2>
                <p style="color: var(--text-muted); font-size: 0.92rem;">
                    Qwen 2.5 7B corriendo a máxima velocidad en tu GPU local con memoria de contexto de 8K tokens.
                </p>
                <div class="quick-chips">
                    <div class="chip" onclick="quickPrompt('Explícame cómo funciona el cálculo de APU en ingeniería de costos.')">
                        📐 Cálculo de APU
                    </div>
                    <div class="chip" onclick="quickPrompt('¿Cómo optimizar una consulta en PostgreSQL para millones de registros?')">
                        ⚡ Optimizar SQL
                    </div>
                    <div class="chip" onclick="quickPrompt('Escribe un script en Python para procesar archivos concurrentemente.')">
                        🐍 Script Python Concurrente
                    </div>
                </div>
            </div>
        </div>

        <div id="input-box">
            <div class="input-wrapper">
                <!-- BANDEJA DE ADJUNTOS -->
                <div id="attachments-tray" class="attachments-tray" style="display: none;"></div>

                <textarea id="user-input" placeholder="Escribe un mensaje a Qwen... (o arrastra archivos y carpetas aquí)" rows="1"></textarea>
                
                <div class="input-actions">
                    <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                        <input type="file" id="file-input" multiple style="display: none;">
                        <input type="file" id="folder-input" webkitdirectory directory multiple style="display: none;">

                        <button type="button" class="action-icon-btn" id="attach-file-btn" title="Adjuntar archivos de código o texto">
                            📎 <span>Archivos</span>
                        </button>
                        <button type="button" class="action-icon-btn" id="attach-folder-btn" title="Adjuntar una carpeta completa">
                            📁 <span>Carpeta</span>
                        </button>
                        <span class="input-hints">Arrastra archivos aquí • Shift+Enter = Salto</span>
                    </div>

                    <button class="send-btn" id="send-btn" title="Enviar mensaje">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        // CONFIGURACION Y ESTADO
        const PRESETS = {
            general: "Eres Qwen, un modelo de inteligencia artificial de alto rendimiento. Respondes de forma clara, directa, precisa y en español.",
            apu_expert: "Eres un Ingeniero Civil Senior especialista en Análisis de Precios Unitarios (APU), presupuestos de obra, rendimientos de mano de obra y normativas de construcción. Respondes con criterio técnico y estructurado.",
            fullstack_dev: "Eres un Ingeniero de Software Fullstack Senior experto en Python (FastAPI, SQLAlchemy, Celery) y React (Tailwind, TypeScript). Escribes código limpio, robusto, tipado y sin código incompleto.",
            security_auditor: "Eres un Auditor de Seguridad Informática experto en OWASP, prevención de inyecciones SQL/NoSQL, autenticación JWT segura y hardening de arquitecturas de software."
        };

        let conversationHistory = [];
        let isGenerating = false;
        let abortController = null;
        let attachedFiles = [];

        // ELEMENTOS DOM
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const modelSelect = document.getElementById('model-select');
        const contextSelect = document.getElementById('context-select');
        const presetSelect = document.getElementById('preset-select');
        const messagesList = document.getElementById('messages-list');
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        const clearBtn = document.getElementById('clear-btn');
        const emptyState = document.getElementById('empty-state');
        const attachmentsTray = document.getElementById('attachments-tray');
        const fileInput = document.getElementById('file-input');
        const folderInput = document.getElementById('folder-input');
        const attachFileBtn = document.getElementById('attach-file-btn');
        const attachFolderBtn = document.getElementById('attach-folder-btn');
        const dropOverlay = document.getElementById('drop-overlay');

        // GESTIÓN DE ADJUNTOS
        attachFileBtn.addEventListener('click', () => fileInput.click());

        attachFolderBtn.addEventListener('click', async () => {
            // Usar la API moderna showDirectoryPicker para evitar el alert "¿Cargar X archivos?" de Chrome
            if (window.showDirectoryPicker) {
                try {
                    const dirHandle = await window.showDirectoryPicker({ id: 'qwen_folder_picker', mode: 'read' });
                    const resultFiles = [];
                    await scanDirectoryHandle(dirHandle, dirHandle.name, resultFiles);
                    if (resultFiles.length > 0) {
                        await handleSelectedFiles(resultFiles);
                    }
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.warn("showDirectoryPicker falló, usando input tradicional:", err);
                        folderInput.click();
                    }
                }
            } else {
                folderInput.click();
            }
        });

        const IGNORED_DIRS = [
            '__pycache__', 'node_modules', '.git', '.vscode', '.idea', 'venv', 
            'dist', 'build', '.next', 'scratch', '.gemini', 'uploads', '.qwen_backups',
            '.pytest_cache', 'env', 'coverage', '.system_generated'
        ];

        const IGNORED_EXTS = [
            '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.exe', '.dll', 
            '.zip', '.tar', '.gz', '.mp4', '.mp3', '.pyc', '.bin', '.wasm', 
            '.woff', '.woff2', '.ttf', '.sql', '.dump', '.db', '.sqlite', '.bak'
        ];

        async function scanDirectoryHandle(handle, currentPath, resultFiles) {
            for await (const entry of handle.values()) {
                const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                if (entry.kind === 'file') {
                    try {
                        const file = await entry.getFile();
                        file.fullPath = entryPath;
                        resultFiles.push(file);
                    } catch (e) {
                        console.error("Error obteniendo archivo:", entry.name, e);
                    }
                } else if (entry.kind === 'directory') {
                    if (!IGNORED_DIRS.includes(entry.name.toLowerCase())) {
                        await scanDirectoryHandle(entry, entryPath, resultFiles);
                    }
                }
            }
        }

        fileInput.addEventListener('change', function() {
            handleSelectedFiles(this.files);
            this.value = '';
        });

        folderInput.addEventListener('change', function() {
            handleSelectedFiles(this.files);
            this.value = '';
        });

        // DRAG & DROP
        let dragCounter = 0;
        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            dropOverlay.classList.add('active');
        });

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dropOverlay.classList.remove('active');
                dragCounter = 0;
            }
        });

        window.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        window.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragCounter = 0;
            dropOverlay.classList.remove('active');
            if (e.dataTransfer) {
                const files = await scanFilesFromDataTransfer(e.dataTransfer);
                if (files && files.length > 0) {
                    await handleSelectedFiles(files);
                }
            }
        });

        async function scanFilesFromDataTransfer(dataTransfer) {
            const resultFiles = [];
            if (dataTransfer.items && dataTransfer.items.length > 0) {
                const entries = [];
                for (let i = 0; i < dataTransfer.items.length; i++) {
                    const item = dataTransfer.items[i];
                    if (item.webkitGetAsEntry) {
                        const entry = item.webkitGetAsEntry();
                        if (entry) entries.push(entry);
                    }
                }
                if (entries.length > 0) {
                    for (const entry of entries) {
                        await scanEntry(entry, '', resultFiles);
                    }
                    return resultFiles;
                }
            }
            if (dataTransfer.files) {
                return Array.from(dataTransfer.files);
            }
            return resultFiles;
        }

        async function scanEntry(entry, currentPath, resultFiles) {
            if (entry.isFile) {
                try {
                    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
                    file.fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                    resultFiles.push(file);
                } catch (e) {
                    console.error("Error obteniendo archivo de entry:", e);
                }
            } else if (entry.isDirectory) {
                if (IGNORED_DIRS.includes(entry.name.toLowerCase())) {
                    return;
                }

                const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
                const dirReader = entry.createReader();

                const readBatch = () => new Promise((resolve, reject) => dirReader.readEntries(resolve, reject));
                let entries = await readBatch();
                while (entries.length > 0) {
                    for (const subEntry of entries) {
                        await scanEntry(subEntry, dirPath, resultFiles);
                    }
                    entries = await readBatch();
                }
            }
        }

        function formatBytes(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1048576).toFixed(1) + ' MB';
        }

        async function handleSelectedFiles(fileList) {
            for (const file of fileList) {
                const lowerName = file.name.toLowerCase();
                if (IGNORED_EXTS.some(ext => lowerName.endsWith(ext))) {
                    continue;
                }
                if (file.name.startsWith('.') && file.name !== '.env') {
                    continue;
                }
                if (file.size > 2 * 1024 * 1024) {
                    continue;
                }

                try {
                    const text = await readFileAsText(file);
                    const relPath = file.fullPath || file.webkitRelativePath || file.name;
                    if (!attachedFiles.some(f => f.path === relPath)) {
                        attachedFiles.push({
                            name: file.name,
                            path: relPath,
                            content: text,
                            size: file.size
                        });
                    }
                } catch (err) {
                    console.error("Error leyendo archivo:", file.name, err);
                }
            }
            renderAttachments();
        }

        function readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error);
                reader.readAsText(file);
            });
        }

        let isDetailsOpen = false;

        function renderAttachments() {
            if (attachedFiles.length === 0) {
                attachmentsTray.style.display = 'none';
                attachmentsTray.innerHTML = '';
                return;
            }

            attachmentsTray.style.display = 'flex';
            attachmentsTray.innerHTML = '';

            const totalSize = attachedFiles.reduce((acc, f) => acc + f.size, 0);
            const totalChars = attachedFiles.reduce((acc, f) => acc + (f.content ? f.content.length : 0), 0);
            const estTokens = Math.round(totalChars / 3.6);
            const maxCtx = parseInt(contextSelect.value, 10) || 8192;

            // Semáforo de tokens
            let gaugeClass = 'ok';
            let gaugeText = `~${estTokens.toLocaleString()} tokens (Óptimo)`;
            let warningHtml = '';

            if (estTokens > maxCtx) {
                gaugeClass = 'danger';
                gaugeText = `⚠️ ~${estTokens.toLocaleString()} / ${maxCtx.toLocaleString()} tokens (Excede límite)`;
                warningHtml = `
                    <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; font-size: 0.76rem; padding: 6px 10px; border-radius: 6px;">
                        ⚠️ <strong>Atención:</strong> Has cargado más de ${maxCtx.toLocaleString()} tokens. Para que Qwen no se desborde, te recomendamos subir a 16K tokens en la barra lateral o cargar solo la subcarpeta específica que deseas analizar.
                    </div>
                `;
            } else if (estTokens > maxCtx * 0.75) {
                gaugeClass = 'warn';
                gaugeText = `~${estTokens.toLocaleString()} / ${maxCtx.toLocaleString()} tokens (Cerca del límite)`;
            }

            // Barra resumen
            const summaryBar = document.createElement('div');
            summaryBar.className = 'tray-summary-bar';
            summaryBar.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span>📁 <strong>${attachedFiles.length} archivos</strong> (${formatBytes(totalSize)})</span>
                    <span class="token-gauge ${gaugeClass}">${gaugeText}</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button type="button" class="action-icon-btn" style="padding: 2px 8px; font-size: 0.74rem;" onclick="toggleDetails()">
                        ${isDetailsOpen ? '▲ Ocultar lista' : '▼ Ver archivos (' + attachedFiles.length + ')'}
                    </button>
                    <button type="button" style="background:transparent; border:none; color:#f87171; cursor:pointer; font-size:0.75rem; text-decoration: underline;" onclick="clearAllAttachments()">Limpiar todos</button>
                </div>
            `;
            attachmentsTray.appendChild(summaryBar);

            if (warningHtml) {
                const warnContainer = document.createElement('div');
                warnContainer.innerHTML = warningHtml;
                attachmentsTray.appendChild(warnContainer);
            }

            // Lista detallada de chips (solo visible si está desplegada o si son pocos archivos <= 4)
            if (isDetailsOpen || attachedFiles.length <= 4) {
                const chipsContainer = document.createElement('div');
                chipsContainer.className = 'chips-container';
                attachedFiles.forEach((file, idx) => {
                    const chip = document.createElement('div');
                    chip.className = 'attach-chip';
                    chip.innerHTML = `
                        <span title="${file.path}">📄 ${file.path} (${formatBytes(file.size)})</span>
                        <button type="button" onclick="removeAttachment(${idx})">✕</button>
                    `;
                    chipsContainer.appendChild(chip);
                });
                attachmentsTray.appendChild(chipsContainer);
            }
        }

        window.toggleDetails = function() {
            isDetailsOpen = !isDetailsOpen;
            renderAttachments();
        };

        window.removeAttachment = function(idx) {
            attachedFiles.splice(idx, 1);
            renderAttachments();
        };

        window.clearAllAttachments = function() {
            attachedFiles = [];
            isDetailsOpen = false;
            renderAttachments();
        };

        contextSelect.addEventListener('change', renderAttachments);

        // Configurar marked para resaltado
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                highlight: function(code, lang) {
                    if (lang && hljs.getLanguage(lang)) {
                        return hljs.highlight(code, { language: lang }).value;
                    }
                    return hljs.highlightAuto(code).value;
                },
                breaks: true
            });
        }

        // AUTO-RESIZE TEXTAREA
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });

        // DETECTAR ENTER / SHIFT+ENTER
        userInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);
        clearBtn.addEventListener('click', clearChat);

        function quickPrompt(text) {
            userInput.value = text;
            userInput.focus();
            sendMessage();
        }

        // CONSULTAR ESTADO DE OLLAMA
        async function checkStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                if (data.status === 'online') {
                    statusDot.classList.add('online');
                    statusText.textContent = 'GPU Conectada';
                    
                    // Llenar modelos
                    modelSelect.innerHTML = '';
                    data.models.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.textContent = m;
                        if (m.includes('qwen2.5:7b') || m.includes('qwen')) {
                            opt.selected = true;
                        }
                        modelSelect.appendChild(opt);
                    });
                } else {
                    statusDot.classList.remove('online');
                    statusText.textContent = 'Ollama Offline';
                }
            } catch (err) {
                statusDot.classList.remove('online');
                statusText.textContent = 'Error Servidor';
            }
        }

        function clearChat() {
            conversationHistory = [];
            messagesList.innerHTML = '';
            messagesList.appendChild(emptyState);
            emptyState.style.display = 'flex';
        }

        function renderMarkdown(raw) {
            if (typeof marked !== 'undefined') {
                return marked.parse(raw);
            }
            return raw.replace(/\\n/g, '<br>');
        }

        // ENVIAR MENSAJE
        async function sendMessage() {
            const rawUserText = userInput.value.trim();
            if ((!rawUserText && attachedFiles.length === 0) || isGenerating) return;

            // Ocultar empty state
            emptyState.style.display = 'none';

            // Copia instantánea de archivos adjuntos para visualización y payload
            const filesSnapshot = [...attachedFiles];
            let promptPayload = '';

            if (filesSnapshot.length > 0) {
                promptPayload += '=== ARCHIVOS PROPORCIONADOS POR EL USUARIO PARA ANÁLISIS ===\\n\\n';
                for (const f of filesSnapshot) {
                    promptPayload += `--- INICIO ARCHIVO: ${f.path || f.name} (${formatBytes(f.size)}) ---\\n`;
                    promptPayload += '```\\n' + f.content + '\\n```\\n';
                    promptPayload += `--- FIN ARCHIVO: ${f.path || f.name} ---\\n\\n`;
                }
                promptPayload += '=== FIN DE ARCHIVOS ===\\n\\n';
            }

            promptPayload += (rawUserText || "Por favor analiza los archivos adjuntos.");

            // Mostrar mensaje del usuario en la interfaz
            appendUserMessage(rawUserText, filesSnapshot);
            conversationHistory.push({ role: 'user', content: promptPayload });

            // Limpiar entrada y adjuntos
            attachedFiles = [];
            renderAttachments();
            userInput.value = '';
            userInput.style.height = 'auto';
            isGenerating = true;
            sendBtn.disabled = true;

            // Crear fila del asistente
            const botRow = createMessageElement('assistant');
            const botBubble = botRow.querySelector('.bubble');
            const metaInfo = botRow.querySelector('.meta-info');
            messagesList.appendChild(botRow);
            messagesList.scrollTop = messagesList.scrollHeight;

            let fullResponse = '';
            const startTime = performance.now();

            // Preparar mensajes con system prompt
            const systemPrompt = PRESETS[presetSelect.value] || PRESETS.general;
            const payloadMessages = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory
            ];

            const reqPayload = {
                model: modelSelect.value,
                messages: payloadMessages,
                num_ctx: parseInt(contextSelect.value, 10),
                temperature: 0.7
            };

            try {
                abortController = new AbortController();
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reqPayload),
                    signal: abortController.signal
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\\n\\n');
                    buffer = lines.pop(); // guardar fragmento no terminado

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('data: ')) {
                            const jsonStr = trimmed.slice(6);
                            try {
                                const data = JSON.parse(jsonStr);
                                if (data.token) {
                                    fullResponse += data.token;
                                    botBubble.innerHTML = renderMarkdown(fullResponse);
                                    enhanceCodeBlocks(botBubble);
                                    messagesList.scrollTop = messagesList.scrollHeight;
                                }
                                if (data.done) {
                                    const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
                                    const speed = data.speed || '30+';
                                    metaInfo.textContent = `⚡ ${speed} tokens/s • ${totalTime}s • Contexto: ${contextSelect.value} tokens`;
                                }
                            } catch (e) {
                                console.error('Error parseando chunk SSE:', e);
                            }
                        }
                    }
                }

                // Guardar en historial
                conversationHistory.push({ role: 'assistant', content: fullResponse });

            } catch (err) {
                if (err.name !== 'AbortError') {
                    botBubble.innerHTML = `<span style="color: var(--danger)">⚠️ Error al conectar con Qwen: ${err.message}</span>`;
                }
            } finally {
                isGenerating = false;
                sendBtn.disabled = false;
                userInput.focus();
            }
        }

        function appendUserMessage(text, filesList) {
            const row = document.createElement('div');
            row.className = 'message-row user';

            const avatar = document.createElement('div');
            avatar.className = 'avatar user';
            avatar.textContent = 'Tú';

            const bubble = document.createElement('div');
            bubble.className = 'bubble';

            let badgesHtml = '';
            if (filesList && filesList.length > 0) {
                badgesHtml = '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">';
                filesList.forEach(f => {
                    badgesHtml += `<span style="background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(99, 102, 241, 0.5); color: #c7d2fe; font-size: 0.78rem; padding: 2px 8px; border-radius: 4px;">📎 ${f.name} (${formatBytes(f.size)})</span>`;
                });
                badgesHtml += '</div>';
            }

            const bodyHtml = text ? renderMarkdown(text) : '<em style="color: var(--text-muted);">Archivos enviados para análisis</em>';
            bubble.innerHTML = badgesHtml + bodyHtml;

            row.appendChild(avatar);
            row.appendChild(bubble);
            messagesList.appendChild(row);
            messagesList.scrollTop = messagesList.scrollHeight;
        }

        function createMessageElement(role) {
            const row = document.createElement('div');
            row.className = `message-row ${role}`;

            const avatar = document.createElement('div');
            avatar.className = `avatar ${role}`;
            avatar.textContent = role === 'user' ? 'Tú' : 'Q';

            const bubbleContainer = document.createElement('div');
            bubbleContainer.style.maxWidth = 'calc(100% - 60px)';
            bubbleContainer.style.width = '100%';

            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.innerHTML = '<span style="color: var(--text-muted)">Escribiendo...</span>';

            const meta = document.createElement('div');
            meta.className = 'meta-info';

            bubbleContainer.appendChild(bubble);
            if (role === 'assistant') {
                bubbleContainer.appendChild(meta);
            }

            row.appendChild(avatar);
            row.appendChild(bubbleContainer);
            return row;
        }

        function enhanceCodeBlocks(container) {
            const pres = container.querySelectorAll('pre');
            pres.forEach(pre => {
                if (pre.querySelector('.code-header')) return; // Ya decorado

                const code = pre.querySelector('code');
                const lang = code ? (code.className.match(/language-(\\w+)/) || [''])[1] || 'código' : 'código';

                const header = document.createElement('div');
                header.className = 'code-header';
                header.innerHTML = `
                    <span>${lang}</span>
                    <button class="copy-btn" onclick="copyCode(this)">Copiar</button>
                `;

                pre.insertBefore(header, pre.firstChild);
            });
        }

        function copyCode(btn) {
            const pre = btn.closest('pre');
            const code = pre.querySelector('code');
            if (code) {
                navigator.clipboard.writeText(code.innerText).then(() => {
                    const originalText = btn.textContent;
                    btn.textContent = '¡Copiado!';
                    btn.style.color = 'var(--success)';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.color = '';
                    }, 2000);
                });
            }
        }

        // Inicializar
        checkStatus();
    </script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
async def serve_index() -> HTMLResponse:
    """Entrega la interfaz gráfica web en un solo archivo SPA."""
    return HTMLResponse(content=HTML_CONTENT, status_code=200)


def find_available_port(start_port: int = 7860, max_attempts: int = 10) -> int:
    """Busca un puerto libre a partir de start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port


def open_browser(port: int) -> None:
    """Abre el navegador web predeterminado apuntando a la interfaz."""
    time.sleep(1.2)
    webbrowser.open(f"http://127.0.0.1:{port}")


def main() -> None:
    """Punto de entrada principal para ejecutar el servidor y abrir el navegador."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    port = find_available_port(PORT)

    print("=" * 65)
    print("[*] INICIANDO INTERFAZ GRAFICA LOCAL DE QWEN 2.5 (GPU)")
    print(f"[*] Accede desde tu navegador en: http://127.0.0.1:{port}")
    print("=" * 65)

    # 1. Asegurar que Ollama esté levantado
    ensure_ollama_running()

    # 2. Abrir navegador en un hilo separado
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    # 3. Iniciar uvicorn
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
