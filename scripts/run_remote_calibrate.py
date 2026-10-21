import os
import subprocess
import sys

def main():
    key_path = "C:/Users/pablo/.ssh/id_ed25519"
    server = "root@167.172.115.154"

    files_to_upload = [
        ("scripts/prod_calibrate_budget.py", "/root/apupro_platform/backend/prod_calibrate_budget.py"),
        ("backend/app/services/budget_postprocessor.py", "/root/apupro_platform/backend/app/services/budget_postprocessor.py"),
        ("backend/app/services/ai_apu_service/domain_rules/scope_exclusions.py", "/root/apupro_platform/backend/app/services/ai_apu_service/domain_rules/scope_exclusions.py"),
    ]

    for local_f, remote_f in files_to_upload:
        full_local = os.path.abspath(local_f)
        print(f"Uploading {full_local} to {server}:{remote_f}...")
        scp_cmd = ["scp", "-i", key_path, full_local, f"{server}:{remote_f}"]
        subprocess.run(scp_cmd, check=True)

    print("\nCopying into Docker backend container and executing recalibration...")
    docker_cmd = (
        "docker cp /root/apupro_platform/backend/prod_calibrate_budget.py apupro_platform-apupro-backend-1:/app/prod_calibrate_budget.py && "
        "docker cp /root/apupro_platform/backend/app/services/budget_postprocessor.py apupro_platform-apupro-backend-1:/app/app/services/budget_postprocessor.py && "
        "docker cp /root/apupro_platform/backend/app/services/ai_apu_service/domain_rules/scope_exclusions.py apupro_platform-apupro-backend-1:/app/app/services/ai_apu_service/domain_rules/scope_exclusions.py && "
        "docker exec apupro_platform-apupro-backend-1 python /app/prod_calibrate_budget.py"
    )
    ssh_cmd = ["ssh", "-n", "-i", key_path, server, docker_cmd]
    res2 = subprocess.run(ssh_cmd, capture_output=True, text=True, check=False)
    print("STDOUT:\n" + res2.stdout)
    if res2.stderr:
        print("STDERR:\n" + res2.stderr)

if __name__ == "__main__":
    main()
