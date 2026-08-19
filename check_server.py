import ssh_runner
ssh_runner.run_ssh_command("docker cp /tmp/auto_merge.py apupro_platform-apupro-backend-1:/app/auto_merge.py")
ssh_runner.run_ssh_command("docker exec apupro_platform-apupro-backend-1 python /app/auto_merge.py > /tmp/auto_merge_log.txt 2>&1")
