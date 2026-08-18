import subprocess
with open('dump_eq.sql', 'w') as f:
    f.write('\\copy (SELECT * FROM temp_u.cost360_equipment) TO STDOUT WITH CSV HEADER')

cmd = 'python ssh_runner.py --upload dump_eq.sql /root/dump_eq.sql'
subprocess.run(cmd, shell=True)

cmd = 'python ssh_runner.py "docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < /root/dump_eq.sql"'
proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)

with open('staging_equipments_u.csv', 'w', encoding='utf-8') as f:
    f.write(proc.stdout)

print("Dumped staging_equipments_u.csv")
