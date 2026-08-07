import React, { useState } from 'react';
import { Calculator, DollarSign, Settings, Download } from 'lucide-react';

export default function DropCeilingCalc() {
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  
  // Nuevo: Tipo de cielo raso
  const [ceilingType, setType] = useState('visible'); // 'invisible' (drywall) o 'visible' (suspensión de aluminio)
  
  // Moneda base de los precios (los precios ingresados en qué moneda están)
  const [baseCurrency, setBaseCurrency] = useState('VES');
  // Moneda en la que se quiere ver el total
  const [viewCurrency, setViewCurrency] = useState('VES');
  const [exchangeRate, setExchangeRate] = useState(65.30); // Tasa de BCV
  
  // Precios base (por defecto los de la cotización en Bs para el Visible)
  const [pricesVisible, setPricesVisible] = useState({
    yesoCaja: 4705.88, // Caja de 8
    anguloPqte: 3841.75, // Pqte 50
    principalPqte: 5911.24, // Pqte 20
    secundariaPqte: 2014.45, // Pqte 20
    clavosBolsa: 3394.31
  });

  const [pricesInvisible, setPricesInvisible] = useState({
    laminas: 10.0,
    angulos: 2.5,
    parales: 3.0,
    omegas: 3.0,
    tornillosEstructura: 0.02,
    tornillosLamina: 0.015,
    cintaMalla: 0.10,
    pastaGalones: 15.0
  });

  const [results, setResults] = useState(null);

  const handlePriceChange = (key, value) => {
    const val = parseFloat(value);
    if (ceilingType === 'visible') {
      setPricesVisible(prev => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
    } else {
      setPricesInvisible(prev => ({ ...prev, [key]: isNaN(val) ? 0 : val }));
    }
  };

  const calculate = (e) => {
    e.preventDefault();
    const w = parseFloat(width);
    const l = parseFloat(length);

    if (isNaN(w) || isNaN(l) || w <= 0 || l <= 0) return;

    const area = w * l;
    const perimeter = (w + l) * 2;

    if (ceilingType === 'invisible') {
      const laminas = Math.ceil((area / 2.97) * 1.10);
      const angulos = Math.ceil((perimeter / 3.05) * 1.05);
      const parales = Math.ceil(((area / 0.61) / 3.05) * 1.10);
      const omegas = Math.ceil(((area / 0.40) / 3.05) * 1.10);
      const tornillosEstructura = Math.ceil(area * 15);
      const tornillosLamina = Math.ceil(area * 25);
      const cintaMalla = Math.ceil(area * 1.5);
      const pastaGalones = Math.ceil(area / 10);

      setResults({
        type: 'invisible',
        area: area.toFixed(2),
        perimeter: perimeter.toFixed(2),
        items: [
          { key: 'laminas', label: 'Láminas de Yeso (1.22x2.44m)', cant: laminas, price: pricesInvisible.laminas },
          { key: 'angulos', label: 'Ángulos Perimetrales (3.05m)', cant: angulos, price: pricesInvisible.angulos },
          { key: 'parales', label: 'Parales / Viguetas (3.05m)', cant: parales, price: pricesInvisible.parales },
          { key: 'omegas', label: 'Omegas (3.05m)', cant: omegas, price: pricesInvisible.omegas },
          { key: 'tornillosEstructura', label: 'Tornillos Estructura (Frama)', cant: tornillosEstructura, price: pricesInvisible.tornillosEstructura },
          { key: 'tornillosLamina', label: 'Tornillos Lámina (Drywall 1")', cant: tornillosLamina, price: pricesInvisible.tornillosLamina },
          { key: 'cintaMalla', label: 'Cinta Malla (metros)', cant: cintaMalla, price: pricesInvisible.cintaMalla },
          { key: 'pastaGalones', label: 'Pasta Profesional (Galones)', cant: pastaGalones, price: pricesInvisible.pastaGalones }
        ]
      });
    } else {
      // Cielo Raso Visible 1.2x0.6m
      // Área de una lámina = 0.72 m2. Una caja trae 8 láminas = 5.76 m2
      const laminasRequeridas = (area / 0.72) * 1.05; // 5% desperdicio
      const yesoCaja = Math.ceil(laminasRequeridas / 8);

      // Angulo perimetral L12 (3.66m) - Paquete de 50 = 183m
      const angulosRequeridos = (perimeter / 3.66) * 1.05;
      const anguloPqte = Math.ceil(angulosRequeridos / 50);

      // Principal T12 (3.66m) espaciado cada 1.2m - Paquete de 20 = 73.2m
      const principalesRequeridas = ((area / 1.2) / 3.66) * 1.05;
      const principalPqte = Math.ceil(principalesRequeridas / 20);

      // Secundaria T4 (1.22m) espaciado cada 0.6m - Paquete de 20 = 24.4m
      // Hay aprox 1.38 secundarias por m2 (0.6 * 1.2)
      const secundariasRequeridas = (area / (1.2 * 0.6)) * 1.05;
      const secundariaPqte = Math.ceil(secundariasRequeridas / 20);

      // Clavos (1 por cada 0.6m de perímetro) - Asumimos 1 bolsita es suficiente para áreas menores a 1000m2
      const clavosBolsa = Math.ceil((perimeter / 0.6) / 500) || 1; // 500 clavos por bolsita aprox

      setResults({
        type: 'visible',
        area: area.toFixed(2),
        perimeter: perimeter.toFixed(2),
        items: [
          { key: 'yesoCaja', label: 'Yeso Pintado Liso 1.20x0.60 (Cajas de 8)', cant: yesoCaja, price: pricesVisible.yesoCaja },
          { key: 'anguloPqte', label: 'Ángulo L12 (Paquete de 50)', cant: anguloPqte, price: pricesVisible.anguloPqte },
          { key: 'principalPqte', label: 'Principal T12 (Paquete de 20)', cant: principalPqte, price: pricesVisible.principalPqte },
          { key: 'secundariaPqte', label: 'Secundaria T4 (Paquete de 20)', cant: secundariaPqte, price: pricesVisible.secundariaPqte },
          { key: 'clavosBolsa', label: 'Clavos Pared 1" (Bolsita)', cant: clavosBolsa, price: pricesVisible.clavosBolsa }
        ]
      });
    }
  };

  const convertPrice = (price) => {
    if (baseCurrency === viewCurrency) return price;
    if (baseCurrency === 'VES' && viewCurrency === 'USD') return price / exchangeRate;
    if (baseCurrency === 'USD' && viewCurrency === 'VES') return price * exchangeRate;
    return price;
  };

  const formatMoney = (amount) => {
    const symbol = viewCurrency === 'VES' ? 'Bs.' : '$';
    return `${symbol} ${Number(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateTotal = () => {
    if (!results) return 0;
    return results.items.reduce((acc, item) => acc + (item.cant * convertPrice(item.price)), 0);
  };

  const exportToExcel = () => {
    if (!results) return;

    let html = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th colspan="4" style="font-size: 20px; font-weight: bold; text-align: left;">Presupuesto Estimado - ${ceilingType === 'visible' ? 'Cielo Raso Visible' : 'Cielo Raso Drywall'}</th>
            </tr>
            <tr>
              <th colspan="4" style="text-align: left;">Área: ${results.area} m² | Perímetro: ${results.perimeter} m</th>
            </tr>
            <tr>
              <th colspan="4" style="text-align: left;">Tasa de Cambio (Bs/$): ${exchangeRate} | Moneda Mostrada: ${viewCurrency === 'VES' ? 'Bolívares (Bs)' : 'Dólares ($)'}</th>
            </tr>
            <tr><th colspan="4"></th></tr>
            <tr>
              <th style="background-color: #f3f4f6; padding: 10px; border: 1px solid #ddd; text-align: left;">Material</th>
              <th style="background-color: #f3f4f6; padding: 10px; border: 1px solid #ddd; text-align: center;">Cantidad</th>
              <th style="background-color: #f3f4f6; padding: 10px; border: 1px solid #ddd; text-align: right;">Precio Unitario</th>
              <th style="background-color: #f3f4f6; padding: 10px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.items.forEach(row => {
      const pUnit = convertPrice(row.price);
      const sTot = row.cant * pUnit;
      html += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;">${row.label}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${row.cant}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatMoney(pUnit)}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatMoney(sTot)}</td>
        </tr>
      `;
    });

    html += `
            <tr>
              <td colspan="3" style="text-align: right; font-weight: bold; padding: 10px; border: 1px solid #ddd;">Costo Total Materiales:</td>
              <td style="font-weight: bold; padding: 10px; border: 1px solid #ddd; text-align: right;">${formatMoney(calculateTotal())}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Presupuesto_Cielo_Raso_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pricesToRender = ceilingType === 'visible' 
    ? [
        { id: 'yesoCaja', label: 'Yeso Pintado (Caja 8)' },
        { id: 'anguloPqte', label: 'Ángulo L12 (Pqte 50)' },
        { id: 'principalPqte', label: 'T12 Principal (Pqte 20)' },
        { id: 'secundariaPqte', label: 'T4 Secundaria (Pqte 20)' },
        { id: 'clavosBolsa', label: 'Clavos Pared (Bolsa)' }
      ]
    : [
        { id: 'laminas', label: 'Lámina Yeso' },
        { id: 'angulos', label: 'Ángulo' },
        { id: 'parales', label: 'Paral' },
        { id: 'omegas', label: 'Omega' },
        { id: 'tornillosEstructura', label: 'Tornillo Frama' },
        { id: 'tornillosLamina', label: 'Tornillo Drywall' },
        { id: 'cintaMalla', label: 'Cinta Malla' },
        { id: 'pastaGalones', label: 'Pasta (Galón)' }
      ];

  const currentPrices = ceilingType === 'visible' ? pricesVisible : pricesInvisible;

  return (
    <div className="calculator-wrapper" style={{ overflowX: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px' }}>
          <div style={{ background: 'var(--primary-glow)', color: 'var(--primary)', padding: '12px', borderRadius: '8px' }}>
            <Calculator size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--secondary)' }}>Cómputos de Cielo Raso</h2>
            <p style={{ color: 'var(--text-muted)' }}>Calculadora de materiales y presupuesto</p>
          </div>
        </div>
        
        {/* Moneda y Tasa */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', background: 'var(--bg-alt)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Tasa (Bs/$):</span>
            <input 
              type="number" 
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
              style={{ width: '80px', padding: '6px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 600 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Ver Total En:</span>
            <select 
              value={viewCurrency} 
              onChange={(e) => setViewCurrency(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 700 }}
            >
              <option value="VES">Bolívares (Bs)</option>
              <option value="USD">Dólares ($)</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px' }}>
        {/* Formulario y Precios Base */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: '1 1 300px', minWidth: '300px' }}>
          <form onSubmit={calculate} style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} /> Proyecto
            </h3>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Tipo de Cielo Raso</label>
              <select 
                value={ceilingType}
                onChange={(e) => {
                  setType(e.target.value);
                  setBaseCurrency(e.target.value === 'visible' ? 'VES' : 'USD');
                  setResults(null);
                }}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontWeight: 600 }}
              >
                <option value="visible">Cielo Raso Visible (Suspensión y Yeso)</option>
                <option value="invisible">Drywall (Junta Invisible)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Ancho (m)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-body)' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '14px' }}>Largo (m)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-body)' }}
                />
              </div>
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', justifyContent: 'center' }}>
              Calcular Proyecto
            </button>
          </form>

          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} /> Precios Unitarios en {baseCurrency === 'VES' ? 'Bs' : 'USD'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              {pricesToRender.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{baseCurrency === 'VES' ? 'Bs.' : '$'}</span>
                    <input 
                      type="number" 
                      step="0.01"
                      value={currentPrices[item.id]}
                      onChange={(e) => handlePriceChange(item.id, e.target.value)}
                      style={{ width: '90px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-body)', fontSize: '13px', textAlign: 'right' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div style={{ background: 'var(--bg-alt)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flex: '2 1 400px', minWidth: '300px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>Presupuesto Estimado</h3>
            {results && (
              <button 
                onClick={exportToExcel}
                className="btn" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                <Download size={16} /> Exportar a Excel
              </button>
            )}
          </div>
          
          {!results ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
              <Calculator size={48} style={{ opacity: 0.2 }} />
              <p>Selecciona el tipo de techo e ingresa las dimensiones para generar el cómputo métrico y presupuesto.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', flex: 1, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Área Total</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{results.area} m²</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', flex: 1, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Perímetro</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{results.perimeter} m</div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', paddingBottom: '12px' }}>Material</th>
                      <th style={{ textAlign: 'center', paddingBottom: '12px' }}>Cant.</th>
                      <th style={{ textAlign: 'right', paddingBottom: '12px' }}>Precio Unit.</th>
                      <th style={{ textAlign: 'right', paddingBottom: '12px' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.items.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 0', fontWeight: 500 }}>{row.label}</td>
                        <td style={{ textAlign: 'center', padding: '12px 0' }}>{row.cant}</td>
                        <td style={{ textAlign: 'right', padding: '12px 0', color: 'var(--text-muted)' }}>{formatMoney(convertPrice(row.price))}</td>
                        <td style={{ textAlign: 'right', padding: '12px 0', fontWeight: 600 }}>{formatMoney(row.cant * convertPrice(row.price))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '2px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Costo Total de Materiales</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>No incluye desperdicios extra ni mano de obra</div>
                </div>
                <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--secondary)' }}>
                  {formatMoney(calculateTotal())}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
