@echo off
echo Actualizando los costos en la base de datos temp_m (dividiendo entre 65)...
docker exec -i apupro_platform-apupro-db-1 psql -U apupro_user -d apupro_db -c "SET search_path TO temp_m; UPDATE temp_m_items SET \"PreUni\" = \"PreUni\" / 65.0; UPDATE temp_m_materials SET \"CosMat\" = \"CosMat\" / 65.0; UPDATE temp_m_equipment SET \"CosDia\" = \"CosDia\" / 65.0; UPDATE temp_m_labor SET \"Jornal\" = \"Jornal\" / 65.0, \"Bono\" = \"Bono\" / 65.0;"
echo Listo. Los precios han sido convertidos a dolares.
pause
