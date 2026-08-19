import ssh_runner
ssh_runner.run_ssh_command("docker cp /tmp/test_gemini.py apupro_platform-apupro-backend-1:/app/test_gemini.py")
ssh_runner.run_ssh_command("docker exec apupro_platform-apupro-backend-1 python /app/test_gemini.py")
ssh_runner.run_ssh_command("docker exec apupro_platform-apupro-backend-1 rm -f /app/test_gemini.py")
