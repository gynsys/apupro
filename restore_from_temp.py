import sys
from app.db.base import SessionLocal
from sqlalchemy import text

def restore_database():
    db = SessionLocal()
    
    print("Iniciando restauración quirúrgica...")
    
    sql_script = """
    BEGIN;

    -- Restaurar Insumos (Materiales) PRIMERO para evitar Foreign Key violations
    INSERT INTO public.cost360_materials ("CodMat", "Descri", "UniMat", "CosMat")
    SELECT t."CodMat", t."Descri", t."UniMat", t."CosMat"
    FROM temp_u.cost360_materials t
    LEFT JOIN public.cost360_materials p ON t."CodMat" = p."CodMat"
    WHERE p."CodMat" IS NULL;

    INSERT INTO public.cost360_materials ("CodMat", "Descri", "UniMat", "CosMat")
    SELECT t."CodMat", t."Descri", t."UniMat", t."CosMat"
    FROM temp_m.cost360_materials t
    LEFT JOIN public.cost360_materials p ON t."CodMat" = p."CodMat"
    WHERE p."CodMat" IS NULL;

    UPDATE public.cost360_materials p
    SET "Descri" = t."Descri", "UniMat" = t."UniMat", "CosMat" = t."CosMat"
    FROM temp_u.cost360_materials t
    WHERE p."CodMat" = t."CodMat";

    UPDATE public.cost360_materials p
    SET "Descri" = t."Descri", "UniMat" = t."UniMat", "CosMat" = t."CosMat"
    FROM temp_m.cost360_materials t
    WHERE p."CodMat" = t."CodMat";

    -- Restaurar U APUs
    -- 1. Insert missing APUs
    INSERT INTO public.cost360_items ("CodPar", "Descri", "CovPar", "UniPar", "PreUni", "RenPar", "Categoria", "TipoActividad")
    SELECT t."CodPar", t."Descri", t."CovPar", t."UniPar", t."PreUni", t."RenPar", t."Categoria", t."TipoActividad"
    FROM temp_u.cost360_items t
    LEFT JOIN public.cost360_items p ON t."CodPar" = p."CodPar"
    WHERE p."CodPar" IS NULL;

    -- 2. Delete existing child records
    DELETE FROM public.cost360_apu_materials WHERE "CodPar" IN (SELECT "CodPar" FROM temp_u.cost360_items);
    DELETE FROM public.cost360_apu_equipment WHERE "CodPar" IN (SELECT "CodPar" FROM temp_u.cost360_items);
    DELETE FROM public.cost360_apu_labor WHERE "CodPar" IN (SELECT "CodPar" FROM temp_u.cost360_items);

    INSERT INTO public.cost360_apu_materials SELECT * FROM temp_u.cost360_apu_materials WHERE "CodPar" IN (SELECT "CodPar" FROM temp_u.cost360_items);
    INSERT INTO public.cost360_apu_equipment SELECT * FROM temp_u.cost360_apu_equipment WHERE "CodPar" IN (SELECT "CodPar" FROM temp_u.cost360_items);
    INSERT INTO public.cost360_apu_labor SELECT * FROM temp_u.cost360_apu_labor WHERE "CodPar" IN (SELECT "CodPar" FROM temp_u.cost360_items);

    UPDATE public.cost360_items p 
    SET "Descri" = t."Descri", "CovPar" = t."CovPar", "UniPar" = t."UniPar", "PreUni" = t."PreUni", "RenPar" = t."RenPar", "Categoria" = t."Categoria", "TipoActividad" = t."TipoActividad"
    FROM temp_u.cost360_items t
    WHERE p."CodPar" = t."CodPar";

    -- Restaurar M APUs
    -- 1. Insert missing APUs
    INSERT INTO public.cost360_items ("CodPar", "Descri", "CovPar", "UniPar", "PreUni", "RenPar", "Categoria", "TipoActividad")
    SELECT t."CodPar", t."Descri", t."CovPar", t."UniPar", t."PreUni", t."RenPar", t."Categoria", t."TipoActividad"
    FROM temp_m.cost360_items t
    LEFT JOIN public.cost360_items p ON t."CodPar" = p."CodPar"
    WHERE p."CodPar" IS NULL;

    -- 2. Delete existing child records
    DELETE FROM public.cost360_apu_materials WHERE "CodPar" IN (SELECT "CodPar" FROM temp_m.cost360_items);
    DELETE FROM public.cost360_apu_equipment WHERE "CodPar" IN (SELECT "CodPar" FROM temp_m.cost360_items);
    DELETE FROM public.cost360_apu_labor WHERE "CodPar" IN (SELECT "CodPar" FROM temp_m.cost360_items);

    INSERT INTO public.cost360_apu_materials SELECT * FROM temp_m.cost360_apu_materials WHERE "CodPar" IN (SELECT "CodPar" FROM temp_m.cost360_items);
    INSERT INTO public.cost360_apu_equipment SELECT * FROM temp_m.cost360_apu_equipment WHERE "CodPar" IN (SELECT "CodPar" FROM temp_m.cost360_items);
    INSERT INTO public.cost360_apu_labor SELECT * FROM temp_m.cost360_apu_labor WHERE "CodPar" IN (SELECT "CodPar" FROM temp_m.cost360_items);

    UPDATE public.cost360_items p 
    SET "Descri" = t."Descri", "CovPar" = t."CovPar", "UniPar" = t."UniPar", "PreUni" = t."PreUni", "RenPar" = t."RenPar", "Categoria" = t."Categoria", "TipoActividad" = t."TipoActividad"
    FROM temp_m.cost360_items t
    WHERE p."CodPar" = t."CodPar";

    COMMIT;
    """
    
    try:
        db.execute(text(sql_script))
        print("Restauración completada con éxito.")
    except Exception as e:
        print(f"Error durante la restauración: {e}")
        db.execute(text("ROLLBACK;"))
    finally:
        db.close()

if __name__ == '__main__':
    restore_database()
