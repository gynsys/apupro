"""
Script local para actualización masiva de precios - SIN CONSUMO DE TOKENS
Uso: python actualizar_precios_local.py
Pega los precios en formato: MAT1234: $1000
"""
import re
from sqlalchemy import create_engine, text

def procesar_texto_precios(texto):
    """Procesa texto de precios y extrae códigos y precios"""
    updates = []
    lineas = texto.strip().split('\n')
    
    for linea in lineas:
        # Match format: MATXXXX: $YYYY USD o MATXXXX: $YYYY
        match = re.match(r'([A-Z]+\d+):\s*\$?([\d,\.]+)', linea.strip())
        if match:
            codigo = match.group(1)
            precio_str = match.group(2).replace(',', '').replace('$', '')
            try:
                precio = float(precio_str)
                updates.append((codigo, precio))
            except ValueError:
                print(f"Error procesando línea: {linea}")
    
    return updates

def actualizar_precios(updates):
    """Actualiza precios directamente en base de datos"""
    engine = create_engine('postgresql://apupro_user:apupro_password@costbase.net:5440/apupro_db')
    
    with engine.connect() as conn:
        actualizados = 0
        errores = []
        
        for codigo, precio in updates:
            try:
                result = conn.execute(text('''
                    UPDATE cost360_materials 
                    SET "CosMat" = :precio
                    WHERE "CodMat" = :codigo
                '''), {"precio": precio, "codigo": codigo})
                
                if result.rowcount > 0:
                    actualizados += 1
                    print(f"✓ {codigo}: ${precio}")
                else:
                    errores.append(f"{codigo}: No encontrado")
                    print(f"✗ {codigo}: No encontrado")
                    
            except Exception as e:
                errores.append(f"{codigo}: {str(e)}")
                print(f"✗ {codigo}: Error - {str(e)}")
        
        conn.commit()
        
        print(f"\n{'='*50}")
        print(f"RESUMEN:")
        print(f"Actualizados: {actualizados}")
        print(f"Errores: {len(errores)}")
        if errores:
            print(f"Detalles errores: {errores}")
        print(f"{'='*50}")

def main():
    print("="*50)
    print("ACTUALIZACIÓN MASIVA DE PRECIOS - LOCAL")
    print("="*50)
    print("\nEste script NO consume tokens de IA")
    print("Actualización directa en base de datos\n")
    
    print("Pega los precios (formato: MAT1234: $1000):")
    print("Presiona Ctrl+D (Windows) o Ctrl+D (Linux/Mac) para terminar\n")
    
    # Leer entrada del usuario
    lineas = []
    try:
        while True:
            linea = input()
            if linea.strip():
                lineas.append(linea)
    except EOFError:
        pass
    
    if not lineas:
        print("No se ingresaron datos")
        return
    
    texto = '\n'.join(lineas)
    updates = procesar_texto_precios(texto)
    
    if not updates:
        print("No se encontraron precios válidos")
        return
    
    print(f"\n{len(updates)} precios encontrados para actualizar:")
    for codigo, precio in updates:
        print(f"  {codigo}: ${precio}")
    
    confirm = input(f"\n¿Confirmar actualización de {len(updates)} precios? (s/n): ")
    if confirm.lower() == 's':
        actualizar_precios(updates)
    else:
        print("Actualización cancelada")

if __name__ == '__main__':
    main()
