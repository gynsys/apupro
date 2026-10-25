import os
import subprocess

lock_file = "C:/Users/pablo/Documents/apupro_platform/.git/index.lock"
if os.path.exists(lock_file):
    print("Borrando .git/index.lock huérfano...")
    os.remove(lock_file)
    print("Archivo de bloqueo borrado.")

print("Añadiendo archivos...")
subprocess.run(["git", "add", "-A"], check=True)

print("Haciendo commit...")
res = subprocess.run(["git", "commit", "-m", "fix: improve CI/CD deploy pipeline and uppercase computos descriptions"], capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)

print("Git log...")
res_l = subprocess.run(["git", "log", "-n", "2", "--oneline"], capture_output=True, text=True)
print(res_l.stdout)
