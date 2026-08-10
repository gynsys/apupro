import subprocess
import sys
import os

def run_ssh_command(cmd: str) -> str:
    """Ejecuta un comando SSH en el servidor de producción."""
    ssh_cmd = [
        "ssh", 
        "-i", "C:/Users/pablo/.ssh/id_ed25519", 
        "root@167.172.115.154", 
        cmd
    ]
    try:
        result = subprocess.run(ssh_cmd, capture_output=True, text=True, check=False)
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        return ""
    except Exception as e:
        print(f"Error executing SSH command: {e}")
        return ""

def upload_file(local_path: str, remote_path: str) -> bool:
    """Sube un archivo al servidor usando SCP."""
    scp_cmd = [
        "scp",
        "-i", "C:/Users/pablo/.ssh/id_ed25519",
        local_path,
        f"root@167.172.115.154:{remote_path}"
    ]
    try:
        subprocess.run(scp_cmd, check=True, encoding='utf-8')
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error uploading file: {e}")
        return False

def download_file(remote_path: str, local_path: str) -> bool:
    """Descarga un archivo del servidor usando SCP."""
    scp_cmd = [
        "scp",
        "-i", "C:/Users/pablo/.ssh/id_ed25519",
        f"root@167.172.115.154:{remote_path}",
        local_path
    ]
    try:
        subprocess.run(scp_cmd, check=True, encoding='utf-8')
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error downloading file: {e}")
        return False


if __name__ == "__main__":
    # Fix for Windows console encoding issues
    if sys.stdout.encoding != 'utf-8':
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) < 2:
        print("Usage: python ssh_runner.py <command> OR python ssh_runner.py --upload <local> <remote> OR python ssh_runner.py --download <remote> <local>")
        sys.exit(1)
        
    if sys.argv[1] == "--upload":
        if len(sys.argv) < 4:
            print("Usage: python ssh_runner.py --upload <local> <remote>")
            sys.exit(1)
        upload_file(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "--download":
        if len(sys.argv) < 4:
            print("Usage: python ssh_runner.py --download <remote> <local>")
            sys.exit(1)
        download_file(sys.argv[2], sys.argv[3])
    else:
        print(run_ssh_command(sys.argv[1]))
