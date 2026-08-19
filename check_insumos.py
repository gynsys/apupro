import pandas as pd

def check_sheets():
    try:
        xl = pd.ExcelFile(r'C:\Users\pablo\Desktop\Insumos.xlsx')
        print("Hojas en el archivo:", xl.sheet_names)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    check_sheets()
