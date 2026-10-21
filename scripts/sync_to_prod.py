import os
import subprocess

def main():
    key_path = "C:/Users/pablo/.ssh/id_ed25519"
    server = "root@167.172.115.154"

    files_to_sync = [
        ("backend/app/services/ai_apu_service_v2/composer.py", "/root/apupro_platform/backend/app/services/ai_apu_service_v2/composer.py", "/app/app/services/ai_apu_service_v2/composer.py"),
        ("backend/app/services/ai_apu_service/domain_rules/sanitize_partida.py", "/root/apupro_platform/backend/app/services/ai_apu_service/domain_rules/sanitize_partida.py", "/app/app/services/ai_apu_service/domain_rules/sanitize_partida.py"),
        ("backend/app/services/ai_apu_service/rag_context/candidates.py", "/root/apupro_platform/backend/app/services/ai_apu_service/rag_context/candidates.py", "/app/app/services/ai_apu_service/rag_context/candidates.py"),
        ("backend/app/api/v1/endpoints/costbase/ai_generation.py", "/root/apupro_platform/backend/app/api/v1/endpoints/costbase/ai_generation.py", "/app/app/api/v1/endpoints/costbase/ai_generation.py"),
        ("scripts/test_candidates.py", "/root/apupro_platform/backend/test_candidates.py", "/app/test_candidates.py"),
        ("scripts/test_v2.py", "/root/apupro_platform/backend/test_v2.py", "/app/test_v2.py"),
    ]

    for local_rel, remote_host, container_dest in files_to_sync:
        local_path = os.path.abspath(local_rel)
        print(f"Uploading {local_rel} -> {remote_host}...")
        scp_cmd = ["scp", "-i", key_path, local_path, f"{server}:{remote_host}"]
        subprocess.run(scp_cmd, check=True)

        docker_cp = f"docker cp {remote_host} apupro_platform-apupro-backend-1:{container_dest}"
        subprocess.run(["ssh", "-n", "-i", key_path, server, docker_cp], check=True)

    print("\nRestarting apupro-backend container...")
    subprocess.run(["ssh", "-n", "-i", key_path, server, "cd /root/apupro_platform && docker compose restart apupro-backend"], check=True)
    print("Done!")

if __name__ == "__main__":
    main()
