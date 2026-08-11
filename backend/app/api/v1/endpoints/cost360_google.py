from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import os
import json

from app.db.base import get_db
from app.crud.crud_cost360 import (
    get_item_by_code,
    get_apu_materials, get_apu_equipments, get_apu_labors
)

router = APIRouter()

@router.post("/apu/{item_id}/export-googlesheet")
async def export_apu_googlesheet(item_id: str, db: Session = Depends(get_db)):
    """
    Exporta un APU a Google Sheets con fórmulas y formato.
    Prueba alternativa a Excel/openpyxl.
    """
    try:
        # Verificar si hay credenciales de Google configuradas
        credentials_path = os.environ.get('GOOGLE_CREDENTIALS_PATH', 'credentials.json')
        if not os.path.exists(credentials_path):
            raise HTTPException(
                status_code=500, 
                detail="No se encontraron credenciales de Google. Configure GOOGLE_CREDENTIALS_PATH"
            )
        
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build
        
        # Cargar credenciales
        creds = Credentials.from_service_account_file(credentials_path)
        service = build('sheets', 'v4', credentials=creds)
        
        # Obtener datos del APU
        try:
            item = get_item_by_code(db, item_id.split('-')[0])
        except Exception:
            raise HTTPException(status_code=404, detail="Item not found")
        
        mat_rows = get_apu_materials(db, item_id)
        eq_rows = get_apu_equipments(db, item_id)
        mo_rows = get_apu_labors(db, item_id)
        
        rendimiento = item.RenPar or 1.0
        admin_gg = 16.0
        imprevisto_ut = 10.0
        
        # Crear nuevo spreadsheet
        spreadsheet = {
            'properties': {
                'title': f"APU_{item.CovPar or item.CodPar}",
            },
            'sheets': [{
                'properties': {
                    'title': 'APU',
                    'gridProperties': {
                        'rowCount': 100,
                        'columnCount': 8
                    }
                }
            }]
        }
        
        result = service.spreadsheets().create(body=spreadsheet).execute()
        spreadsheet_id = result['spreadsheetId']
        
        # Preparar datos en formato de Google Sheets
        # Header
        header_data = [
            ["ANÁLISIS DE PRECIO UNITARIO"],
            [f"Obra: {item.Descri or 'N/A'}"],
            ["Código:", item.CovPar or item.CodPar, "", "Unidad:", item.UniPar, "", "Rendimiento:", rendimiento],
            [],  # Fila vacía
            ["1. MATERIALES"],
            ["No.", "Descripción", "Und.", "Cant.", "Desp.", "Precio", "Total"],
        ]
        
        # Materiales
        mat_start_row = len(header_data)
        for i, (apu_mat, mat) in enumerate(mat_rows):
            row_num = mat_start_row + i + 1
            formula = f"=ROUND((F{row_num}*D{row_num})*((E{row_num}/100)+1),2)"
            header_data.append([
                i + 1,
                mat.Descri if mat else '',
                mat.UniMat if mat else '',
                apu_mat.CanIns or 0,
                apu_mat.Desper or 0,
                mat.CosMat if mat else 0,
                formula
            ])
        
        mat_end_row = len(header_data)
        total_mat_row = mat_end_row + 1
        mat_sum_range = f"H{mat_start_row+1}:H{mat_end_row}"
        header_data.append(["", "", "", "", "", "Total Materiales:", f"=SUM({mat_sum_range})"])
        
        # Equipos
        header_data.append([], ["2. EQUIPOS"], ["No.", "Descripción", "", "Cant.", "Cop/Dep", "Precio", "Total"])
        eq_start_row = len(header_data)
        for i, (apu_eq, eq) in enumerate(eq_rows):
            row_num = eq_start_row + i + 1
            formula = f"=ROUND((F{row_num}*D{row_num})*(E{row_num}),2)"
            header_data.append([
                i + 1,
                eq.Descri if eq else '',
                "",
                apu_eq.CanIns or 0,
                apu_eq.Deprec or 0,
                eq.CosDia if eq else 0,
                formula
            ])
        
        eq_end_row = len(header_data)
        total_eq_row = eq_end_row + 1
        eq_sum_range = f"H{eq_start_row+1}:H{eq_end_row}"
        header_data.append(["", "", "", "", "", "Total Equipos:", f"=SUM({eq_sum_range})"])
        
        # Mano de Obra
        header_data.append([], ["3. MANO DE OBRA"], ["No.", "Descripción", "Cant.", "Jornal", "Bono", "Total Jornal", "Total Bono"])
        mo_start_row = len(header_data)
        for i, (apu_mo, mo) in enumerate(mo_rows):
            row_num = mo_start_row + i + 1
            formula_jornal = f"=D{row_num}*C{row_num}"
            formula_bono = f"=E{row_num}*C{row_num}"
            header_data.append([
                i + 1,
                mo.Descri if mo else '',
                apu_mo.CanIns or 0,
                mo.Jornal if mo else 0,
                mo.Bono if mo else 0,
                formula_jornal,
                formula_bono
            ])
        
        mo_end_row = len(header_data)
        total_mo_row = mo_end_row + 1
        jornal_sum_range = f"G{mo_start_row+1}:G{mo_end_row}"
        bono_sum_range = f"H{mo_start_row+1}:H{mo_end_row}"
        header_data.append(["", "", "", "", "", "Total Mano de Obra:", f"=SUM({jornal_sum_range})", f"=SUM({bono_sum_range})"])
        
        # Resumen
        header_data.append([], ["RESUMEN"])
        header_data.append(["Costo Directo:", "", "", "", "", "", f"=H{mat_end_row}+H{eq_end_row}+H{mo_end_row}"])
        header_data.append([f"Administración y Gastos ({admin_gg}%):", "", "", "", "", "", f"=R[-1]C*{admin_gg/100}"])
        header_data.append(["Subtotal B:", "", "", "", "", "", "=R[-2]C+R[-1]C"])
        header_data.append([f"Imprevisto y Utilidad ({imprevisto_ut}%):", "", "", "", "", "", f"=R[-1]C*{imprevisto_ut/100}"])
        header_data.append(["PRECIO UNITARIO FINAL:", "", "", "", "", "", "=R[-2]C+R[-1]C"])
        
        # Escribir datos en el spreadsheet
        body = {
            'values': header_data
        }
        
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range='APU!A1',
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        
        # Aplicar formato básico
        batch_update = {
            'requests': [
                # Header verde
                {
                    'repeatCell': {
                        'range': {
                            'sheetId': 0,
                            'startRowIndex': 0,
                            'endRowIndex': 1,
                            'startColumnIndex': 0,
                            'endColumnIndex': 8
                        },
                        'cell': {
                            'userEnteredFormat': {
                                'backgroundColor': {'red': 0.29, 'green': 0.68, 'blue': 0.31},
                                'textFormat': {'foregroundColor': {'red': 1, 'green': 1, 'blue': 1}},
                                'horizontalAlignment': 'CENTER'
                            }
                        }
                    }
                },
                # Secciones naranjas
                {
                    'repeatCell': {
                        'range': {
                            'sheetId': 0,
                            'startRowIndex': 4,
                            'endRowIndex': 5,
                            'startColumnIndex': 0,
                            'endColumnIndex': 8
                        },
                        'cell': {
                            'userEnteredFormat': {
                                'backgroundColor': {'red': 1, 'green': 0.65, 'blue': 0.15},
                                'textFormat': {'bold': True}
                            }
                        }
                    }
                }
            ]
        }
        
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=batch_update
        ).execute()
        
        return {
            "status": "success",
            "spreadsheet_id": spreadsheet_id,
            "url": f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}"
        }
        
    except Exception as e:
        import traceback
        print(f"Error exportando a Google Sheets: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error al exportar a Google Sheets: {str(e)}")
