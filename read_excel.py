import pandas as pd

def read_excel():
    try:
        df_all = pd.read_excel(r"C:\Users\pablo\Desktop\BD_COST360\codificacion de partidas.xlsx", header=None)
        
        # Encuentra el indice de 'U7 VIALIDAD'
        mask = df_all.astype(str).apply(lambda x: x.str.contains('U7  VIALIDAD', case=False, na=False))
        idx = df_all[mask.any(axis=1)].index[0]
        
        # Imprime 30 filas siguientes
        print(df_all.iloc[idx:idx+30, 2:4])
        
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    read_excel()
