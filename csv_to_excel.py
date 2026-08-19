import pandas as pd

def csv_to_excel():
    # Leer el CSV con todos los materiales
    df = pd.read_csv(r'C:\Users\pablo\.gemini\antigravity\brain\056bfb52-b71e-4c8b-af8c-a8c8079a12ee\todos_los_mat.csv')
    
    # Renombrar columnas
    df = df.rename(columns={
        'CodMat': 'Referencia',
        'Descri': 'Material',
        'CosMatActual': 'Precio Actual'
    })
    
    # Asegurarnos de que 'NuevoPrecio' esté en blanco
    df['Nuevo Precio'] = ""
    
    # Seleccionar columnas
    df = df[['Referencia', 'Material', 'Precio Actual', 'Nuevo Precio']]
    
    # Exportar a Excel en el Escritorio
    output_path = r'C:\Users\pablo\Desktop\todos_los_mat.xlsx'
    
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Precios MAT')
        
        # Ajustar el ancho de las columnas
        worksheet = writer.sheets['Precios MAT']
        worksheet.column_dimensions['A'].width = 15  # Referencia
        worksheet.column_dimensions['B'].width = 80  # Material
        worksheet.column_dimensions['C'].width = 15  # Precio Actual
        worksheet.column_dimensions['D'].width = 20  # Nuevo Precio

if __name__ == '__main__':
    csv_to_excel()
