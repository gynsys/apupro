import ssh_runner
import subprocess

SSH_KEY = "C:/Users/pablo/.ssh/id_ed25519"
SERVER = "root@167.172.115.154"

# SCP the fix script to the server's /tmp
scp_result = subprocess.run(
    ["scp", "-i", SSH_KEY, "./_fix_llm.py", f"{SERVER}:/tmp/fix_llm.py"],
    capture_output=True, text=True
)
print("SCP stdout:", scp_result.stdout)
print("SCP stderr:", scp_result.stderr)
print("SCP returncode:", scp_result.returncode)

if scp_result.returncode == 0:
    # Copy into container
    ssh_runner.run_ssh_command("docker cp /tmp/fix_llm.py apupro_platform-apupro-backend-1:/app/fix_llm.py")
    # Execute
    ssh_runner.run_ssh_command("docker exec apupro_platform-apupro-backend-1 python /app/fix_llm.py")
    # Cleanup
    ssh_runner.run_ssh_command("docker exec apupro_platform-apupro-backend-1 rm -f /app/fix_llm.py")
