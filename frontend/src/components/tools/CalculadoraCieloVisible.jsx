import React, { useState, useMemo } from 'react';

const CalculadoraCieloVisible = () => {
  // ─── ESTADO ───
  const [techo, setTecho] = useState({ largo: 5.0, ancho: 4.0 });
  const [correas, setCorreas] = useState('largo'); // Dirección de las correas ('largo' o 'ancho')
  const [secundarias, setSecundarias] = useState('1.22'); // '1.22' o '0.61'
  const [desperdicio, setDesperdicio] = useState(10); // Porcentaje
  const [baseCurrency, setBaseCurrency] = useState('VES');
  const [viewCurrency, setViewCurrency] = useState('VES');
  const [exchangeRate, setExchangeRate] = useState(653.00);
  
  const [costos, setCostos] = useState({
    lamina: 4705.88,
    principal366: 5911.24,
    secundaria122: 2014.45,
    secundaria061: 1007.22,
    angulo305: 3841.75,
    alambre: 3918.00,
    clavos: 3394.31,
    fulminante: 11101.00
  });

  // ─── HANDLERS ───
  const handleTecho = (e) => {
    const { name, value } = e.target;
    const val = parseFloat(value);
    setTecho(p => ({ ...p, [name]: isNaN(val) || val < 0 ? 0 : val }));
  };

  const handleCosto = (e) => {
    const { name, value } = e.target;
    const val = parseFloat(value);
    setCostos(c => ({ ...c, [name]: isNaN(val) || val < 0 ? 0 : val }));
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
        }
      }
      setCostos(newCostos);
      setBaseCurrency(newBase);
      // Auto-cambiamos también la moneda de vista para que el total se vea en la nueva moneda base.
      setViewCurrency(newBase);
    }
  };

  // ─── CÁLCULOS ───
  const resultados = useMemo(() => {
    const area = techo.largo * techo.ancho;
    const perimetro = 2 * (techo.largo + techo.ancho);
    const factorDesperdicio = 1 + (desperdicio / 100);

    // Dimensiones en base a la dirección de las correas
    // Las principales van PERPENDICULARES a las correas.
    let dimPrincipal = correas === 'largo' ? techo.ancho : techo.largo; // Longitud paralela a las principales
    let dimPerpendicular = correas === 'largo' ? techo.largo : techo.ancho; // Longitud para calcular líneas de principales

    let secundarias122 = 0;
    let secundarias061 = 0;
    let lineasPrincipales = 0;
    
    if (secundarias === '1.22') {
      // Caso 1.22m: Principales cada 1.22m, Secundarias de 1.22m cada 0.61m
      lineasPrincipales = Math.max(0, Math.ceil(dimPerpendicular / 1.22) - 1);
      const columnasSecundarias = Math.ceil(dimPerpendicular / 1.22); // espacios entre principales
      const filasSecundarias = Math.max(0, Math.ceil(dimPrincipal / 0.61) - 1); // líneas de secundarias
      secundarias122 = Math.ceil((columnasSecundarias * filasSecundarias) * factorDesperdicio);
    } else {
      // Caso 0.61m: Principales cada 0.61m, Secundarias de 0.61m cada 1.22m
      lineasPrincipales = Math.max(0, Math.ceil(dimPerpendicular / 0.61) - 1);
      const columnasSecundarias = Math.ceil(dimPerpendicular / 0.61); // espacios entre principales
      const filasSecundarias = Math.max(0, Math.ceil(dimPrincipal / 1.22) - 1); // líneas de secundarias
      secundarias061 = Math.ceil((columnasSecundarias * filasSecundarias) * factorDesperdicio);
    }

    const metrosPrincipales = lineasPrincipales * dimPrincipal;
    const principales = Math.ceil((metrosPrincipales / 3.66) * factorDesperdicio);

    // Ángulo Perimetral (3.05m)
    const angulos = Math.ceil((perimetro / 3.05) * factorDesperdicio);

    // Láminas (0.61 x 1.22m)
    const areaLamina = 0.61 * 1.22;
    const laminas = Math.ceil((area / areaLamina) * factorDesperdicio);

    // Cuelgues (cada 1.22m en las principales)
    const cuelguesPrincipales = lineasPrincipales * Math.ceil(dimPrincipal / 1.22);
    const clavosPerimetrales = Math.ceil(perimetro / 0.60); // fijación del ángulo cada 60cm
    const totalFijaciones = Math.ceil((cuelguesPrincipales + clavosPerimetrales) * factorDesperdicio);
    const bolsasFijaciones = Math.ceil(totalFijaciones / 100);

    // Alambre galvanizado (aprox 1 metro por cuelgue, ~25m por kg)
    const kgAlambre = Math.ceil((cuelguesPrincipales * factorDesperdicio) / 25) || 1;

    // Conversión de moneda
    const convertPrice = (price) => {
      if (baseCurrency === viewCurrency) return price;
      if (baseCurrency === 'VES' && viewCurrency === 'USD') return price / exchangeRate;
      if (baseCurrency === 'USD' && viewCurrency === 'VES') return price * exchangeRate;
      return price;
    };

    // Costos
    const pLamina = convertPrice(costos.lamina);
    const pPrincipal366 = convertPrice(costos.principal366);
    const pSecundaria122 = convertPrice(costos.secundaria122);
    const pSecundaria061 = convertPrice(costos.secundaria061);
    const pAngulo305 = convertPrice(costos.angulo305);
    const pAlambre = convertPrice(costos.alambre);
    const pClavos = convertPrice(costos.clavos);
    const pFulminante = convertPrice(costos.fulminante);

    const totalLamina = laminas * pLamina;
    const totalPrincipal = principales * pPrincipal366;
    const totalSecundaria122 = secundarias122 * pSecundaria122;
    const totalSecundaria061 = secundarias061 * pSecundaria061;
    const totalAngulo = angulos * pAngulo305;
    const totalAlambre = kgAlambre * pAlambre;
    const totalClavos = bolsasFijaciones * pClavos;
    const totalFulminante = bolsasFijaciones * pFulminante;
    
    const totalGeneral = totalLamina + totalPrincipal + totalSecundaria122 + totalSecundaria061 + totalAngulo + totalAlambre + totalClavos + totalFulminante;

    const materialesArray = [
      { nombre: 'Láminas (0.61×1.22m)', cantidad: laminas, unidad: 'pzas', precio: pLamina, total: totalLamina },
      { nombre: 'Perfil Principal (3.66m)', cantidad: principales, unidad: 'pzas', precio: pPrincipal366, total: totalPrincipal },
    ];

    if (secundarias === '1.22') {
      materialesArray.push({ nombre: 'Perfil Secundaria (1.22m)', cantidad: secundarias122, unidad: 'pzas', precio: pSecundaria122, total: totalSecundaria122 });
    } else {
      materialesArray.push({ nombre: 'Perfil Secundaria (0.61m)', cantidad: secundarias061, unidad: 'pzas', precio: pSecundaria061, total: totalSecundaria061 });
    }

    materialesArray.push(
      { nombre: 'Ángulo Perimetral (3.05m)', cantidad: angulos, unidad: 'pzas', precio: pAngulo305, total: totalAngulo },
      { nombre: 'Clavos (Bolsa 100und)', cantidad: bolsasFijaciones, unidad: 'bolsas', precio: pClavos, total: totalClavos },
      { nombre: 'Fulminantes (Bolsa 100und)', cantidad: bolsasFijaciones, unidad: 'bolsas', precio: pFulminante, total: totalFulminante },
      { nombre: 'Alambre Galvanizado', cantidad: kgAlambre, unidad: 'kg', precio: pAlambre, total: totalAlambre }
    );

    return {
      area: area.toFixed(2),
      perimetro: perimetro.toFixed(2),
      materiales: materialesArray,
      totalGeneral
    };
  }, [techo, correas, secundarias, desperdicio, costos, baseCurrency, viewCurrency, exchangeRate]);

  const formatMoney = (amount) => {
    const symbol = viewCurrency === 'VES' ? 'Bs.' : '$';
    return `${symbol} ${Number(amount || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ─── EXPORTAR PDF ───
  const exportarPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Cotización Cielo Raso Visible</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            h1 { color: #1a237e; border-bottom: 2px solid #1a237e; padding-bottom: 10px; }
            h2 { color: #2e7d32; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
            th { background: #e8f5e9; }
            .total { font-weight: bold; font-size: 18px; color: #d32f2f; text-align: right; margin-top: 20px; }
            .info { background: #f5f7fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .footer { margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>Cotización – Cielo Raso Junta Visible</h1>
          <div class="info">
            <strong>Dimensiones:</strong> ${techo.largo}m × ${techo.ancho}m (${resultados.area} m²)<br/>
            <strong>Perímetro:</strong> ${resultados.perimetro} m<br/>
            <strong>Desperdicio aplicado:</strong> ${desperdicio}%<br/>
            <strong>Tipo de Secundarias:</strong> ${secundarias === '1.22' ? 'De 1.22m (Principales cada 1.22m)' : 'De 0.61m (Principales cada 0.61m)'}<br/>
            <strong>Dirección de Correas:</strong> Paralelas al ${correas}<br/>
          </div>

          <h2>Lista de Materiales y Costos</h2>
          <table>
            <tr>
              <th>Material</th>
              <th>Cantidad</th>
              <th>Unidad</th>
              <th>Precio Unit.</th>
              <th>Subtotal</th>
            </tr>
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
          <div class="total">TOTAL ESTIMADO: ${formatMoney(resultados.totalGeneral)}</div>

          <div class="footer">
            Generado el ${new Date().toLocaleDateString()} · Calculadora Cielo Raso · Precios en USD referenciales.
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  const exportarExcel = () => {
    let html = `
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th colspan="5" style="font-size: 20px; font-weight: bold; text-align: left;">Cotización - Cielo Raso Junta Visible</th>
            </tr>
            <tr>
              <th colspan="5" style="text-align: left;">Área: ${resultados.area} m² | Perímetro: ${resultados.perimetro} m</th>
            </tr>
            <tr>
              <th colspan="5" style="text-align: left;">Tasa de Cambio (Bs/$): ${exchangeRate} | Moneda Mostrada: ${viewCurrency === 'VES' ? 'Bolívares (Bs)' : 'Dólares ($)'}</th>
            </tr>
            <tr><th colspan="5"></th></tr>
            <tr>
              <th style="background-color: #e8f5e9; padding: 10px; border: 1px solid #ccc; text-align: left;">Material</th>
              <th style="background-color: #e8f5e9; padding: 10px; border: 1px solid #ccc; text-align: center;">Cantidad</th>
              <th style="background-color: #e8f5e9; padding: 10px; border: 1px solid #ccc; text-align: center;">Unidad</th>
              <th style="background-color: #e8f5e9; padding: 10px; border: 1px solid #ccc; text-align: right;">Precio Unitario</th>
              <th style="background-color: #e8f5e9; padding: 10px; border: 1px solid #ccc; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
    `;

    resultados.materiales.forEach(m => {
      html += `
        <tr>
          <td style="padding: 10px; border: 1px solid #ccc;">${m.nombre}</td>
          <td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${m.cantidad}</td>
          <td style="padding: 10px; border: 1px solid #ccc; text-align: center;">${m.unidad}</td>
          <td style="padding: 10px; border: 1px solid #ccc; text-align: right;">${formatMoney(m.precio)}</td>
          <td style="padding: 10px; border: 1px solid #ccc; text-align: right;">${formatMoney(m.total)}</td>
        </tr>
      `;
    });

    html += `
            <tr>
              <td colspan="4" style="text-align: right; font-weight: bold; padding: 10px; border: 1px solid #ccc; color: #d32f2f;">TOTAL ESTIMADO:</td>
              <td style="font-weight: bold; padding: 10px; border: 1px solid #ccc; text-align: right; color: #d32f2f;">${formatMoney(resultados.totalGeneral)}</td>
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
    link.download = `Cotizacion_Cielo_Raso_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'Segoe UI, Arial, sans-serif', maxWidth: '1100px', margin: '0 auto', backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#1a237e' }}>📐 Calculadora de Cielo Raso Visible</h2>
        <p style={{ color: '#555', margin: 0 }}>Cálculo preciso de materiales para techos desmontables (suspensión a la vista) con láminas de 0.61 x 1.22m.</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* PANEL IZQUIERDO: INPUTS */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <Card title="📐 Dimensiones del Área" color="#1a237e">
            <InputRow label="Largo (m)" name="largo" value={techo.largo} onChange={handleTecho} step={0.1} />
            <InputRow label="Ancho (m)" name="ancho" value={techo.ancho} onChange={handleTecho} step={0.1} />
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 500, fontSize: '14px' }}>Desperdicio (%):</label>
              <input type="number" min="0" max="30" value={desperdicio} onChange={e => setDesperdicio(parseInt(e.target.value) || 0)} style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'right', fontSize: '14px' }} />
            </div>
          </Card>

          <Card title="🏗️ Estructura" color="#00695c">
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '14px' }}>Dirección de las Correas del Techo</label>
              <select value={correas} onChange={e => setCorreas(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                <option value="largo">Paralelas al Largo (Correas a lo largo)</option>
                <option value="ancho">Paralelas al Ancho (Correas a lo ancho)</option>
              </select>
              <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>Las Principales (3.66m) se instalarán perpendicularmente a estas correas.</small>
            </div>
            
            
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: '6px', fontSize: '14px' }}>Tipo de Secundarias (según diseño)</label>
              <select value={secundarias} onChange={e => setSecundarias(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                <option value="1.22">Secundarias de 1.22m (Principales a 1.22m)</option>
                <option value="0.61">Secundarias de 0.61m (Principales a 0.61m)</option>
              </select>
              <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                {secundarias === '1.22' 
                  ? 'Las principales van cada 1.22m y se conectan con secundarias de 1.22m instaladas cada 0.61m.'
                  : 'Las principales van cada 0.61m y se conectan con secundarias de 0.61m instaladas cada 1.22m.'}
              </small>
            </div>
          </Card>

          <Card title="💰 Costos Unitarios" color="#e65100">
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', backgroundColor: '#fff3e0', padding: '10px', borderRadius: '8px' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '12px', color: '#555', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tasa (Bs/$):</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={exchangeRate} 
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '6px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px' }}
                />
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <CostInput label="Lámina (0.61x1.22)" name="lamina" value={costos.lamina} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              <CostInput label="Principal 3.66m" name="principal366" value={costos.principal366} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              {secundarias === '1.22' 
                ? <CostInput label="Secundaria 1.22m" name="secundaria122" value={costos.secundaria122} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
                : <CostInput label="Secundaria 0.61m" name="secundaria061" value={costos.secundaria061} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              }
              <CostInput label="Ángulo 3.05m" name="angulo305" value={costos.angulo305} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              <CostInput label="Clavos (Bolsa)" name="clavos" value={costos.clavos} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              <CostInput label="Fulminantes (Bolsa)" name="fulminante" value={costos.fulminante} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
              <CostInput label="Alambre (kg)" name="alambre" value={costos.alambre} onChange={handleCosto} symbol={baseCurrency === 'VES' ? 'Bs' : '$'} />
            </div>
          </Card>

        </div>

        {/* PANEL DERECHO: RESULTADOS */}
        <div style={{ flex: '1 1 420px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ backgroundColor: '#e8f5e9', padding: '16px', borderRadius: '10px', border: '1px solid #c8e6c9' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#1b5e20' }}>📋 Resumen del Proyecto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <StatBox label="Área Total" value={`${resultados.area} m²`} />
              <StatBox label="Perímetro" value={`${resultados.perimetro} m`} />
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#333' }}>📐 Layout del Cielo Raso</h3>
              <span style={{ fontSize: '12px', color: '#888' }}>Escala automática</span>
            </div>
            <svg width="100%" height={260} style={{ background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: '6px', display: 'block' }}>
              {(() => {
                const svgW = 380;
                const svgH = 240;
                const m = 20;
                const sX = (svgW - m * 2) / (techo.largo || 1);
                const sY = (svgH - m * 2) / (techo.ancho || 1);
                const sc = Math.min(sX, sY);
                const rW = techo.largo * sc;
                const rH = techo.ancho * sc;
                const oX = (svgW - rW) / 2 + 10; // offset
                const oY = (svgH - rH) / 2 + 10;
                
                const elements = [];
                // Fondo
                elements.push(<rect key="bg" x={oX} y={oY} width={rW} height={rH} fill="#e3f2fd" stroke="#90caf9" strokeWidth="2" />);
                
                // Espaciado de principales
                const espacioP = secundarias === '1.22' ? 1.22 : 0.61;
                // Espaciado de secundarias
                const espacioS = secundarias === '1.22' ? 0.61 : 1.22;

                // Correas cada 1.2m
                if (correas === 'largo') {
                  const numC = Math.floor(techo.ancho / 1.2);
                  for (let i = 1; i <= numC; i++) {
                    const y = oY + i * 1.2 * sc;
                    elements.push(<line key={`c-${i}`} x1={oX} y1={y} x2={oX + rW} y2={y} stroke="#ff9800" strokeWidth="2" strokeDasharray="6,4" />);
                  }
                  // Principales perpendiculares a correas (paralelas al ancho)
                  const numP = Math.max(0, Math.ceil(techo.largo / espacioP) - 1);
                  for (let i = 1; i <= numP; i++) {
                    const x = oX + i * espacioP * sc;
                    elements.push(<line key={`p-${i}`} x1={x} y1={oY} x2={x} y2={oY + rH} stroke="#1976d2" strokeWidth="1.5" />);
                  }
                  // Secundarias perpendiculares a principales (paralelas al largo)
                  const numS = Math.max(0, Math.ceil(techo.ancho / espacioS) - 1);
                  for (let i = 1; i <= numS; i++) {
                    const y = oY + i * espacioS * sc;
                    elements.push(<line key={`s-${i}`} x1={oX} y1={y} x2={oX + rW} y2={y} stroke="#4caf50" strokeWidth="1" />);
                  }
                } else {
                  // Correas a lo ancho
                  const numC = Math.floor(techo.largo / 1.2);
                  for (let i = 1; i <= numC; i++) {
                    const x = oX + i * 1.2 * sc;
                    elements.push(<line key={`c-${i}`} x1={x} y1={oY} x2={x} y2={oY + rH} stroke="#ff9800" strokeWidth="2" strokeDasharray="6,4" />);
                  }
                  // Principales perpendiculares a correas (paralelas al largo)
                  const numP = Math.max(0, Math.ceil(techo.ancho / espacioP) - 1);
                  for (let i = 1; i <= numP; i++) {
                    const y = oY + i * espacioP * sc;
                    elements.push(<line key={`p-${i}`} x1={oX} y1={y} x2={oX + rW} y2={y} stroke="#1976d2" strokeWidth="1.5" />);
                  }
                  // Secundarias perpendiculares a principales (paralelas al ancho)
                  const numS = Math.max(0, Math.ceil(techo.largo / espacioS) - 1);
                  for (let i = 1; i <= numS; i++) {
                    const x = oX + i * espacioS * sc;
                    elements.push(<line key={`s-${i}`} x1={x} y1={oY} x2={x} y2={oY + rH} stroke="#4caf50" strokeWidth="1" />);
                  }
                }

                // Cotas
                elements.push(<text key="t1" x={oX + rW / 2} y={oY - 6} textAnchor="middle" fontSize="11" fill="#333" fontWeight="bold">{techo.largo} m</text>);
                elements.push(<text key="t2" x={oX - 10} y={oY + rH / 2 + 4} textAnchor="middle" fontSize="11" fill="#333" fontWeight="bold" transform={`rotate(-90, ${oX - 10}, ${oY + rH / 2 + 4})`}>{techo.ancho} m</text>);

                return elements;
              })()}
            </svg>
            <div style={{ display: 'flex', gap: '15px', fontSize: '11px', color: '#555', marginTop: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '0px', borderTop: '2px dashed #ff9800' }}></div> Correas (1.2m)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '2px', backgroundColor: '#1976d2' }}></div> Principales ({secundarias === '1.22' ? '1.22m' : '0.61m'})</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '1px', backgroundColor: '#4caf50' }}></div> Secundarias ({secundarias}m)</span>
            </div>

            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center', border: '1px solid #c8e6c9' }}>
              <div style={{ fontSize: '13px', color: '#2e7d32' }}>TOTAL ESTIMADO MATERIALES</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1b5e20' }}>{formatMoney(resultados.totalGeneral)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={exportarPDF}
              style={{
                flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#d32f2f',
                color: '#fff', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)', transition: 'background 0.2s'
              }}
              onMouseOver={e => e.target.style.backgroundColor = '#b71c1c'}
              onMouseOut={e => e.target.style.backgroundColor = '#d32f2f'}
            >
              📄 Exportar a PDF
            </button>
            <button
              onClick={exportarExcel}
              style={{
                flex: 1, padding: '14px', borderRadius: '8px', border: 'none', backgroundColor: '#2e7d32',
                color: '#fff', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)', transition: 'background 0.2s'
              }}
              onMouseOver={e => e.target.style.backgroundColor = '#1b5e20'}
              onMouseOut={e => e.target.style.backgroundColor = '#2e7d32'}
            >
              📊 Exportar a Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── COMPONENTES AUXILIARES ───

const Card = ({ title, color, children }) => (
  <div style={{ padding: '18px', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${color}` }}>
    <h4 style={{ margin: '0 0 14px 0', color }}>{title}</h4>
    {children}
  </div>
);

const InputRow = ({ label, name, value, onChange, step = 1 }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
    <label style={{ fontWeight: 500, color: '#333', fontSize: '14px' }}>{label}</label>
    <input
      type="number"
      name={name}
      value={value}
      onChange={onChange}
      step={step}
      min={0}
      style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', textAlign: 'right', fontSize: '14px' }}
    />
  </div>
);

const CostInput = ({ label, name, value, onChange, symbol = '$' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontSize: '12px', color: '#555', fontWeight: 500 }}>{label}</label>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: '#888', fontSize: '13px' }}>{symbol}</span>
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        step={0.01}
        min={0}
        style={{ width: '70px', padding: '5px 6px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px', textAlign: 'right' }}
      />
    </div>
  </div>
);

const StatBox = ({ label, value }) => (
  <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
    <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>{label}</div>
    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>{value}</div>
  </div>
);

export default CalculadoraCieloVisible;
