# arko360_platform/backend/app/engine/design_engine.py
from app.design_codes.aci_318 import ACI318_19

def run_project_design(project_data, solver_results):
    """
    Toma los resultados del FEA y aplica el código ACI 318-19
    """
    code = ACI318_19()
    design_checks = {}

    for element in project_data.topology.elements:
        # Extraer fuerzas internas del solver para este elemento
        forces = solver_results['element_forces'][element.id]
        # Obtener sección y material
        section = next(s for s in project_data.topology.sections if s.id == element.section_id)
        material = next(m for m in project_data.topology.materials if m.id == element.material_id)
        
        if element.type == "frame":
            # 1. Chequeo de Flexión (Momento máximo en el tramo)
            mu = max(abs(forces['m_z_start']), abs(forces['m_z_end']))
            # Suponemos un refuerzo estimado para el MVP o lo tomamos de la DB
            as_est = section.params['h'] * section.params['b'] * 0.01 * 1e6 # 1% cuantía
            
            check_f = code.check_flexure_beam(
                mu, section.params['b'], section.params['h'], 
                section.params['h'] - 0.06, as_est, material.E / 1e6, 420
            )
            
            design_checks[element.id] = {
                "flexure": check_f,
                "max_utilization": check_f['utilization']
            }
            
    return design_checks