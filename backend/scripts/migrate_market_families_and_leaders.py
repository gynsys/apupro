"""
Migration script: Creación de Familias Yeso/Anime y Cobertura 100% de Insumos Líderes.

Objetivos:
1. Crear respaldo físico de tablas en PostgreSQL.
2. Insertar familias FAM-DRYWALL y FAM-ANIME en cost360_material_families.
3. Reubicar materiales pertenecientes a Yeso/Drywall y Anime/EPS.
4. Fusionar micro-familias secundarias hacia sus familias oficiales.
5. Clasificar todos los materiales huérfanos con reglas léxicas constructivas.
6. Asignar market_indicator_id y calcular market_factor para el 100% de los materiales.
7. Validar integridad de métricas (0 huérfanos, 0 sin líder).
"""
import os
import sys
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy import text
from sqlalchemy.orm import Session

# Asegurar path de importación
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.logging import logger
from app.db.session import get_db_session
from app.db.models.market import CostMaterialFamily
from app.db.models.cost360 import CostMaterial

# Mapeo oficial de líderes por familia
LEADERS_MAP: Dict[str, str] = {
    "FAM-DRYWALL": "ACA014",    # LÁMINA DE YESO 4' X 8' X 1/2"
    "FAM-ANIME": "ESP004",      # ANIME EN LÁMINA E= 5 CM
    "FAM-18E7577F": "ELE128",   # CABLE THW 12 AWG COBRE
    "FAM-B1D67CE6": "PLO172",   # TUBO HG ASTM 120 D=1/2" 6.40 M
    "FAM-1E916DC4": "ACE019",   # CABILLA D=3/8" FY=4200
    "FAM-FAE5C031": "CON023",   # MORTERO / CONCRETO
    "FAM-E914CF58": "AGR001",   # AGUA USO INDUSTRIAL RED HIDROVEN
    "FAM-2BFC515D": "MEC456",   # A/C LIQUIDO DESINCRUSTANTE QUIMICO
    "FAM-9F8CC197": "ACA126",   # MATERIAL DE FIJACION / SANITARIOS
    "FAM-4EEF21F9": "HER008",   # BOMBONA DE OXIGENO INDUSTRIAL
    "FAM-A4C7539E": "ACA152",   # TORNILLO, ARANDELA Y RAMPLUG
    "FAM-D97847CD": "ELC036",   # MATERIALES VARIOS PARA INSTALACION
    "FAM-633C4CDE": "MT79",     # SOLVENTE UNIVERSAL
    "FAM-3C9FDDC7": "MAT1344",  # ESTOPA NACIONAL PESO= 12KG/ROLLO
    "FAM-D07354C8": "ASF007",   # ASFALTO SOLIDO
    "FAM-90B54703": "CEM041",   # CEMENTO GRIS PORTLAND SACO 42.5 KG
    "FAM-E96F7D07": "AGR018",   # ARENA LAVADA
    "FAM-7C69BC65": "ARC078",   # BLOQUE ARCILLA PLATABANDA 15X20X40
    "FAM-C005F7AF": "ELF406",   # TUERCA HEXAGONAL 1/2" BRONCE SILICIO
    "FAM-E181000F": "MT558",    # TIERRA NEGRA ABONADA / JARDINERIA
    "FAM-C2645CBB": "ENC006",   # MADERA A LA MEDIDA SAQUI-SAQUI
    "FAM-15781C45": "APA025",   # MANOMETRO RANGO 0-200 PSI
    "FAM-4295CE6B": "COM003",   # ACEITE PARA FORMALETA DE ENCOFRADOS
    "FAM-38241F3B": "MAT1665",  # LIMPIADOR REMOVEDOR PAVCO (ENV 760 GRMS.)
    "FAM-919C5E43": "MEC216",   # ASCENSOR 6 PERS. PAR/IMP MAX=1 M/S RECOR
}

# Fusión de micro-familias secundarias sin líder a familias matrices
MICRO_FAMILIES_MERGE: Dict[str, str] = {
    "FAM-DA8C6444": "FAM-B1D67CE6",  # Tuberías y Conexiones -> Plomería
    "FAM-0BA9A275": "FAM-18E7577F",  # Instalaciones Eléctricas -> Eléctricos
    "FAM-716D202B": "FAM-4EEF21F9",  # Sistemas de Fijación -> Herrería
    "FAM-A4024885": "FAM-1E916DC4",  # Aceros y Perfiles -> Acero
    "FAM-5E5C1EE5": "FAM-90B54703",  # Adhesivos y Selladores -> Cementos
    "FAM-9937D099": "FAM-E914CF58",  # Insumos Auxiliares -> Índice General
    "FAM-531E2975": "FAM-E96F7D07",  # Agregados -> Agregados
    "FAM-4681A5F4": "FAM-C2645CBB",  # Maderas -> Madera Encofrado
    "FAM-1AF66F52": "FAM-A4C7539E",  # Soportes y Cerrajería -> Carpintería y Cerrajería
    "FAM-31FDA4CF": "FAM-9F8CC197",  # Piezas Sanitarias -> Sanitarios
}


def is_anime_material(desc: str) -> bool:
    """Valida si la descripción corresponde a Anime o Poliestireno Expandido."""
    if not desc:
        return False
    d = desc.upper()
    if any(w in d for w in ["ANIME", "POLIESTIRENO", "BOVEDILLA DE ANIME", "BOVEDILLA ANIME", "AISLANTE ANIME", "ISOPOR"]):
        return True
    if "BOVEDILLA" in d and not any(x in d for x in ["ARCILLA", "CONCRETO", "CEMENTO"]):
        return True
    return False


def is_drywall_material(desc: str) -> bool:
    """Valida si la descripción corresponde a Yeso, Drywall o Cielos Rasos."""
    if not desc:
        return False
    d = desc.upper()
    if any(w in d for w in ["YESO", "DRYWALL", "DRY WALL", "TABLAYESO", "DURLOCK", "MASTIQUE", "PASTA PROFESIONAL"]):
        return True
    if "CIELO RASO" in d and "S/CIELO RASO" not in d:
        return True
    if "PERFIL" in d and any(p in d for p in ["OMEGA", "PARAL", "STUD", "TRACK"]):
        return True
    if "TORNILLO" in d and any(t in d for t in ["DRYWALL", "DRY WALL"]):
        return True
    if "CINTA" in d and any(c in d for c in ["DRYWALL", "DRY WALL", "MALLA", "PAPEL REFORZADA"]):
        return True
    return False


def classify_orphan_material(desc: str) -> str:
    """Clasifica un material según patrones léxicos del sector construcción."""
    if not desc:
        return "FAM-E914CF58"
    d = desc.upper()

    if is_anime_material(d):
        return "FAM-ANIME"
    if is_drywall_material(d):
        return "FAM-DRYWALL"

    if any(w in d for w in [
        "CABLE", "CONDUCTOR", "BREAKER", "INTERRUPTOR", "TOMACORRIENTE", "TABLERO",
        "TRANSFORMADOR", "LAMPARA", "BOMBILLO", "CANALIZACION", "CONDUIT", "CAJETIN",
        "ELECTRICO", "ELECTRICA", "LUMINARIA", "FOTOCELDA", "FLUORESCENTE", "BALASTRO",
        "VOLTIO", "FUSIBLE", "BORNERA", "ARVIDAL", "POSTE", "CRUCETA", "240V", "120V", "480V",
        "THHN", "THW", "TTU", "CONDULET", "TEIPE", "ALUMBRADO", "WIFI", "10KA", "ENCHUFABLE",
        "SUPERPUESTO", "CONTACTO", "CORRIENTE", "CIRCUITO", "LINEA AEREA", "AISLADOR",
        "PARARRAYOS", "ESTRIBOS DE CONEXION", "BRAZO AP"
    ]):
        return "FAM-18E7577F"

    if any(w in d for w in [
        "TUBO", "TUBERIA", "VALVULA", "CODO", " TEE", "TEE ", "REDUCCION", "ADAPTADOR", "NIPLE",
        "LLAVE", "GRIFO", "SIFON", "REGADERA", "FLOTADOR", "FLOTANTE", "DESAGUE", "DESAGÜE",
        "AGUA BLANCA", "AGUA NEGRA", "PVC", "CPVC", "COBRE", "GALVANIZADO", "PEAD", "UNISAFE",
        "TUBPVC", "ACUEDUCTO", "ALCANTAR", "CAMPANA", "ANILLO DE GOMA", "ANILLO HF", "ANILLO HG",
        "RETEN POLIPROPILENO", "PEGA PVC", "SOLDADURA PVC", "SUMIDERO", "FLANGE", "BRIDA",
        "DRENAJE", "UNION UNIVERSAL", "TAPON HG", "TAPON PVC", "CHECK"
    ]):
        return "FAM-B1D67CE6"

    if any(w in d for w in ["CONCRETO", "MORTERO", "PREMEZCLADO", "CONCJTA", "F'C=", "FC="]) or \
       ("CONC" in d and ("3000" in d or "2500" in d or "2000" in d or "KG/CM2" in d or "M3" in d)):
        return "FAM-FAE5C031"

    if any(w in d for w in ["CEMENTO", "CAL VIVA", "CAL HIDRATADA", "PEGO", "ADITIVO"]):
        return "FAM-90B54703"

    if any(w in d for w in ["ARENA", "PIEDRA", "GRAVA", "GRANZON", "AGREGADO"]):
        return "FAM-E96F7D07"

    if any(w in d for w in ["ARCILLA", "BLOQUE", "LADRILLO", "TEJA", "TABLILLA", "CAICO"]):
        return "FAM-7C69BC65"

    if any(w in d for w in [
        "PINTURA", "ESMALTE", "FONDO ANTICORROSIVO", "BARNIZ", "SOLVENTE", "THINNER",
        "TINNER", "AGUARRAS", "BROCHA", "RODILLO", "EPOXICA", "TRAFICO", "CAUCHO"
    ]):
        return "FAM-633C4CDE"

    if any(w in d for w in [
        "MADERA", "TABLA", "TABLON", "PUNTAL", "VIGUETA", "CONTRAENCHAPADO", "FORMICA",
        "TRIPLAY", "MDF", "PINO", "SAQUI", "ENCOFRADO"
    ]):
        return "FAM-C2645CBB"

    if any(w in d for w in ["CERAMICA", "PORCELANATO", "BALDOSA", "GRANITO", "RODAPIE", "AZULEJO", "PISO DE"]):
        return "FAM-3C9FDDC7"

    if any(w in d for w in ["POCETA", "INODORO", "LAVAMANOS", "URINARIO", "FREGADERO", "BAÑERA", "DUCHA", "BIDE"]):
        return "FAM-9F8CC197"

    if any(w in d for w in ["ASFALTO", "MANTO", "PRIMER ASFALTICO", "ALQUITRAN", "IMPERMEABILIZANTE", "RC-250"]):
        return "FAM-D07354C8"

    if any(w in d for w in ["VIDRIO", "CRISTAL", "ESPEJO"]):
        return "FAM-C005F7AF"

    if any(w in d for w in ["GRAMA", "CESPED", "PLANTA", "ABONO", "TIERRA NEGRA", "ARBOL", "PALMERA", "GEOMANTA"]):
        return "FAM-E181000F"

    if any(w in d for w in ["EXTINTOR", "DETECTOR", "SIRENA", "GABINETE CONTRA INCENDIO", "ROCIADOR", "SOVICA"]):
        return "FAM-D97847CD"

    if any(w in d for w in ["BOMBA", "HIDRONEUMATICO", "PRESOSTATO", "MANOMETRO", "PULMON"]):
        return "FAM-15781C45"

    if any(w in d for w in ["ACIDO", "CLORO", "SULFATO", "QUIMICO", "REACTIVO"]):
        return "FAM-38241F3B"

    if any(w in d for w in ["GASOLINA", "DIESEL", "GASOIL", "LUBRICANTE", "GRASA"]):
        return "FAM-4295CE6B"

    if any(w in d for w in [
        "ELECTRODO", "DISCO DE CORTE", "TORNILLO", "PERNO", "CLAVO", "RAMPLUG",
        "ARANDELA", "TUERCA", "ANCLAJE", "HERRERIA", "SOLDADURA", "CONCERTINA"
    ]):
        return "FAM-4EEF21F9"

    if any(w in d for w in ["CERRADURA", "CANDADO", "BISAGRA", "POMO", "PUERTA", "CORREDERA"]):
        return "FAM-A4C7539E"

    if any(w in d for w in [
        "CABILLA", "ACERO", "VIGA", "PERFIL", "TUBO ESTRUCTURAL", "ANGULO", "PLATINA",
        "MALLA", "ELECTROSOLDADA", "PLANCHA", "ALAMBRE"
    ]):
        return "FAM-1E916DC4"

    return "FAM-E914CF58"


def run_migration() -> None:
    """Ejecuta la migración de familias e insumos líderes con respaldo seguro."""
    logger.info("Iniciando migración integral de Familias e Insumos Líderes...")

    with get_db_session() as db:
        # 1. Respaldo de seguridad en PostgreSQL
        logger.info("Fase 0: Generando respaldo físico de tablas...")
        db.execute(text("CREATE TABLE IF NOT EXISTS cost360_materials_backup_20260917 AS SELECT * FROM cost360_materials;"))
        db.execute(text("CREATE TABLE IF NOT EXISTS cost360_material_families_backup_20260917 AS SELECT * FROM cost360_material_families;"))
        logger.info("Respaldo completado satisfactoriamente.")

        # 2. Inserción de nuevas familias
        logger.info("Fase 1: Creando familias FAM-DRYWALL y FAM-ANIME...")
        fam_drywall = db.query(CostMaterialFamily).filter(CostMaterialFamily.id == "FAM-DRYWALL").first()
        if not fam_drywall:
            fam_drywall = CostMaterialFamily(
                id="FAM-DRYWALL",
                name="Yeso, Drywall y Cielos Rasos",
                description="Láminas de yeso, mastiques, cintas y perfilería liviana para drywall y cielos rasos"
            )
            db.add(fam_drywall)

        fam_anime = db.query(CostMaterialFamily).filter(CostMaterialFamily.id == "FAM-ANIME").first()
        if not fam_anime:
            fam_anime = CostMaterialFamily(
                id="FAM-ANIME",
                name="Anime y Poliestireno Expandido (EPS)",
                description="Láminas de anime, bovedillas para losa nervada, conchas térmicas y poliestireno"
            )
            db.add(fam_anime)

        db.flush()
        logger.info("Familias FAM-DRYWALL y FAM-ANIME registradas.")

        # 3. Cargar todos los materiales
        logger.info("Fase 2: Analizando y reasignando materiales...")
        all_materials = db.query(CostMaterial).all()
        logger.info(f"Total materiales cargados: {len(all_materials)}")

        # Mapa de precios para cálculo de factores
        price_map: Dict[str, float] = {m.CodMat: (m.CosMat or 0.0) for m in all_materials}

        reassigned_drywall = 0
        reassigned_anime = 0
        merged_micro = 0
        classified_orphans = 0

        # Asignar familias
        for m in all_materials:
            desc = m.Descri or ""
            current_fam = m.family_id

            if is_anime_material(desc):
                m.family_id = "FAM-ANIME"
                reassigned_anime += 1
            elif is_drywall_material(desc):
                m.family_id = "FAM-DRYWALL"
                reassigned_drywall += 1
            elif current_fam in MICRO_FAMILIES_MERGE:
                m.family_id = MICRO_FAMILIES_MERGE[current_fam]
                merged_micro += 1
            elif current_fam in LEADERS_MAP:
                m.family_id = current_fam
            else:
                m.family_id = classify_orphan_material(desc)
                classified_orphans += 1

        logger.info(f"Reasignación completada: Drywall={reassigned_drywall}, Anime={reassigned_anime}, "
                    f"MicroFamilias={merged_micro}, HuérfanosClasificados={classified_orphans}")

        # 4. Asignar Insumos Líderes y calcular Factores de Dispersión
        logger.info("Fase 3: Vinculando líderes y calculando factores de mercado...")
        linked_count = 0
        for m in all_materials:
            leader_cod = LEADERS_MAP.get(m.family_id)
            if not leader_cod:
                raise ValueError(f"Familia {m.family_id} sin líder asignado en LEADERS_MAP")

            m.market_indicator_id = leader_cod
            leader_price = price_map.get(leader_cod, 0.0)
            mat_price = m.CosMat or 0.0

            if m.CodMat == leader_cod:
                m.market_factor = 1.0
            elif leader_price > 0 and mat_price > 0:
                m.market_factor = round(mat_price / leader_price, 6)
            else:
                m.market_factor = 0.0 if mat_price == 0.0 else 1.0

            linked_count += 1

        # 5. Limpieza de micro-familias obsoletas vacías de cost360_material_families
        logger.info("Fase 4: Limpiando micro-familias secundarias redundantes...")
        for micro_id in MICRO_FAMILIES_MERGE.keys():
            micro_obj = db.query(CostMaterialFamily).filter(CostMaterialFamily.id == micro_id).first()
            if micro_obj:
                db.delete(micro_obj)

        db.flush()
        logger.info("Cambios confirmados en la base de datos.")

    # Verificación post-transacción
    with get_db_session() as db:
        logger.info("Fase 5: Validando métricas de integridad...")
        total_mats = db.execute(text("SELECT count(*) FROM cost360_materials;")).scalar()
        unassigned_fam = db.execute(text("SELECT count(*) FROM cost360_materials WHERE family_id IS NULL OR family_id = '';")).scalar()
        unassigned_leader = db.execute(text("SELECT count(*) FROM cost360_materials WHERE market_indicator_id IS NULL OR market_indicator_id = '';")).scalar()

        logger.info(f"Total materiales en base de datos: {total_mats}")
        logger.info(f"Materiales sin familia (huérfanos): {unassigned_fam}")
        logger.info(f"Materiales sin líder asignado: {unassigned_leader}")

        if unassigned_fam > 0 or unassigned_leader > 0:
            raise ValueError(f"Validación fallida: {unassigned_fam} huérfanos, {unassigned_leader} sin líder.")

        # Desglose de familias activas
        families_summary = db.execute(text("""
            SELECT f.id, f.name, m.market_indicator_id, count(m."CodMat") as total_mats
            FROM cost360_material_families f
            JOIN cost360_materials m ON m.family_id = f.id
            GROUP BY f.id, f.name, m.market_indicator_id
            ORDER BY total_mats DESC;
        """)).fetchall()

        logger.info(f"Total familias activas en el sistema: {len(families_summary)}")
        for fs in families_summary:
            logger.info(f"  [{fs.id}] {fs.name} | Líder: {fs.market_indicator_id} | Total insumos: {fs.total_mats}")

    logger.info("¡Migración completada con 100% de cobertura exitosa!")


if __name__ == "__main__":
    run_migration()
