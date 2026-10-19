"""Agente autonomo de desarrollo con Qwen 2.5 local (Ollama).

Permite a Qwen leer, editar archivos y ejecutar pruebas directamente en el proyecto,
con salvaguardas automaticas:
1. Copias de seguridad (Backups) antes de cualquier modificacion.
2. Validacion de sintaxis estricta (py_compile) con rollback automatico si hay error.
3. Bloqueo de reemplazos perezosos (anti '... existing code ...').
4. Modo interactivo o autonomo (-y / --auto).
"""

import argparse
import datetime
import json
import os
import py_compile
import re
import shutil
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import urllib.error
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
DEFAULT_MODEL: str = os.getenv("QWEN_MODEL", "qwen2.5:7b")
WORKSPACE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKUP_DIR: str = os.path.join(WORKSPACE_DIR, ".qwen_backups")

AGENT_SYSTEM_PROMPT: str = (
    "Eres un Agente Ingeniero de Software Senior trabajando directamente en el repositorio local. "
    "Tienes herramientas para inspeccionar directorios, leer archivos, modificar archivos y ejecutar comandos. "
    "REGLAS CRITICAS:\n"
    "1. Responde SIEMPRE en espanol y manten el foco estricto en el objetivo del usuario sin desviarte.\n"
    "2. Para tareas de conteo, metricas, busqueda global o escaneo de muchos archivos (ej: buscar monolitos >1000 lineas, "
    "contar lineas de codigo, o buscar referencias en todo el proyecto), NUNCA leas los archivos uno a uno con `read_file`. "
    "Usa `run_command` con un script o comando rapido de Python o PowerShell para obtener la lista inmediatamente.\n"
    "3. Siempre lee un archivo con `read_file` antes de modificarlo para entender su contexto exacto.\n"
    "4. NUNCA escribas abreviaciones como '... existing code ...' o '# resto del codigo'. Escribe el codigo real y completo.\n"
    "5. Puedes usar `replace_lines` para ediciones quirurgicas o `write_file` para crear/reescribir archivos.\n"
    "6. Despues de modificar codigo Python, verifica la sintaxis o ejecuta las pruebas correspondientes con `run_command`.\n"
    "7. Cuando termines la tarea por completo, responde con un resumen conciso de los resultados obtenidos."
)

FORBIDDEN_LAZY_PATTERNS: List[re.Pattern] = [
    re.compile(r"//\s*\.\.\.\s*existing\s*code", re.IGNORECASE),
    re.compile(r"#\s*\.\.\.\s*existing\s*code", re.IGNORECASE),
    re.compile(r"#\s*\.\.\.\s*resto\s*del\s*c[oó]digo", re.IGNORECASE),
    re.compile(r"/\*\s*\.\.\.\s*existing\s*code\s*\*/", re.IGNORECASE),
    re.compile(r"\.\.\.\s*rest\s*of\s*the\s*code", re.IGNORECASE),
]


def resolve_safe_path(filepath: str) -> str:
    """Resuelve la ruta absoluta y asegura que permanezca dentro del workspace."""
    if not filepath or not isinstance(filepath, str):
        raise ValueError("La ruta del archivo es obligatoria.")
    clean_path = filepath.strip()
    if not os.path.isabs(clean_path):
        clean_path = os.path.join(WORKSPACE_DIR, clean_path)
    abs_path = os.path.abspath(clean_path)
    if not abs_path.startswith(WORKSPACE_DIR):
        raise ValueError(f"Ruta fuera del workspace no permitida: {filepath}")
    return abs_path


def create_backup(filepath: str) -> Optional[str]:
    """Crea una copia de seguridad timestamped de un archivo antes de modificarlo."""
    if not os.path.exists(filepath):
        return None
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = os.path.basename(filepath)
    backup_path = os.path.join(BACKUP_DIR, f"{base_name}_{timestamp}.bak")
    shutil.copy2(filepath, backup_path)
    return backup_path


def restore_backup(filepath: str, backup_path: Optional[str]) -> None:
    """Restaura un archivo desde su copia de seguridad en caso de fallo."""
    if backup_path and os.path.exists(backup_path):
        shutil.copy2(backup_path, filepath)


# ==========================================
# DEFINICION DE HERRAMIENTAS DISPONIBLES
# ==========================================

def tool_read_file(filepath: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> str:
    """Lee el contenido de un archivo local con soporte de rangos de lineas."""
    try:
        abs_path = resolve_safe_path(filepath)
        if not os.path.exists(abs_path):
            return f"Error: El archivo '{filepath}' no existe."
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        total = len(lines)
        s = max(1, start_line or 1)
        e = min(total, end_line or total)
        if s > total:
            return f"Error: start_line ({s}) excede el total de lineas ({total})."

        output_lines = [f"{i}: {lines[i - 1]}" for i in range(s, e + 1)]
        header = f"=== Archivo: {filepath} (Lineas {s} a {e} de {total}) ===\n"
        return header + "".join(output_lines)
    except Exception as exc:
        return f"Error leyendo archivo: {exc}"


def tool_write_file(filepath: str, content: str) -> str:
    """Escribe o sobreescribe un archivo completo con salvaguardas."""
    try:
        abs_path = resolve_safe_path(filepath)

        # 1. Chequeo anti-lazy
        for pat in FORBIDDEN_LAZY_PATTERNS:
            if pat.search(content):
                return (
                    "ACCION RECHAZADA POR SEGURIDAD: Se detecto un patron abreviado ('... existing code ...'). "
                    "Debes escribir el archivo completo sin omitir codigo existente."
                )

        # 2. Backup automatico
        backup_path = create_backup(abs_path)

        # 3. Guardar archivo
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(content)

        # 4. Validar sintaxis en archivos Python
        if abs_path.endswith(".py"):
            try:
                py_compile.compile(abs_path, doraise=True)
            except py_compile.PyCompileError as compile_err:
                restore_backup(abs_path, backup_path)
                return (
                    f"ERROR DE SINTAXIS PYTHON DETECTADO: El archivo no compilo.\n{compile_err}\n"
                    "Se restauro automaticamente la copia previa. Por favor corrige el error de sintaxis."
                )

        bak_info = f" (Backup guardado en {os.path.basename(backup_path)})" if backup_path else " (Nuevo archivo)"
        return f"OK: Archivo '{filepath}' guardado exitosamente.{bak_info}"
    except Exception as exc:
        return f"Error escribiendo archivo: {exc}"


def tool_replace_lines(filepath: str, start_line: int, end_line: int, new_content: str) -> str:
    """Reemplaza un rango de lineas especifico (1-indexado, inclusivo) en un archivo existente."""
    try:
        abs_path = resolve_safe_path(filepath)
        if not os.path.exists(abs_path):
            return f"Error: El archivo '{filepath}' no existe."

        for pat in FORBIDDEN_LAZY_PATTERNS:
            if pat.search(new_content):
                return "ACCION RECHAZADA: No uses patrones tipo '... existing code ...'."

        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        total = len(lines)
        if start_line < 1 or end_line < start_line or start_line > total:
            return f"Error: Rango de lineas invalido ({start_line}-{end_line}). Total lineas: {total}."

        backup_path = create_backup(abs_path)

        replacement_lines = [l + "\n" if not l.endswith("\n") else l for l in new_content.splitlines()]
        updated_lines = lines[: start_line - 1] + replacement_lines + lines[end_line:]

        with open(abs_path, "w", encoding="utf-8") as f:
            f.writelines(updated_lines)

        if abs_path.endswith(".py"):
            try:
                py_compile.compile(abs_path, doraise=True)
            except py_compile.PyCompileError as compile_err:
                restore_backup(abs_path, backup_path)
                return (
                    f"ERROR DE SINTAXIS: La modificacion provoco un error de compilacion.\n{compile_err}\n"
                    "Se restauro el archivo original. Corrige la indentacion o sintaxis."
                )

        return f"OK: Lineas {start_line}-{end_line} reemplazadas exitosamente en '{filepath}'."
    except Exception as exc:
        return f"Error reemplazando lineas: {exc}"


def tool_run_command(command: str) -> str:
    """Ejecuta un comando en la consola dentro del workspace."""
    try:
        if not command or not command.strip():
            return "Error: Comando vacio."

        forbidden_commands = ["rm -rf /", "format", "del /f /s /q c:\\", "shutdown"]
        for forbidden in forbidden_commands:
            if forbidden in command.lower():
                return f"ACCION BLOQUEADA: Comando potencialmente peligroso '{command}'."

        process = subprocess.run(
            command,
            shell=True,
            cwd=WORKSPACE_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=60,
        )
        out = (process.stdout or "").strip()
        err = (process.stderr or "").strip()
        code = process.returncode

        res = f"Codigo de salida: {code}\n"
        if out:
            res += f"=== STDOUT ===\n{out[:2000]}\n"
        if err:
            res += f"=== STDERR ===\n{err[:2000]}\n"
        return res
    except subprocess.TimeoutExpired:
        return "Error: El comando supero el tiempo limite de 60 segundos."
    except Exception as exc:
        return f"Error ejecutando comando: {exc}"


def tool_list_dir(dirpath: str = ".") -> str:
    """Lista los archivos y carpetas de un directorio relativo."""
    try:
        abs_path = resolve_safe_path(dirpath)
        if not os.path.exists(abs_path):
            return f"Error: El directorio '{dirpath}' no existe."
        entries = os.listdir(abs_path)
        dirs = [e + "/" for e in entries if os.path.isdir(os.path.join(abs_path, e)) and not e.startswith(".")]
        files = [e for e in entries if os.path.isfile(os.path.join(abs_path, e)) and not e.startswith(".")]
        return f"Directorio: {dirpath}\nCarpetas: {', '.join(sorted(dirs)[:30])}\nArchivos: {', '.join(sorted(files)[:30])}"
    except Exception as exc:
        return f"Error listando directorio: {exc}"


TOOLS_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Lee el contenido de un archivo del proyecto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Ruta relativa del archivo (ej: 'backend/app/main.py')."},
                    "start_line": {"type": "integer", "description": "Linea inicial opcional (1-indexada)."},
                    "end_line": {"type": "integer", "description": "Linea final opcional (inclusiva)."}
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Crea o sobreescribe un archivo completo con nuevo codigo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Ruta relativa del archivo a escribir."},
                    "content": {"type": "string", "description": "Contenido completo del archivo. Prohibido usar '... existing code ...'."}
                },
                "required": ["filepath", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "replace_lines",
            "description": "Reemplaza un rango de lineas especifico de un archivo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Ruta relativa del archivo a modificar."},
                    "start_line": {"type": "integer", "description": "Numero de linea donde empieza el reemplazo (1-indexado)."},
                    "end_line": {"type": "integer", "description": "Numero de linea donde termina el reemplazo (inclusivo)."},
                    "new_content": {"type": "string", "description": "Nuevo texto o codigo que reemplazara esas lineas."}
                },
                "required": ["filepath", "start_line", "end_line", "new_content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Ejecuta un comando de consola o prueba en el workspace (ej: 'python -m pytest ...').",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Comando de consola a ejecutar."}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "Lista el contenido de una carpeta en el proyecto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "dirpath": {"type": "string", "description": "Ruta de la carpeta (ej: 'backend/app')."}
                }
            }
        }
    }
]

TOOL_DISPATCHER = {
    "read_file": tool_read_file,
    "write_file": tool_write_file,
    "replace_lines": tool_replace_lines,
    "run_command": tool_run_command,
    "list_dir": tool_list_dir,
}


def call_ollama_chat(messages: List[Dict[str, Any]], model: str = DEFAULT_MODEL) -> Dict[str, Any]:
    """Envia una solicitud al endpoint /api/chat de Ollama con soporte de tools."""
    url = f"{DEFAULT_OLLAMA_URL.rstrip('/')}/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "tools": TOOLS_DEFINITIONS,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 4096,
        }
    }
    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_agent_loop(task: str, model: str = DEFAULT_MODEL, max_turns: int = 10, auto_confirm: bool = False) -> None:
    """Bucle autonomo ReAct de Qwen 2.5."""
    print("=" * 65)
    print(f"[*] INICIANDO AGENTE AUTONOMO QWEN ({model}) EN GPU")
    print(f"[*] TAREA: {task}")
    print("=" * 65)

    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": task}
    ]

    for turn in range(1, max_turns + 1):
        print(f"\n--- [Turno {turn}/{max_turns}] Pensando y decidiendo accion en GPU... ---")
        try:
            response = call_ollama_chat(messages, model=model)
        except Exception as exc:
            print(f"[!] Error conectando con Ollama: {exc}", file=sys.stderr)
            break

        message = response.get("message", {})
        messages.append(message)

        content = message.get("content", "")
        tool_calls = message.get("tool_calls", [])

        if content:
            print(f"\n[Qwen]:\n{content}")

        if not tool_calls:
            print("\n[+] Tarea completada por el agente.")
            break

        for tc in tool_calls:
            func = tc.get("function", {})
            name = func.get("name")
            args = func.get("arguments", {})
            call_id = tc.get("id", f"call_{turn}")

            print(f"\n[Tool Call]: {name}({json.dumps(args, ensure_ascii=False)})")

            # Confirmacion si no es modo auto
            if name in ["write_file", "replace_lines"] and not auto_confirm:
                user_ok = input(f"   ¿Deseas permitir que Qwen modifique '{args.get('filepath')}'? (s/N): ").strip().lower()
                if user_ok not in ["s", "si", "y", "yes"]:
                    tool_output = "ACCION CANCELADA POR EL USUARIO."
                    print("   [x] Modificacion rechazada por el usuario.")
                    messages.append({"role": "tool", "content": tool_output, "tool_call_id": call_id})
                    continue

            handler = TOOL_DISPATCHER.get(name)
            if handler:
                try:
                    tool_output = handler(**args)
                except Exception as handler_err:
                    tool_output = f"Excepcion ejecutando herramienta {name}: {handler_err}"
            else:
                tool_output = f"Herramienta desconocida: {name}"

            print(f"   [Resultado]: {tool_output[:250]}...")
            messages.append({"role": "tool", "content": tool_output, "tool_call_id": call_id})


def main() -> None:
    """Entrada CLI para el agente autonomo."""
    parser = argparse.ArgumentParser(description="Agente autonomo de desarrollo local con Qwen 2.5.")
    parser.add_argument("task", nargs="?", type=str, help="Instruccion o tarea a realizar.")
    parser.add_argument("-m", "--model", type=str, default=DEFAULT_MODEL, help="Modelo Ollama a utilizar.")
    parser.add_argument("-y", "--auto", action="store_true", help="Modo 100%% autonomo (sin confirmaciones).")
    parser.add_argument("--turns", type=int, default=10, help="Numero maximo de turnos (default: 10).")

    args = parser.parse_args()
    if not args.task:
        args.task = input("Ingresa la tarea para el agente Qwen: ").strip()

    if not args.task:
        print("Error: No se especifico ninguna tarea.")
        sys.exit(1)

    run_agent_loop(task=args.task, model=args.model, max_turns=args.turns, auto_confirm=args.auto)


if __name__ == "__main__":
    main()
