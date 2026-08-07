import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Calculator, DoorOpen, Maximize, Ruler, Download, Brush, Grid, DollarSign, Save, FolderOpen, LogIn, LogOut, ArrowLeft, User, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

const CalculadoraMamposteria = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ─── ESTADO ───
  const [pared, setPared] = useState({ largo: "4.0", alto: "2.5" });
  const [puertas, setPuertas] = useState({ incluir: false, cantidad: "1", ancho: "0.9", alto: "2.1" });
  const [ventanas, setVentanas] = useState({ incluir: false, cantidad: "1", ancho: "1.2", alto: "1.2", alturaSuelo: "1.0" });
  const [desperdicio, setDesperdicio] = useState("10"); // %

  const [tipoBloque, setTipoBloque] = useState('arcilla'); // 'arcilla' o 'cemento'
  const [grosorBloque, setGrosorBloque] = useState(15); // cm
  const [friso, setFriso] = useState('1_cara'); // 'ninguna', '1_cara', '2_caras'
  const [acabado, setAcabado] = useState('rustico'); // 'rustico', 'liso'

  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [viewCurrency, setViewCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState("653.00");

  const [costos, setCostos] = useState({
    bloque_arcilla_10: "0.60",
    bloque_arcilla_12: "0.64",
    bloque_arcilla_15: "0.65",
    bloque_cemento_10: "0.60",
    bloque_cemento_15: "0.65",
    bloque_cemento_20: "0.70",
    cemento: "13.46",
    arena: "45.24",
    polvillo: "53.36",
    pego: "12.00",
    lija: "1.50",
    pasta: "17.48", // Galón
    pintura: "17.40", // Galón
    manoObra: "10.00" // por m2
  });

  const reportRef = useRef(null);

  // ─── AUTH & DB STATE ───
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [misCalculos, setMisCalculos] = useState([]);
  const [showMisCalculos, setShowMisCalculos] = useState(false);
  const [isLoadingCalculos, setIsLoadingCalculos] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('arko_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setCurrentUser({ name: "Usuario" }); 
    }
  }, []);

  // Efecto para ajustar grosores según el tipo de bloque
  useEffect(() => {
    if (tipoBloque === 'arcilla' && grosorBloque === 20) {
      setGrosorBloque(15);
    }
    if (tipoBloque === 'cemento' && grosorBloque === 12) {
      setGrosorBloque(15);
    }
  }, [tipoBloque, grosorBloque]);

  // ─── HANDLERS ───
  const parseInputValue = (value) => {
    let sanitized = String(value).replace(',', '.');
    if (/^\d*\.?\d*$/.test(sanitized)) {
      return sanitized;
    }
    return null;
  };

  const handlePared = (e) => {
    const val = parseInputValue(e.target.value);
    if (val !== null) setPared(p => ({ ...p, [e.target.name]: val }));
  };

  const handlePuertas = (e) => {
    const { name, type, checked } = e.target;
    if (type === 'checkbox') {
      setPuertas(p => ({ ...p, [name]: checked }));
    } else {
      const val = parseInputValue(e.target.value);
      if (val !== null) setPuertas(p => ({ ...p, [name]: val }));
    }
  };

  const handleVentanas = (e) => {
    const { name, type, checked } = e.target;
    if (type === 'checkbox') {
      setVentanas(v => ({ ...v, [name]: checked }));
    } else {
      const val = parseInputValue(e.target.value);
      if (val !== null) setVentanas(v => ({ ...v, [name]: val }));
    }
  };

  const handleCosto = (e) => {
    const val = parseInputValue(e.target.value);
    if (val !== null) setCostos(c => ({ ...c, [e.target.name]: val }));
  };

  const handleBaseCurrencyChange = (e) => {
    const newBase = e.target.value;
    if (newBase !== baseCurrency) {
      const newCostos = {};
      for (const key in costos) {
        if (newBase === 'VES' && baseCurrency === 'USD') {
          newCostos[key] = parseFloat((costos[key] * exchangeRate).toFixed(2));
        } else if (newBase === 'USD' && baseCurrency === 'VES') {
          newCostos[key] = parseFloat((costos[key] / exchangeRate).toFixed(2));
        } else {
          newCostos[key] = costos[key];
        }
      }
      setCostos(newCostos);
      setBaseCurrency(newBase);
      setViewCurrency(newBase);
    }
  };

  const getF = (val) => parseFloat(String(val).replace(',', '.')) || 0;

  const resultados = useMemo(() => {
    const largo = getF(pared.largo);
    const alto = getF(pared.alto);
    const desp = getF(desperdicio);
    const areaTotal = largo * alto;
    const areaPuertas = puertas.incluir ? getF(puertas.cantidad) * getF(puertas.ancho) * getF(puertas.alto) : 0;
    const areaVentanas = ventanas.incluir ? getF(ventanas.cantidad) * getF(ventanas.ancho) * getF(ventanas.alto) : 0;
    const areaNeta = Math.max(0, areaTotal - areaPuertas - areaVentanas);

    const factorDesperdicio = 1 + (desp / 100);
    const anchoB = tipoBloque === 'arcilla' ? 0.30 : 0.40;
    const altoB = tipoBloque === 'arcilla' ? 0.25 : 0.20;
    const bloques = Math.ceil((areaNeta / (anchoB * altoB)) * factorDesperdicio);

    const vol_mortero_pegue = ((1 / anchoB) + (1 / altoB)) * 0.015 * (grosorBloque / 100) * areaNeta;
    const areaFriso = friso === '1_cara' ? areaNeta : (friso === '2_caras' ? areaNeta * 2 : 0);
    const vol_mortero_friso = areaFriso * 0.012;
    const vol_mortero_total = (vol_mortero_pegue + vol_mortero_friso) * factorDesperdicio;

    let sacosCemento = Math.ceil(vol_mortero_total * 7.5) || 0;
    const m3Arena = parseFloat((vol_mortero_total * 0.525).toFixed(2));
    const m3Polvillo = parseFloat((vol_mortero_total * 0.525).toFixed(2));
    
    let galonesPasta = 0, galonesPintura = 0, sacosPego = 0, hojasLija = 0;
    if (friso !== 'ninguna' && acabado === 'liso') {
      galonesPasta = Math.ceil((areaFriso / 4) * factorDesperdicio);
      galonesPintura = Math.ceil((areaFriso / 15) * factorDesperdicio);
      sacosPego = Math.ceil((areaFriso / 5) * factorDesperdicio);
      sacosCemento += Math.ceil((areaFriso / 10) * factorDesperdicio);
      hojasLija = Math.ceil((areaFriso / 5) * factorDesperdicio);
    }

    const convertPrice = (price) => {
      if (baseCurrency === viewCurrency) return price;
      return baseCurrency === 'USD' ? price * exchangeRate : price / exchangeRate;
    };

    const pBloque = convertPrice(getF(costos[`bloque_${tipoBloque}_${grosorBloque}`]));
    const pCemento = convertPrice(getF(costos.cemento));
    const pArena = convertPrice(getF(costos.arena));
    const pPolvillo = convertPrice(getF(costos.polvillo));
    const pPego = convertPrice(getF(costos.pego));
    const pLija = convertPrice(getF(costos.lija));
    const pPasta = convertPrice(getF(costos.pasta));
    const pPintura = convertPrice(getF(costos.pintura));
    const pManoObra = convertPrice(getF(costos.manoObra));

    const totalMateriales = (bloques * pBloque) + (sacosCemento * pCemento) + (m3Arena * pArena) + (m3Polvillo * pPolvillo) + (sacosPego * pPego) + (hojasLija * pLija) + (galonesPasta * pPasta) + (galonesPintura * pPintura);
    const totalManoObra = areaNeta * pManoObra;

    const materialesArray = [
      { nombre: `Bloque ${tipoBloque} (${grosorBloque}cm)`, cantidad: bloques, unidad: 'und', precio: pBloque, total: bloques * pBloque },
      { nombre: 'Cemento Portland', cantidad: sacosCemento, unidad: 'sacos', precio: pCemento, total: sacosCemento * pCemento },
      { nombre: 'Arena Lavada', cantidad: m3Arena, unidad: 'm³', precio: pArena, total: m3Arena * pArena },
      { nombre: 'Polvillo', cantidad: m3Polvillo, unidad: 'm³', precio: pPolvillo, total: m3Polvillo * pPolvillo },
    ];
    if (friso !== 'ninguna' && acabado === 'liso') {
      materialesArray.push(
        { nombre: 'Pego', cantidad: sacosPego, unidad: 'sacos', precio: pPego, total: sacosPego * pPego },
        { nombre: 'Lija', cantidad: hojasLija, unidad: 'hojas', precio: pLija, total: hojasLija * pLija },
        { nombre: 'Pasta Profesional', cantidad: galonesPasta, unidad: 'galones', precio: pPasta, total: galonesPasta * pPasta },
        { nombre: 'Pintura', cantidad: galonesPintura, unidad: 'galones', precio: pPintura, total: galonesPintura * pPintura }
      );
    }

    return { areaTotal: areaTotal.toFixed(2), areaNeta: areaNeta.toFixed(2), areaFriso: areaFriso.toFixed(2), materiales: materialesArray, totalMateriales, totalManoObra, totalProyecto: totalMateriales + totalManoObra };
  }, [pared, puertas, ventanas, desperdicio, tipoBloque, grosorBloque, friso, acabado, costos, baseCurrency, viewCurrency, exchangeRate]);

  const fetchMisCalculos = async () => {
    if (!currentUser) { setAuthModalOpen(true); return; }
    setIsLoadingCalculos(true);
    try {
      const { data } = await axios.get(`${API_BASE}/arko_app/calculadoras/mamposteria`);
      setMisCalculos(data);
      setShowMisCalculos(true);
    } catch (e) { toast.error('Error al cargar'); } finally { setIsLoadingCalculos(false); }
  };

  const handleSaveCalculo = async () => {
    if (!saveName.trim()) { toast.error("Ingresa nombre"); return; }
    try {
      await axios.post(`${API_BASE}/arko_app/calculadoras/mamposteria`, { nombre_proyecto: saveName, inputs: { pared, puertas, ventanas, desperdicio, tipoBloque, grosorBloque, friso, acabado, costos, baseCurrency, viewCurrency, exchangeRate }, resultados });
      toast.success("Guardado");
      setShowSaveModal(false);
    } catch (e) { toast.error('Error al guardar'); }
  };

  const handleDeleteCalculo = (id) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontWeight: 600 }}>¿Eliminar cálculo?</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await axios.delete(`${API_BASE}/arko_app/calculadoras/mamposteria/${id}`);
                setMisCalculos(prev => prev.filter(calc => calc.id !== id));
                toast.success('Eliminado con éxito');
              } catch (e) {
                toast.error('Error al eliminar');
              }
            }} 
            style={{ padding: '6px 12px', background: '#d32f2f', color: '#fff', borderRadius: '4px', border: 'none', cursor: 'pointer', flex: 1 }}
          >
            Sí, eliminar
          </button>
          <button 
            onClick={() => toast.dismiss(t.id)} 
            style={{ padding: '6px 12px', background: '#e0e0e0', borderRadius: '4px', border: 'none', cursor: 'pointer', flex: 1 }}
          >
            Cancelar
          </button>
        </div>
      </div>
    ), { duration: 5000 });
  };

  const logout = () => { localStorage.removeItem('arko_token'); setCurrentUser(null); };

  const formatMoney = (amount) => {
    const symbol = viewCurrency === 'VES' ? 'Bs.' : '$';
    return `${symbol} ${Number(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ─── EXPORTACIONES ───
  const exportarPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Cotización Mampostería</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 10px; }
            h2 { color: #2e7d32; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background: #e8f5e9; }
            .total { font-weight: bold; font-size: 18px; color: #d32f2f; text-align: right; margin-top: 20px; }
            .info { background: #f5f7fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Cotización – Pared de Mampostería</h1>
          <div class="info">
            <strong>Dimensiones:</strong> ${pared.largo}m × ${pared.alto}m (${resultados.areaTotal} m²)<br/>
            <strong>Área Neta:</strong> ${resultados.areaNeta} m²<br/>
            <strong>Bloque:</strong> ${tipoBloque === 'arcilla' ? 'Arcilla' : 'Cemento'} de ${grosorBloque}cm<br/>
            <strong>Friso:</strong> ${friso === 'ninguna' ? 'Sin Friso' : (friso === '1_cara' ? '1 Cara' : '2 Caras')} (${resultados.areaFriso} m²)<br/>
            ${friso !== 'ninguna' ? `<strong>Acabado:</strong> ${acabado === 'liso' ? 'Liso (Empastado y Pintura)' : 'Rústico'}<br/>` : ''}
            <strong>Desperdicio:</strong> ${desperdicio}%<br/>
          </div>
          <h2>Lista de Materiales y Costos</h2>
          <table>
            <tr><th>Material</th><th>Cantidad</th><th>Unidad</th><th>Precio Unit.</th><th>Subtotal</th></tr>
            ${resultados.materiales.map(m => `
              <tr>
                <td>${m.nombre}</td>
                <td>${m.cantidad}</td>
                <td>${m.unidad}</td>
                <td>${formatMoney(m.precio)}</td>
                <td>${formatMoney(m.total)}</td>
              </tr>
            `).join('')}
          </table>
          <div class="total">TOTAL ESTIMADO MATERIALES: ${formatMoney(resultados.totalMateriales)}</div>
          <div class="total" style="color: #555; font-size: 16px; margin-top: 10px;">TOTAL MANO DE OBRA (${resultados.areaNeta} m² × ${formatMoney(costos.manoObra)}): ${formatMoney(resultados.totalManoObra)}</div>
          <div class="total" style="font-size: 22px; margin-top: 15px; color: #1b5e20;">TOTAL GENERAL: ${formatMoney(resultados.totalProyecto)}</div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 250);
  };

  const exportarExcel = () => {
    let html = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"></head>
        <body>
          <table>
            <tr><th colspan="5" style="font-size: 20px; font-weight: bold;">Presupuesto Estimado - Mampostería</th></tr>
            <tr><th colspan="5">Área Neta: ${resultados.areaNeta} m² | Friso: ${resultados.areaFriso} m²</th></tr>
            <tr><th colspan="5">Tasa de Cambio (Bs/$): ${exchangeRate} | Moneda Mostrada: ${viewCurrency === 'VES' ? 'Bs' : '$'}</th></tr>
            <tr><th>Material</th><th>Cantidad</th><th>Unidad</th><th>Precio Unitario</th><th>Subtotal</th></tr>
            ${resultados.materiales.map(m => `
              <tr>
                <td>${m.nombre}</td>
                <td>${m.cantidad}</td>
                <td>${m.unidad}</td>
                <td>${m.precio}</td>
                <td>${m.total}</td>
              </tr>
            `).join('')}
            <tr><td colspan="4" style="text-align: right; font-weight: bold;">TOTAL MATERIALES:</td><td style="font-weight: bold;">${resultados.totalMateriales}</td></tr>
            <tr><td colspan="4" style="text-align: right; font-weight: bold;">TOTAL MANO DE OBRA:</td><td style="font-weight: bold;">${resultados.totalManoObra}</td></tr>
            <tr><td colspan="4" style="text-align: right; font-weight: bold; font-size: 16px;">TOTAL GENERAL:</td><td style="font-weight: bold; font-size: 16px;">${resultados.totalProyecto}</td></tr>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Presupuesto_Mamposteria_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const largoF = getF(pared.largo);
  const altoF = getF(pared.alto);
  const paddingSVG = 80;
  
  // Aumentar la escala 30% como pidió el usuario (1.3)
  const baseScaleX = 800 / (largoF || 1);
  const baseScaleY = 320 / (altoF || 1);
  const scale = Math.min(baseScaleX, baseScaleY) * 1.3;
  
  const rectW = largoF * scale;
  const rectH = altoF * scale;
  
  // Ajustar el contenedor SVG para envolver el gráfico aumentado
  const svgWidth = rectW + paddingSVG * 2;
  const svgHeight = rectH + paddingSVG * 2;
  
  const originX = paddingSVG;
  const topY = paddingSVG;
  const originY = paddingSVG + rectH;

  const posicionesAberturas = [];
  if (puertas.incluir && getF(puertas.cantidad) > 0) {
    let currentX = 0.5;
    for (let i = 0; i < getF(puertas.cantidad); i++) {
      posicionesAberturas.push({ tipo: 'puerta', ancho: getF(puertas.ancho), alto: getF(puertas.alto), x: currentX, y: 0 });
      currentX += getF(puertas.ancho) + 0.5;
    }
  }
  if (ventanas.incluir && getF(ventanas.cantidad) > 0) {
    let currentX = 0.5;
    if (puertas.incluir) currentX += (getF(puertas.ancho) + 0.5) * getF(puertas.cantidad);
    for (let i = 0; i < getF(ventanas.cantidad); i++) {
      posicionesAberturas.push({ tipo: 'ventana', ancho: getF(ventanas.ancho), alto: getF(ventanas.alto), x: currentX, y: getF(ventanas.alturaSuelo) || 1.0 });
      currentX += getF(ventanas.ancho) + 0.5;
    }
  }

  const cabenHorizontal = posicionesAberturas.reduce((sum, ab) => sum + ab.ancho + 0.5, 0) <= largoF;
  const ventanasValidas = !ventanas.incluir || ((getF(ventanas.alturaSuelo) || 1.0) + getF(ventanas.alto) <= altoF);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <Link to="/tools" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={20} /> Volver a Herramientas
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px 0', color: '#1a237e', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Grid size={28} /> Calculadora de Mampostería
          </h2>
          <p style={{ color: '#555', margin: 0 }}>Cálculo de bloques, mezcla para pegar y friso.</p>
        </div>
        {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text)', fontWeight: 600, padding: '0 8px' }}>
                <User size={18} /> {currentUser.name || 'Usuario'}
              </div>
              <button onClick={logout} style={{ background: '#f8d7da', color: '#721c24', border: 'none', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                <LogOut size={18} /> Salir
              </button>
            </div>
          )}
      </div>

      {/* Selectores de Moneda */}
      <div style={{ backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label style={{ fontSize: '12px', color: '#555', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tasa BCV (Bs/$):</label>
          <input type="text" value={exchangeRate} onChange={(e) => setExchangeRate(parseInputValue(e.target.value) || e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px' }} />
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label style={{ fontSize: '12px', color: '#555', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ingresar precios en:</label>
          <select value={baseCurrency} onChange={handleBaseCurrencyChange} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px' }}>
            <option value="USD">Dólares ($)</option>
            <option value="VES">Bolívares (Bs)</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label style={{ fontSize: '12px', color: '#555', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ver total en:</label>
          <select value={viewCurrency} onChange={(e) => setViewCurrency(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px' }}>
            <option value="USD">Dólares ($)</option>
            <option value="VES">Bolívares (Bs)</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Configuración de la Pared */}
          <Card title={<div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Ruler size={18} /> Dimensiones de la Pared</div>} color="#1a237e">
            <InputRow label="Largo (m)" name="largo" value={pared.largo} onChange={handlePared} step={0.1} />
            <InputRow label="Alto (m)" name="alto" value={pared.alto} onChange={handlePared} step={0.1} />
          </Card>

          {/* Configuración de Bloque y Acabado */}
          <Card title={<div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Grid size={18} /> Bloque y Acabado</div>} color="#1a237e">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#444' }}>Tipo de Bloque</label>
                <select value={tipoBloque} onChange={(e) => setTipoBloque(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <option value="arcilla">Arcilla (30x25cm)</option>
                  <option value="cemento">Cemento (40x20cm)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#444' }}>Grosor</label>
                <select value={grosorBloque} onChange={(e) => setGrosorBloque(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <option value={10}>10 cm</option>
                  {tipoBloque === 'arcilla' && <option value={12}>12 cm</option>}
                  <option value={15}>15 cm</option>
                  {tipoBloque === 'cemento' && <option value={20}>20 cm</option>}
                </select>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#444' }}>Friso</label>
                <select value={friso} onChange={(e) => setFriso(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <option value="ninguna">Sin Friso</option>
                  <option value="1_cara">1 Cara</option>
                  <option value="2_caras">2 Caras</option>
                </select>
              </div>
              {friso !== 'ninguna' && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', marginBottom: '6px', color: '#444' }}>Acabado</label>
                  <select value={acabado} onChange={(e) => setAcabado(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                    <option value="rustico">Rústico</option>
                    <option value="liso">Liso (Pintado)</option>
                  </select>
                </div>
              )}
            </div>
          </Card>

          {/* Puertas */}
          <Card title={<div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><DoorOpen size={18} /> Puertas</div>} color="#1a237e">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" id="incPuertas" name="incluir" checked={puertas.incluir} onChange={handlePuertas} style={{ width: '18px', height: '18px' }} />
              <label htmlFor="incPuertas" style={{ fontWeight: 500 }}>Incluir Puertas</label>
            </div>
            {puertas.incluir && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <InputRow label="Cant" name="cantidad" value={puertas.cantidad} onChange={handlePuertas} step={1} />
                <InputRow label="Ancho (m)" name="ancho" value={puertas.ancho} onChange={handlePuertas} step={0.1} />
                <InputRow label="Alto (m)" name="alto" value={puertas.alto} onChange={handlePuertas} step={0.1} />
              </div>
            )}
          </Card>

          {/* Ventanas */}
          <Card title={<div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Maximize size={18} /> Ventanas</div>} color="#1a237e">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" id="incVentanas" name="incluir" checked={ventanas.incluir} onChange={handleVentanas} style={{ width: '18px', height: '18px' }} />
              <label htmlFor="incVentanas" style={{ fontWeight: 500 }}>Incluir Ventanas</label>
            </div>
            {ventanas.incluir && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <InputRow label="Cant" name="cantidad" value={ventanas.cantidad} onChange={handleVentanas} step={1} />
                <InputRow label="Ancho (m)" name="ancho" value={ventanas.ancho} onChange={handleVentanas} step={0.1} />
                <InputRow label="Alto (m)" name="alto" value={ventanas.alto} onChange={handleVentanas} step={0.1} />
                <InputRow label="Al Suelo (m)" name="alturaSuelo" value={ventanas.alturaSuelo} onChange={handleVentanas} step={0.1} />
              </div>
            )}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Visualización */}
          <Card title={<div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Brush size={18} /> Plano de la Pared</div>} color="#1a237e">
            {!cabenHorizontal && (
              <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                ⚠️ Las aberturas no caben horizontalmente.
              </div>
            )}
            {!ventanasValidas && (
              <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                ⚠️ La ventana sale de la pared verticalmente.
              </div>
            )}
            
            <div style={{ width: '100%', height: '320px', backgroundColor: '#f0f0f0', borderRadius: '8px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ border: '1px solid #ccc', backgroundColor: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                {/* Fondo pared */}
                <rect x={originX} y={topY} width={rectW} height={rectH} fill="#ffcc80" opacity="0.6" stroke="#ef6c00" strokeWidth="2" />
                
                {/* Aberturas */}
                {posicionesAberturas.map((ab, i) => {
                  const isPuerta = ab.tipo === 'puerta';
                  const xSVG = originX + ab.x * scale;
                  const wSVG = ab.ancho * scale;
                  const hSVG = ab.alto * scale;
                  const ySVG = isPuerta ? originY - hSVG : originY - (ab.y + ab.alto) * scale;
                  const strokeColor = isPuerta ? '#d32f2f' : '#1976d2';
                  return (
                    <g key={i}>
                      <rect x={xSVG} y={ySVG} width={wSVG} height={hSVG} fill="#fff" stroke={strokeColor} strokeWidth="2" />
                      <text x={xSVG + wSVG / 2} y={ySVG + hSVG / 2} textAnchor="middle" alignmentBaseline="middle" fontSize="22" fill={strokeColor} fontWeight="bold">
                        {ab.ancho} x {ab.alto}
                      </text>
                    </g>
                  );
                })}

                {/* Cotas */}
                <line x1={originX} y1={topY - 20} x2={originX + rectW} y2={topY - 20} stroke="#333" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                <text x={originX + rectW / 2} y={topY - 30} textAnchor="middle" fontSize="28" fill="#333" fontWeight="bold">{pared.largo} m</text>
                <line x1={originX - 20} y1={topY} x2={originX - 20} y2={originY} stroke="#333" strokeWidth="2" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                <text x={originX - 45} y={topY + rectH / 2 + 8} textAnchor="middle" fontSize="28" fill="#333" fontWeight="bold">{pared.alto} m</text>

                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse">
                    <polygon points="0,0 8,4 0,8" fill="#333" />
                  </marker>
                </defs>
              </svg>
            </div>
            
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', backgroundColor: '#e3f2fd', padding: '12px', borderRadius: '8px' }}>
              <div><strong>Área Total:</strong> {resultados.areaTotal} m²</div>
              <div style={{ color: '#1565c0' }}><strong>Área Neta:</strong> {resultados.areaNeta} m²</div>
            </div>
          </Card>

          {/* Precios Unitarios */}
          <Card title={<div style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Calculator size={18} /> Precios Unitarios (Editables)</div>} color="#1a237e">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <CostInput label={`Bloque ${tipoBloque === 'arcilla' ? 'Arcilla' : 'Cemento'} (${grosorBloque}cm)`} name={`bloque_${tipoBloque}_${grosorBloque}`} value={costos[`bloque_${tipoBloque}_${grosorBloque}`] || 0} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              <CostInput label="Cemento (Saco)" name="cemento" value={costos.cemento} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              <CostInput label="Arena Lavada (m³)" name="arena" value={costos.arena} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              <CostInput label="Polvillo (m³)" name="polvillo" value={costos.polvillo} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              {friso !== 'ninguna' && acabado === 'liso' && (
                <>
                  <CostInput label="Pego (Saco)" name="pego" value={costos.pego} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
                  <CostInput label="Lija (Hoja)" name="lija" value={costos.lija} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
                  <CostInput label="Pasta Prof. (Galón)" name="pasta" value={costos.pasta} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
                  <CostInput label="Pintura Caucho (Galón)" name="pintura" value={costos.pintura} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
                </>
              )}
            </div>
            <div style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
              <CostInput label="Costo Mano de Obra (por m²)" name="manoObra" value={costos.manoObra} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>% Desperdicio:</label>
              <input type="text" value={desperdicio} onChange={(e) => setDesperdicio(parseInputValue(e.target.value) || e.target.value)} style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }} />
            </div>
          </Card>
        </div>
      </div>

      {/* Resultados Resumen */}
      <div style={{ marginTop: '32px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#1a237e', color: '#fff', padding: '16px 24px', fontSize: '18px', fontWeight: 'bold' }}>
          Presupuesto Estimado
        </div>
        <div style={{ padding: '24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '12px 8px', textAlign: 'left', color: '#555' }}>Material</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#555' }}>Cantidad</th>
                <th style={{ padding: '12px 8px', textAlign: 'right', color: '#555' }}>Precio Unit.</th>
                <th style={{ padding: '12px 8px', textAlign: 'right', color: '#555' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {resultados.materiales.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{m.nombre}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                    <span style={{ backgroundColor: '#e3f2fd', color: '#1565c0', padding: '4px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 }}>
                      {m.cantidad} {m.unidad}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: '#666' }}>{formatMoney(m.precio)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600, color: '#2e7d32' }}>{formatMoney(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '16px 20px', backgroundColor: '#e8f5e9', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', color: '#2e7d32', fontWeight: 600 }}>SUBTOTAL MATERIALES</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#1b5e20' }}>{formatMoney(resultados.totalMateriales)}</span>
            </div>
            
            <div style={{ padding: '16px 20px', backgroundColor: '#e3f2fd', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '15px', color: '#1565c0', fontWeight: 600 }}>MANO DE OBRA</span>
                <span style={{ fontSize: '12px', color: '#1976d2' }}>({resultados.areaNeta} m² × {formatMoney(resultados.precioManoObra)}/m²)</span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#0d47a1' }}>{formatMoney(resultados.totalManoObra)}</span>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px', border: '2px solid #ffb74d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', color: '#e65100', fontWeight: 800 }}>TOTAL ESTIMADO</span>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#e65100' }}>{formatMoney(resultados.totalProyecto)}</span>
            </div>
            
            {/* Botones de Exportación Inferiores */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={fetchMisCalculos} style={{ background: 'var(--bg-alt)', color: 'var(--text)', border: '1px solid var(--border)', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
                <FolderOpen size={20} /> Mis Cálculos
              </button>
              {currentUser ? (
                <button onClick={() => setShowSaveModal(true)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
                  <Save size={20} /> Guardar Proyecto
                </button>
              ) : (
                <button onClick={() => setAuthModalOpen(true)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
                  <LogIn size={20} /> Iniciar Sesión para Guardar
                </button>
              )}
              <button onClick={exportarPDF} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
                <Download size={20} /> Exportar Reporte PDF
              </button>
              <button onClick={exportarExcel} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '15px' }}>
                <Download size={20} /> Exportar Presupuesto Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      {authModalOpen && (
        <AuthModal 
          source="calculadora"
          onClose={() => setAuthModalOpen(false)} 
          onLoginSuccess={(u) => { setAuthModalOpen(false); setCurrentUser(u || { id: 1, name: 'Usuario' }); }} 
        />
      )}{showSaveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Guardar Proyecto</h3>
            <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Nombre del proyecto..." style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '16px' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowSaveModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#e0e0e0', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveCalculo} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showMisCalculos && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Mis Cálculos Guardados</h3>
              <button onClick={() => setShowMisCalculos(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            {isLoadingCalculos ? (
              <p>Cargando...</p>
            ) : misCalculos.length === 0 ? (
              <p>No tienes cálculos guardados.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {misCalculos.map(calc => (
                  <div key={calc.id} style={{ padding: '12px', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{calc.nombre_proyecto}</strong>
                      <div style={{ fontSize: '12px', color: '#666' }}>{new Date(calc.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => {
                        // Load logic
                        if (calc.inputs) {
                          if (calc.inputs.pared) setPared(calc.inputs.pared);
                          if (calc.inputs.puertas) setPuertas(calc.inputs.puertas);
                          if (calc.inputs.ventanas) setVentanas(calc.inputs.ventanas);
                          if (calc.inputs.desperdicio) setDesperdicio(calc.inputs.desperdicio);
                          if (calc.inputs.tipoBloque) setTipoBloque(calc.inputs.tipoBloque);
                          if (calc.inputs.grosorBloque) setGrosorBloque(calc.inputs.grosorBloque);
                          if (calc.inputs.friso) setFriso(calc.inputs.friso);
                          if (calc.inputs.acabado) setAcabado(calc.inputs.acabado);
                          if (calc.inputs.costos) setCostos(calc.inputs.costos);
                          if (calc.inputs.baseCurrency) setBaseCurrency(calc.inputs.baseCurrency);
                          if (calc.inputs.viewCurrency) setViewCurrency(calc.inputs.viewCurrency);
                          if (calc.inputs.exchangeRate) setExchangeRate(calc.inputs.exchangeRate);
                        }
                        setShowMisCalculos(false);
                        toast.success("Cálculo cargado");
                      }} style={{ padding: '6px 12px', borderRadius: '6px', background: '#e3f2fd', color: '#1565c0', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Cargar</button>
                      <button 
                        onClick={() => handleDeleteCalculo(calc.id)} 
                        style={{ padding: '6px', borderRadius: '6px', background: '#ffebee', color: '#d32f2f', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Eliminar cálculo"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── COMPONENTES AUXILIARES ───
const AuthModal = () => null;

const Card = ({ title, color, children }) => (
  <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
    <div style={{ backgroundColor: color, color: '#fff', padding: '12px 16px', fontWeight: 'bold', fontSize: '15px' }}>
      {title}
    </div>
    <div style={{ padding: '20px' }}>
      {children}
    </div>
  </div>
);

const InputRow = ({ label, name, value, onChange }) => (
  <div>
    <label style={{ display: 'block', fontSize: '13px', color: '#555', marginBottom: '4px', fontWeight: 500 }}>{label}</label>
    <input type="text" name={name} value={value} onChange={onChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }} />
  </div>
);

const CostInput = ({ label, name, value, onChange, symbol }) => (
  <div>
    <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '4px', fontWeight: 600 }}>{label}</label>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f5f7fa', padding: '8px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
      <span style={{ color: '#888', fontSize: '13px', fontWeight: 'bold' }}>{symbol}</span>
      <input type="text" name={name} value={value} onChange={onChange} style={{ width: '100%', border: 'none', backgroundColor: 'transparent', outline: 'none', fontSize: '14px' }} />
    </div>
  </div>
);

export default CalculadoraMamposteria;
