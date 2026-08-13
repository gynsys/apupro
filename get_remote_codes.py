import subprocess
import json

def main():
    cmd = 'docker exec apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db -t -A -c "SELECT \\"CovPar\\" FROM cost360_items WHERE \\"CovPar\\" LIKE \'U%\';"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
    
    codes = [line.strip() for line in result.stdout.split('\n') if line.strip()]
    
    with open('/root/db_u_codes.json', 'w') as f:
        json.dump(codes, f)

if __name__ == '__main__':
    main()
