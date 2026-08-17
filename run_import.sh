#!/bin/bash
docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < /root/drop_temp_m.sql
docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < /root/create_temp_m.sql
docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < /root/import_m.sql
docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < /root/schema_m.sql
