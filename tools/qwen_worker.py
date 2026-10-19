"""Herramienta de delegacion de tareas de desarrollo a Qwen 2.5 local (Ollama).

Permite a Antigravity enviar prompts tecnicos extensos a la GPU GTX 1080
para generar esqueletos de codigo, schemas, parsers y borradores a costo cero.
"""

import argparse
import json
import os
import re
import sys
import time
from typing import Any, Dict, Optional
import urllib.error
import urllib.request

DEFAULT_OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
DEFAULT_MODEL: str = os.getenv("QWEN_MODEL", "qwen2.5:7b")

DEFAULT_SYSTEM_PROMPT: str = (
    "Eres un Ingeniero de Software Senior especializado en Python, FastAPI, "
    "TypeScript, React y sistemas de construccion civil (APUs/Presupuestos). "
    "Escribe codigo limpio, modular, completamente tipado, sin funciones vacias, "
    "con manejo de excepciones robusto y listo para integracion."
)


def extract_code_block(text: str) -> str:
    """Extrae el contenido del primer bloque de codigo markdown si existe.

    Args:
        text: Texto de respuesta generado por el modelo.

    Returns:
        Codigo extraido o el texto original si no hay bloque markdown.
    """
    if not isinstance(text, str):
        raise ValueError("El texto debe ser una cadena de caracteres.")

    pattern = r"```(?:\w+)?\n([\s\S]*?)```"
    match = re.search(pattern, text)
    if match:
        return match.group(1).strip()
    return text.strip()


def query_qwen(
    prompt: str,
    system_prompt: str = DEFAULT_SYSTEM_PROMPT,
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
    extract_code: bool = False,
    stream: bool = False,
    ollama_url: str = DEFAULT_OLLAMA_URL,
) -> Dict[str, Any]:
    """Envia una solicitud a Ollama y retorna la respuesta con metricas de rendimiento.

    Args:
        prompt: Instruccion o prompt tecnico detallado.
        system_prompt: Prompt del sistema para guiar al modelo.
        model: Nombre del modelo en Ollama.
        temperature: Temperatura de muestreo (0.1 - 0.3 para codigo).
        extract_code: Si es True, extrae solo el bloque dentro de ```.
        stream: Si es True, imprime los tokens en tiempo real a stdout.
        ollama_url: URL base de la instancia de Ollama.

    Returns:
        Diccionario con 'response', 'tokens', 'tokens_per_second', 'duration'.
    """
    if not prompt or not prompt.strip():
        raise ValueError("El prompt no puede estar vacio.")
    if not ollama_url or not ollama_url.strip():
        raise ValueError("La URL de Ollama no puede estar vacia.")

    endpoint = f"{ollama_url.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system_prompt,
        "stream": stream,
        "options": {
            "temperature": float(temperature),
            "num_predict": 4096,
        },
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=req_data,
        headers={"Content-Type": "application/json"},
    )

    start_time = time.time()
    try:
        if stream:
            collected_tokens = []
            eval_count = 0
            eval_duration_ns = 0
            with urllib.request.urlopen(req, timeout=300) as response:
                for line in response:
                    line_clean = line.strip()
                    if not line_clean:
                        continue
                    chunk = json.loads(line_clean.decode("utf-8"))
                    token = chunk.get("response", "")
                    if token:
                        sys.stdout.write(token)
                        sys.stdout.flush()
                        collected_tokens.append(token)
                    if chunk.get("done", False):
                        eval_count = chunk.get("eval_count", len(collected_tokens))
                        eval_duration_ns = chunk.get("eval_duration", 0)
            raw_response = "".join(collected_tokens)
            print()  # salto de linea final
        else:
            with urllib.request.urlopen(req, timeout=300) as response:
                res_json = json.loads(response.read().decode("utf-8"))
                raw_response = res_json.get("response", "")
                eval_count = res_json.get("eval_count", 0)
                eval_duration_ns = res_json.get("eval_duration", 0)
    except urllib.error.URLError as err:
        raise ConnectionError(
            f"No se pudo conectar con Ollama en {endpoint}. Asegurate de que 'ollama serve' este activo. Error: {err}"
        ) from err

    total_time = time.time() - start_time
    tokens_per_sec: float = 0.0
    if eval_duration_ns > 0:
        tokens_per_sec = eval_count / (eval_duration_ns / 1e9)
    elif total_time > 0 and eval_count > 0:
        tokens_per_sec = eval_count / total_time

    final_content = extract_code_block(raw_response) if extract_code else raw_response

    return {
        "response": final_content,
        "raw_response": raw_response,
        "tokens": eval_count,
        "tokens_per_second": round(tokens_per_sec, 2),
        "total_duration_seconds": round(total_time, 2),
        "model": model,
    }


def parse_arguments() -> argparse.Namespace:
    """Parsea los argumentos de linea de comandos."""
    parser = argparse.ArgumentParser(
        description="Delegador de tareas de programacion a Qwen 2.5 local."
    )
    parser.add_argument("--prompt", "-p", type=str, help="Prompt o tarea a ejecutar.")
    parser.add_argument(
        "--file", "-f", type=str, help="Archivo con el prompt o contexto a procesar."
    )
    parser.add_argument(
        "--system", "-s", type=str, default=DEFAULT_SYSTEM_PROMPT, help="System prompt personalizado."
    )
    parser.add_argument(
        "--model", "-m", type=str, default=DEFAULT_MODEL, help="Modelo a utilizar en Ollama."
    )
    parser.add_argument(
        "--temperature", "-t", type=float, default=0.2, help="Temperatura (default: 0.2)."
    )
    parser.add_argument(
        "--out", "-o", type=str, help="Archivo donde escribir el resultado generado."
    )
    parser.add_argument(
        "--extract-code",
        action="store_true",
        help="Extraer unicamente el bloque de codigo ```...```.",
    )
    parser.add_argument(
        "--stream",
        action="store_true",
        help="Transmitir los tokens en tiempo real a la consola.",
    )
    return parser.parse_args()


def main() -> None:
    """Punto de entrada principal para ejecucion por consola."""
    args = parse_arguments()

    prompt_content = ""
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: El archivo especificado no existe: {args.file}", file=sys.stderr)
            sys.exit(1)
        with open(args.file, "r", encoding="utf-8") as f:
            prompt_content = f.read()
    elif args.prompt:
        prompt_content = args.prompt
    else:
        print("Error: Debe proporcionar --prompt o --file", file=sys.stderr)
        sys.exit(1)

    print(f"[*] Enviando tarea a {args.model} en GPU...", file=sys.stderr)
    try:
        result = query_qwen(
            prompt=prompt_content,
            system_prompt=args.system,
            model=args.model,
            temperature=args.temperature,
            extract_code=args.extract_code,
            stream=args.stream,
        )
    except Exception as exc:
        print(f"Error durante la inferencia: {exc}", file=sys.stderr)
        sys.exit(1)

    print(
        f"[+] Generacion completada: {result['tokens']} tokens en "
        f"{result['total_duration_seconds']}s ({result['tokens_per_second']} tokens/s)",
        file=sys.stderr,
    )

    if args.out:
        out_dir = os.path.dirname(args.out)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(result["response"])
        print(f"[+] Codigo guardado en: {args.out}", file=sys.stderr)
    elif not args.stream:
        print(result["response"])


if __name__ == "__main__":
    main()
