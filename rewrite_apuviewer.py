import re

with open(r'c:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\pages\APUViewer.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add ApuEditorUI import
content = content.replace(
    "import ExportApuExcelButton from '../components/ExportApuExcelButton';",
    "import ExportApuExcelButton from '../components/ExportApuExcelButton';\nimport ApuEditorUI from '../../../components/ApuEditorUI';"
)

# Add item and settings state
state_block = """  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [item, setItem] = useState(null);
  const [settings, setSettings] = useState({
    admin_percent: 15,
    profit_percent: 10,
    fcas_percent: 417,
    iva_percent: 16,
    labor_bonus: 0,
    currency: 'USD'
  });"""

content = re.sub(r'  const \[data, setData\] = useState\(null\);\n  const \[loading, setLoading\] = useState\(true\);\n  const \[error, setError\] = useState\(null\);', state_block, content)

# Update fetch to setItem
fetch_block = """        const apuData = await cost360Service.fetchApuDetails(id);
        setData(apuData);
        setItem({
          cod_par: apuData.partida.CodPar,
          description: apuData.partida.Descri,
          unit: apuData.partida.UniPar,
          performance: apuData.partida.RenPar || 1,
          materials: (apuData.materiales || []).map(m => ({ id: m.codigo, codigo: m.codigo, descripcion: m.descripcion, unidad: m.unidad, cantidad: m.cantidad, precio_unitario: m.precio_unitario, desperdicio: m.desperdicio || 5, origen: 'historico' })),
          equipments: (apuData.equipos || []).map(e => ({ id: e.codigo, codigo: e.codigo, descripcion: e.descripcion, unidad: 'día', cantidad: e.cantidad, precio_unitario: e.precio_unitario, depreciacion: e.depreciacion || 1.0, origen: 'historico' })),
          labors: (apuData.mano_obra || []).map(l => ({ id: l.codigo, codigo: l.codigo, descripcion: l.descripcion, unidad: 'día', cantidad: l.cantidad, jornal: l.jornal, bono: l.bono, origen: 'historico' }))
        });"""

content = re.sub(r'        const apuData = await cost360Service\.fetchApuDetails\(id\);\n        setData\(apuData\);', fetch_block, content)

# Add handlers
handlers_block = """  const handleComponentChange = (type, updatedList) => {
    setItem(prev => ({ ...prev, [type]: updatedList }));
  };

  const handleHeaderChange = (field, value) => {
    setItem(prev => ({ ...prev, [field]: value }));
  };

  const handleRemoveRow = (type, id) => {
    setItem(prev => ({ ...prev, [type]: prev[type].filter(i => i.id !== id) }));
  };

  const handleAddRow = (type) => {
    const newId = 'NEW-' + Math.random().toString(36).substr(2, 9);
    setItem(prev => ({
      ...prev,
      [type]: [...prev[type], { id: newId, codigo: 's/c', descripcion: 'Nuevo ítem', cantidad: 1, precio_unitario: 0, origen: 'manual' }]
    }));
  };

  if (loading) {"""

content = re.sub(r'  if \(loading\) \{', handlers_block, content)

# Update ExportApuExcelButton parameters
content = re.sub(r'<ExportApuExcelButton \n              item=\{partida\} \n              materials=\{materiales\} \n              equipments=\{equipos\} \n              labors=\{mano_obra\} \n              settings=\{settings\} \n            />',
                 '<ExportApuExcelButton\n              item={item}\n              settings={settings}\n            />', content, flags=re.MULTILINE)
                 
content = re.sub(r'<ExportApuExcelButton\s+item=\{partida\}\s+materials=\{materiales\}\s+equipments=\{equipos\}\s+labors=\{mano_obra\}\s+settings=\{settings\}\s+/>',
                 '<ExportApuExcelButton item={item} settings={settings} />', content)

# Now delete lines from {/* MAPREX STYLE TOP HEADER */} and replace with ApuEditorUI
editor_block = """
      {item && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <ApuEditorUI
            item={item}
            settings={settings}
            onHeaderChange={handleHeaderChange}
            onComponentChange={handleComponentChange}
            onRemoveRow={handleRemoveRow}
            onAddBlankRow={handleAddRow}
            onSettingsChange={(field, value) => setSettings({ ...settings, [field]: value })}
          />
        </div>
      )}
    </div>
  );
}
"""

content = re.sub(r'\s*\{\/\* MAPREX STYLE TOP HEADER \*\/}.*', editor_block, content, flags=re.DOTALL)

with open(r'c:\Users\pablo\Documents\apupro_platform\frontend\src\modules\cost360\pages\APUViewer.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
