@echo off
echo Migrando datos de la base temporal (temp_m) a la base maestra...
docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db < migrate_to_master.sql
echo Migracion completada exitosamente.
pause
