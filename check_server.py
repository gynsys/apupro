import ssh_runner
ssh_runner.run_ssh_command("docker cp /tmp/market.py apupro_platform-apupro-backend-1:/app/app/api/v1/endpoints/market.py")
ssh_runner.run_ssh_command("docker restart apupro_platform-apupro-backend-1")
