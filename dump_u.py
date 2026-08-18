import subprocess
with open('dump.sql', 'w') as f:
    f.write('\\copy (SELECT * FROM temp_u.cost360_materials) TO STDOUT WITH CSV HEADER')

cmd = 'python ssh_runner.py --upload dump.sql /root/dump.sql'
subprocess.run(cmd, shell=True)

cmd = 'python ssh_runner.py "docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < /root/dump.sql"'
proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)

with open('staging_materials_u.csv', 'w', encoding='utf-8') as f:
    f.write(proc.stdout)

print("Dumped staging_materials_u.csv")
