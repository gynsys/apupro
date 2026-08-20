# common/pdf/summary_builder.py
import re

def build_narrative_summary(report_data: dict, include_functional_exam: bool = True) -> dict:
    """
    Toma los datos crudos y devuelve un diccionario con los textos formateados,
    incluyendo un párrafo narrativo completo y coherente.
    """
    context = {}
    
    # --- Datos básicos que se usarán fuera del párrafo ---
    context['full_name'] = report_data.get('full_name', '').title()
    context['age'] = report_data.get('age', '')
    context['ci'] = report_data.get('ci', '')

    # --- Construcción del Párrafo Narrativo ---
    narrative_parts = []
    
    # 1. Motivo de consulta
    reason = report_data.get('reason_for_visit', '').lower()
    if reason:
        # Si es "control ginecológico" o similar, usar "a" en lugar de "por presentar"
        if 'control' in reason or 'consulta' in reason or 'revisión' in reason:
            narrative_parts.append(f"Paciente quien acude a consulta a {reason}.")
        else:
            narrative_parts.append(f"Paciente quien acude a consulta por presentar {reason}.")

    # 2. Hallazgos Funcionales
    findings_parts = []

    # Verificar si el examen funcional fue realizado (hay datos) Y está habilitado en la configuración
    has_functional_data = include_functional_exam and any(
        report_data.get(key) for key in [
            'functional_dispareunia', 'functional_leg_pain', 'functional_gastro_before',
            'functional_gastro_during', 'functional_dischezia', 'functional_bowel_freq',
            'functional_urinary_problem', 'functional_urinary_pain', 'functional_urinary_irritation',
            'functional_urinary_incontinence', 'functional_urinary_nocturia'
        ]
    )

    # Dismenorrea (siempre se incluye, es parte de antecedentes ginecológicos)
    dismenorrhea = report_data.get('gyn_dysmenorrhea', '')
    if not dismenorrhea or dismenorrhea.lower() == 'no':
        findings_parts.append("no presentar dismenorrea")
    else:
        eva_match = re.search(r'intensidad: (\d+)/10', dismenorrhea)
        score = int(eva_match.group(1)) if eva_match else 0
        intensity_desc = "severa" if score >= 7 else "moderada" if score >= 4 else "leve"
        findings_parts.append(f"dismenorrea {intensity_desc} ({score}/10)")

    # Solo incluir información del examen funcional si hay datos (fue habilitado)
    if has_functional_data:
        # Dispareunia
        dispareunia = report_data.get('functional_dispareunia', '')
        if not dispareunia or dispareunia.lower() == 'no':
            findings_parts.append("niega dispareunia")
        else:
            eva_match = re.search(r'\(Intensidad: (\d+)/10\)', dispareunia)
            if eva_match:
                score = int(eva_match.group(1).split('/')[0])
                intensity_desc = "de alta intensidad" if score >= 10 else "severa" if score >= 7 else "moderada" if score >= 4 else "leve"
                findings_parts.append(f"dispareunia {intensity_desc} ({score}/10)")
                
        # Disquecia
        dischezia = report_data.get('functional_dischezia', '')
        if not dischezia or dischezia.lower() == 'no':
            findings_parts.append("niega disquecia")
        elif 'eventual' in dischezia.lower():
            findings_parts.append("disquecia eventual")
        else:
            eva_match = re.search(r'\(Intensidad: (\d+)/10\)', dischezia)
            if eva_match:
                score = int(eva_match.group(1).split('/')[0])
                intensity_desc = "de máxima intensidad" if score >= 10 else "severa" if score >= 7 else "moderada" if score >= 4 else "leve"
                findings_parts.append(f"disquecia {intensity_desc} ({score}/10)")

    # Infertilidad
    infertility = report_data.get('gyn_fertility_intent', '')
    if infertility and "Con deseo" in infertility:
        findings_parts.append("con deseo de fertilidad no logrado")
    else:
        findings_parts.append("sin deseo de fertilidad")

    if findings_parts:
        if len(findings_parts) > 1:
            findings_str = ", ".join(findings_parts[:-1]) + " y " + findings_parts[-1]
        else:
            findings_str = findings_parts[0]
        narrative_parts.append(f"Al interrogatorio, manifiesta {findings_str}.")

    # 3. Hallazgos del Médico
    ultrasound = report_data.get('admin_ultrasound')
    if ultrasound:
        narrative_parts.append(f"El ultrasonido transvaginal reporta: {ultrasound}.")

    diagnosis = report_data.get('admin_diagnosis')
    if diagnosis:
        # Formatear diagnóstico numerado si es necesario
        diag_items = [d.strip() for d in diagnosis.strip().split('\n') if d.strip()]
        if len(diag_items) > 1 or (diag_items and re.match(r'^\d+\)', diag_items[0])):
             # Extraer la operación fuera del f-string (no se pueden usar backslashes en expresiones de f-strings)
             diagnosis_formatted = diagnosis.replace('\n', '<br/>')
             narrative_parts.append(f"Se establecen los siguientes diagnósticos:<br/>{diagnosis_formatted}")
        else:
            narrative_parts.append(f"Se establece el diagnóstico de {diagnosis}.")

    plan = report_data.get('admin_plan')
    '''if plan:
        # Formatear plan con viñetas si es necesario
        plan_items = [p.strip() for p in plan.strip().split('\n')]
        if len(plan_items) > 1 or plan_items[0].startswith('•'):
            # Extraer la operación fuera del f-string (no se pueden usar backslashes en expresiones de f-strings)
            plan_formatted = plan.replace('\n', '<br/>')
            narrative_parts.append(f"Se indica el siguiente plan:<br/>{plan_formatted}")
        else:
            narrative_parts.append(f"Se indica como plan: {plan}.")'''
    if plan:
        # Siempre introducimos el plan con un texto y un salto de línea.
        narrative_parts.append("Se indica como plan:")
    
        # Dividimos el plan en ítems detectando marcadores de inicio de item
        # (guiones -, viñetas •, o números seguidos de . o ))
        # Esto evita dividir incorrectamente cuando hay saltos de línea dentro de un mismo item
        pattern = r'^[-•]\s*|^\d+[.)]\s*'
        lines = plan.strip().split('\n')
        plan_items = []
        current_item = []
        has_markers = False  # Para saber si hay marcadores en el plan
        
        for line in lines:
            stripped = line.strip()
            
            # Si la línea está vacía, la ignoramos (son espacios de formato dentro del mismo item)
            if not stripped:
                continue
            
            # Si la línea empieza con un marcador de item nuevo
            if re.match(pattern, stripped):
                has_markers = True
                # Guardar el item anterior si existe
                if current_item:
                    plan_items.append(' '.join(current_item))
                # Iniciar nuevo item
                current_item = [stripped]
            else:
                # Continuar el item actual (es una continuación de la línea anterior)
                # Esto agrupa líneas consecutivas sin marcador como parte del mismo item
                if current_item:
                    current_item.append(stripped)
                else:
                    # Primer item sin marcador explícito
                    current_item = [stripped]
        
        # Guardar el último item
        if current_item:
            plan_items.append(' '.join(current_item))
        
        # Si no se detectaron marcadores, significa que el plan fue introducido item por item
        # (como cuando el doctor añade items uno por uno). En ese caso, cada línea es un item separado
        if not has_markers:
            # Dividir por saltos de línea, cada línea es un item
            plan_items = [line.strip() for line in plan.strip().split('\n') if line.strip()]
    
        # Construimos una lista numerada (1., 2., etc.) en lugar de viñetas
        # Esto es más confiable que las viñetas en ReportLab
        numbered_list_parts = []
        for i, item in enumerate(plan_items, 1):
            # Quitamos marcadores manuales si el usuario los puso (como '•', '-', o números)
            cleaned_item = re.sub(r'^[•*-]\s*|^\d+[.)]\s*', '', item)
            # Agregar número con punto y espacio
            numbered_list_parts.append(f"{i}.&nbsp;{cleaned_item}")
        
        # Unir los ítems con saltos de línea
        # Usamos <br/> para separar cada ítem y leftIndent se aplicará en el estilo
        plan_formatted_as_list = "<br/>".join(numbered_list_parts)
        
        # Añadimos la lista formateada a nuestras partes narrativas.
        narrative_parts.append(plan_formatted_as_list)

    # Unir las partes con espacios, pero manejar correctamente los <br/>
    narrative_text = " ".join(narrative_parts)
    
    # Reemplazar múltiples espacios seguidos por un solo espacio (excepto los <br/>)
    narrative_text = re.sub(r' +', ' ', narrative_text)
    # Asegurar que no haya espacios antes de <br/>
    narrative_text = re.sub(r' +<br/>', '<br/>', narrative_text)
    # Asegurar que no haya espacios después de <br/>
    narrative_text = re.sub(r'<br/> +', '<br/>', narrative_text)
    
    context['narrative_summary'] = narrative_text
    return context

