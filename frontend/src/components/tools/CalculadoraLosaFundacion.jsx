import React, { useState, useRef, useCallback, useEffect } from 'react';
import './CalculadoraLosaFundacion.css';

// ============================================
// FOUNDATION SLAB EDITOR - React Frontend
// Conecta con backend Python FastAPI
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const TOOLS = {
  SELECT: 'select',
  WALL_PERIM: 'wallPerim',
  WALL_INNER: 'wallInner',
  DOOR: 'door',
  BEAM: 'beam'
};

const CANVAS_SIZE = 520;

export default function CalculadoraLosaFundacion() {
  // Estado del modelo
  const [geometry, setGeometry] = useState({ Lx: 10.0, Ly: 10.0, h: 15 });
  const [walls, setWalls] = useState([]);
  const [doors, setDoors] = useState([]);
  const [beams, setBeams] = useState([]);
  const [currentTool, setCurrentTool] = useState(TOOLS.SELECT);
  const [wallProps, setWallProps] = useState({ thickness: 15, height: 2.70, density: 1500 });
  const [doorWidth, setDoorWidth] = useState(0.90);

  // Estado de dibujo
  const [isDrawing, setIsDrawing] = useState(false);
  const [previewLine, setPreviewLine] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [hoverPoint, setHoverPoint] = useState(null);

  // Estado de resultados
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const svgRef = useRef(null);
  const [scale, setScale] = useState(CANVAS_SIZE / 10);

  useEffect(() => {
    setScale(CANVAS_SIZE / Math.max(geometry.Lx, geometry.Ly));
  }, [geometry.Lx, geometry.Ly]);

  const toSvg = (m) => m * scale;
  const toM = (px) => px / scale;
  const snap = (val, gridM = 0.05) => Math.round(val / (gridM * scale)) * (gridM * scale);

  const getMousePos = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX - rect.left;
    pt.y = e.clientY - rect.top;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
    return { x: svgP.x, y: svgP.y };
  }, []);

  const snapToGrid = useCallback((x, y) => ({
    x: snap(x, 0.05), y: snap(y, 0.05)
  }), [scale]);

  // Dibujo de muros
  const handleMouseDown = useCallback((e) => {
    if (currentTool === TOOLS.SELECT || currentTool === TOOLS.DOOR) return;
    const pos = getMousePos(e);
    const snapped = snapToGrid(pos.x, pos.y);
    setIsDrawing(true);
    setStartPoint(snapped);
    setPreviewLine({ x1: snapped.x, y1: snapped.y, x2: snapped.x, y2: snapped.y });
  }, [currentTool, getMousePos, snapToGrid]);

  const handleMouseMove = useCallback((e) => {
    const pos = getMousePos(e);
    const snapped = snapToGrid(pos.x, pos.y);
    setHoverPoint(snapped);

    if (!isDrawing || !startPoint) return;

    const dx = Math.abs(snapped.x - startPoint.x);
    const dy = Math.abs(snapped.y - startPoint.y);

    if (dx > dy * 1.5) {
      setPreviewLine({ ...startPoint, x2: snapped.x, y2: startPoint.y });
    } else if (dy > dx * 1.5) {
      setPreviewLine({ ...startPoint, x2: startPoint.x, y2: snapped.y });
    } else {
      setPreviewLine({ ...startPoint, x2: snapped.x, y2: snapped.y });
    }
  }, [isDrawing, startPoint, getMousePos, snapToGrid]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !previewLine) return;
    setIsDrawing(false);

    const length = Math.sqrt(
      (previewLine.x2 - previewLine.x1)**2 + 
      (previewLine.y2 - previewLine.y1)**2
    );
    if (length < 8) {
      setPreviewLine(null);
      return;
    }

    const newWall = {
      id: Date.now(),
      type: currentTool === TOOLS.WALL_PERIM ? 'perimetral' : 'interno',
      x1: toM(previewLine.x1),
      y1: toM(previewLine.y1),
      x2: toM(previewLine.x2),
      y2: toM(previewLine.y2),
      thickness: wallProps.thickness / 100,
      height: wallProps.height,
      density: wallProps.density
    };

    setWalls(prev => [...prev, newWall]);
    setPreviewLine(null);
    setStartPoint(null);
  }, [isDrawing, previewLine, currentTool, wallProps, toM]);

  // Colocar puerta
  const handleClick = useCallback((e) => {
    if (currentTool !== TOOLS.DOOR) return;
    const pos = getMousePos(e);
    const snapped = snapToGrid(pos.x, pos.y);

    let closestWall = null;
    let minDist = Infinity;

    walls.forEach(w => {
      const d = pointToSegmentDistance(
        snapped.x, snapped.y,
        toSvg(w.x1), toSvg(w.y1), toSvg(w.x2), toSvg(w.y2)
      );
      if (d < minDist && d < 20) { minDist = d; closestWall = w; }
    });

    if (!closestWall) {
      alert('Coloca la puerta sobre un muro existente');
      return;
    }

    const newDoor = {
      id: Date.now(),
      wallId: closestWall.id,
      width: doorWidth,
      x: toM(snapped.x),
      y: toM(snapped.y)
    };
    setDoors(prev => [...prev, newDoor]);
  }, [currentTool, getMousePos, snapToGrid, walls, doorWidth, toM, toSvg]);

  const deleteWall = useCallback((wallId) => {
    setWalls(prev => prev.filter(w => w.id !== wallId));
    setDoors(prev => prev.filter(d => d.wallId !== wallId));
  }, []);

  const clearAll = useCallback(() => {
    if (!window.confirm('¿Eliminar todo el dibujo?')) return;
    setWalls([]);
    setDoors([]);
    setBeams([]);
    setResults(null);
  }, []);

  // Exportar y analizar
  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Generar vigas de amarre automáticas
    const autoBeams = walls
      .filter(w => w.type === 'perimetral')
      .map(w => ({
        x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
        width: 0.20, height: 0.30, type: 'zuncho', load_factor: 1.2
      }));

    const payload = {
      project: "Losa de Cimentación",
      geometry: {
        Lx: geometry.Lx,
        Ly: geometry.Ly,
        h: geometry.h / 100
      },
      materials: {
        f_c: 25, f_y: 420, cover: 0.05, bar_diam: 0.012,
        gamma_horm: 2400, E: 25e9, nu: 0.2, k: 20e6
      },
      walls: walls.map(w => ({
        x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
        thickness: w.thickness, height: w.height,
        density: w.density, type: w.type, load_factor: 1.5
      })),
      beams: autoBeams,
      doors: doors,
      mesh_nx: 40,
      mesh_ny: 40,
      extra_load: 300 * 9.81  // piso + sobrecarga liviana
    };

    try {
      const response = await fetch(`${API_BASE}/arko_app/calculadoras/losa_fundacion/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  }, [geometry, walls, doors]);

  // Render helpers
  const renderGrid = () => {
    const lines = [];
    const nx = Math.ceil(geometry.Lx);
    const ny = Math.ceil(geometry.Ly);
    for (let i = 0; i <= nx; i++) {
      lines.push(
        <line key={`vx${i}`} x1={toSvg(i)} y1={0} x2={toSvg(i)} y2={toSvg(geometry.Ly)}
          stroke="#e0e0e0" strokeWidth="0.5" opacity="0.4" />
      );
    }
    for (let j = 0; j <= ny; j++) {
      lines.push(
        <line key={`hy${j}`} x1={0} y1={toSvg(j)} x2={toSvg(geometry.Lx)} y2={toSvg(j)}
          stroke="#e0e0e0" strokeWidth="0.5" opacity="0.4" />
      );
    }
    return lines;
  };

  const renderBands = () => {
    return walls.map(wall => {
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const length = Math.sqrt(dx*dx + dy*dy);
      if (length < 1e-6) return null;

      const h = geometry.h / 100;
      const bandW = Math.max(wall.thickness + 2*h, 1.0);
      const hw = bandW / 2;
      const nx = -dy / length;
      const ny = dx / length;

      const corners = [
        [wall.x1 + nx*hw, wall.y1 + ny*hw],
        [wall.x1 - nx*hw, wall.y1 - ny*hw],
        [wall.x2 - nx*hw, wall.y2 - ny*hw],
        [wall.x2 + nx*hw, wall.y2 + ny*hw]
      ];

      const pts = corners.map(c => `${toSvg(c[0]).toFixed(1)},${toSvg(c[1]).toFixed(1)}`).join(' ');

      return (
        <polygon key={`band-${wall.id}`} points={pts}
          fill="rgba(255,193,7,0.15)" stroke="#f9a825" strokeWidth="1"
          strokeDasharray="3 3" />
      );
    });
  };

  const renderWalls = () => {
    return walls.map(wall => (
      <line key={wall.id}
        x1={toSvg(wall.x1)} y1={toSvg(wall.y1)}
        x2={toSvg(wall.x2)} y2={toSvg(wall.y2)}
        stroke={wall.type === 'perimetral' ? '#e53935' : '#1e88e5'}
        strokeWidth={Math.max(3, wall.thickness * scale)}
        strokeLinecap="round"
        style={{ cursor: 'pointer' }}
        onDoubleClick={() => deleteWall(wall.id)}
      />
    ));
  };

  const renderDoors = () => {
    return doors.map(door => {
      const wall = walls.find(w => w.id === door.wallId);
      if (!wall) return null;

      const wx1 = toSvg(wall.x1), wy1 = toSvg(wall.y1);
      const wx2 = toSvg(wall.x2), wy2 = toSvg(wall.y2);
      const dx = wx2 - wx1, dy = wy2 - wy1;
      const len = Math.sqrt(dx*dx + dy*dy);
      const ux = dx/len, uy = dy/len;
      const cx = toSvg(door.x), cy = toSvg(door.y);
      const hw = door.width * scale / 2;
      const px = -uy, py = ux;

      return (
        <g key={door.id}>
          <path d={`M ${cx} ${cy} L ${cx + hw*ux + hw*px} ${cy + hw*uy + hw*py} A ${hw} ${hw} 0 0 1 ${cx + hw*ux - hw*px} ${cy + hw*uy - hw*py} Z`}
            fill="none" stroke="#666" strokeWidth="1.5" />
          <line x1={cx} y1={cy} x2={cx + hw*ux - hw*px} y2={cy + hw*uy - hw*py}
            stroke="#666" strokeWidth="1" strokeDasharray="2 2" />
        </g>
      );
    });
  };

  const renderPreview = () => {
    if (!previewLine) return null;
    return (
      <line x1={previewLine.x1} y1={previewLine.y1} x2={previewLine.x2} y2={previewLine.y2}
        stroke={currentTool === TOOLS.WALL_PERIM ? '#e53935' : '#1e88e5'}
        strokeWidth="5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.6" />
    );
  };

  const renderHoverPoint = () => {
    if (!hoverPoint || currentTool === TOOLS.SELECT) return null;
    return (
      <circle cx={hoverPoint.x} cy={hoverPoint.y} r="4"
        fill={currentTool === TOOLS.DOOR ? '#666' : (currentTool === TOOLS.WALL_PERIM ? '#e53935' : '#1e88e5')}
        opacity="0.5" pointerEvents="none" />
    );
  };

  return (
    <div className="app">
      {/* Top Bar */}
      <header className="top-bar">
        <h1>Foundation Slab Editor</h1>
        <span className="subtitle">Diseño de losa de cimentación — Método de la Grilla</span>
      </header>

      <div className="main-layout">
        {/* Canvas */}
        <div className="canvas-area">
          <div className="canvas-wrapper">
            <svg ref={svgRef}
              width={CANVAS_SIZE + 100}
              height={CANVAS_SIZE + 100}
              viewBox={`-50 -50 ${toSvg(geometry.Lx) + 100} ${toSvg(geometry.Ly) + 100}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleClick}
              style={{ cursor: currentTool === TOOLS.SELECT ? 'default' : 'crosshair' }}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#888" />
                </marker>
              </defs>

              {/* Grid */}
              {renderGrid()}

              {/* Slab boundary */}
              <rect x={0} y={0} width={toSvg(geometry.Lx)} height={toSvg(geometry.Ly)}
                fill="#fafafa" stroke="#1a1a1a" strokeWidth="2" rx="2" />

              {/* Results SVG overlay */}
              {results && results.svg_plan && (
                <foreignObject x={0} y={0} width={toSvg(geometry.Lx)} height={toSvg(geometry.Ly)}>
                  <div dangerouslySetInnerHTML={{ __html: results.svg_plan }} />
                </foreignObject>
              )}

              {/* Bands */}
              {renderBands()}

              {/* Walls */}
              {renderWalls()}

              {/* Doors */}
              {renderDoors()}

              {/* Preview */}
              {renderPreview()}

              {/* Hover point */}
              {renderHoverPoint()}

              {/* Dimensions */}
              <line x1={0} y1={-30} x2={toSvg(geometry.Lx)} y2={-30}
                stroke="#555" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
              <text x={toSvg(geometry.Lx)/2} y={-38} textAnchor="middle" fontSize="11" fill="#555">
                {geometry.Lx.toFixed(2)} m
              </text>

              <line x1={-30} y1={0} x2={-30} y2={toSvg(geometry.Ly)}
                stroke="#555" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
              <text x={-38} y={toSvg(geometry.Ly)/2} textAnchor="middle" fontSize="11" fill="#555"
                transform={`rotate(-90, -38, ${toSvg(geometry.Ly)/2})`}>
                {geometry.Ly.toFixed(2)} m
              </text>
            </svg>
          </div>
        </div>

        {/* Toolbar */}
        <aside className="toolbar">
          {/* Geometry */}
          <div className="tool-group">
            <div className="tool-group-title">Dimensiones Losa</div>
            <div className="input-row">
              <label>Largo X</label>
              <input type="number" value={geometry.Lx} step="0.1" min="3" max="30"
                onChange={e => setGeometry(g => ({ ...g, Lx: parseFloat(e.target.value) || 10 }))} />
              <span className="unit">m</span>
            </div>
            <div className="input-row">
              <label>Largo Y</label>
              <input type="number" value={geometry.Ly} step="0.1" min="3" max="30"
                onChange={e => setGeometry(g => ({ ...g, Ly: parseFloat(e.target.value) || 10 }))} />
              <span className="unit">m</span>
            </div>
            <div className="input-row">
              <label>Espesor</label>
              <input type="number" value={geometry.h} step="1" min="10" max="50"
                onChange={e => setGeometry(g => ({ ...g, h: parseFloat(e.target.value) || 15 }))} />
              <span className="unit">cm</span>
            </div>
          </div>

          {/* Tools */}
          <div className="tool-group">
            <div className="tool-group-title">Herramientas</div>
            {[
              { key: TOOLS.SELECT, label: 'Seleccionar', color: '#1a1a1a' },
              { key: TOOLS.WALL_PERIM, label: 'Muro Perimetral', color: '#e53935' },
              { key: TOOLS.WALL_INNER, label: 'Muro Interno', color: '#1e88e5' },
              { key: TOOLS.DOOR, label: 'Puerta', color: null, border: true },
              { key: TOOLS.BEAM, label: 'Viga Amarre', color: '#4caf50' }
            ].map(tool => (
              <button key={tool.key}
                className={`tool-btn ${currentTool === tool.key ? 'active' : ''}`}
                onClick={() => setCurrentTool(tool.key)}>
                <div className="icon" style={{
                  background: tool.color || '#fff',
                  border: tool.border ? '2px solid #666' : 'none'
                }} />
                {tool.label}
              </button>
            ))}
          </div>

          {/* Wall Properties */}
          <div className="tool-group">
            <div className="tool-group-title">Propiedades Muro</div>
            <div className="input-row">
              <label>Espesor</label>
              <input type="number" value={wallProps.thickness} step="1" min="10" max="30"
                onChange={e => setWallProps(p => ({ ...p, thickness: parseFloat(e.target.value) || 15 }))} />
              <span className="unit">cm</span>
            </div>
            <div className="input-row">
              <label>Altura</label>
              <input type="number" value={wallProps.height} step="0.1" min="2" max="4"
                onChange={e => setWallProps(p => ({ ...p, height: parseFloat(e.target.value) || 2.7 }))} />
              <span className="unit">m</span>
            </div>
            <div className="input-row">
              <label>Densidad</label>
              <input type="number" value={wallProps.density} step="50" min="800" max="2500"
                onChange={e => setWallProps(p => ({ ...p, density: parseFloat(e.target.value) || 1500 }))} />
              <span className="unit">kg/m³</span>
            </div>
          </div>

          {/* Door Properties */}
          {currentTool === TOOLS.DOOR && (
            <div className="tool-group">
              <div className="tool-group-title">Propiedades Puerta</div>
              <div className="input-row">
                <label>Ancho</label>
                <input type="number" value={doorWidth} step="0.05" min="0.6" max="1.5"
                  onChange={e => setDoorWidth(parseFloat(e.target.value) || 0.9)} />
                <span className="unit">m</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="tool-group">
            <div className="tool-group-title">Acciones</div>
            <button className="btn-secondary" onClick={clearAll}>Limpiar Todo</button>
            <button className="btn-primary" onClick={runAnalysis} disabled={loading}>
              {loading ? '⏳ Analizando...' : '🔬 Ejecutar Análisis'}
            </button>
            {error && <div className="error">❌ {error}</div>}
          </div>

          {/* Stats */}
          <div className="tool-group">
            <div className="tool-group-title">Estadísticas</div>
            <div className="stats">
              <div>Muros: <strong>{walls.length}</strong></div>
              <div>Puertas: <strong>{doors.length}</strong></div>
              <div>Escala: <strong>1 m = {scale.toFixed(1)} px</strong></div>
            </div>
          </div>
        </aside>
      </div>

      {/* Results Panel */}
      {results && (
        <div className="results-panel">
          <h3>📊 Resultados del Análisis</h3>
          <div className="results-grid">
            <div className="result-card">
              <div className="result-label">Desplazamiento máx</div>
              <div className="result-value">{results.displacements.w_max_mm.toFixed(2)} mm</div>
            </div>
            <div className="result-card">
              <div className="result-label">Momento Mx máx</div>
              <div className="result-value">{results.moments.Mx_max_kNm_m.toFixed(2)} kN·m/m</div>
            </div>
            <div className="result-card">
              <div className="result-label">Momento My máx</div>
              <div className="result-value">{results.moments.My_max_kNm_m.toFixed(2)} kN·m/m</div>
            </div>
            <div className="result-card">
              <div className="result-label">Cortante Vu máx</div>
              <div className="result-value">{results.shear.Vu_max_kN_m.toFixed(2)} kN/m</div>
            </div>
            <div className="result-card">
              <div className="result-label">φVc</div>
              <div className="result-value">{results.shear.phiVc_kN_m.toFixed(1)} kN/m</div>
            </div>
            <div className="result-card">
              <div className="result-label">Estado Cortante</div>
              <div className={`result-value ${results.shear.shear_ok ? 'ok' : 'fail'}`}>
                {results.shear.shear_ok ? '✓ CUMPLE' : '✗ NO CUMPLE'}
              </div>
            </div>
          </div>

          {/* Band Table */}
          <div className="band-table">
            <h4>Bandas de Refuerzo</h4>
            <table>
              <thead>
                <tr>
                  <th>Muro</th>
                  <th>Tipo</th>
                  <th>Ancho</th>
                  <th>Mx diseño</th>
                  <th>My diseño</th>
                  <th>Asx</th>
                  <th>Asy</th>
                  <th>Prop. X</th>
                  <th>Prop. Y</th>
                </tr>
              </thead>
              <tbody>
                {results.bands.map((b, i) => (
                  <tr key={i}>
                    <td>M{i+1}</td>
                    <td><span className={`tag ${b.type}`}>{b.type}</span></td>
                    <td>{b.band_width.toFixed(2)} m</td>
                    <td>{b.Mx_design_kNm_m.toFixed(2)}</td>
                    <td>{b.My_design_kNm_m.toFixed(2)}</td>
                    <td>{b.Asx_cm2_m.toFixed(2)}</td>
                    <td>{b.Asy_cm2_m.toFixed(2)}</td>
                    <td>Ø{b.bar_x.diam_mm} @ {(b.bar_x.sep_m*100).toFixed(0)}cm</td>
                    <td>Ø{b.bar_y.diam_mm} @ {(b.bar_y.sep_m*100).toFixed(0)}cm</td>
                  </tr>
                ))}
                <tr className="min-row">
                  <td colSpan="3">Zona intermedia (mínimo)</td>
                  <td>—</td>
                  <td>—</td>
                  <td>{results.As_min_cm2_m.toFixed(2)}</td>
                  <td>{results.As_min_cm2_m.toFixed(2)}</td>
                  <td colSpan="2">Ø10 @ 15 cm</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Details SVG overlay */}
          {results.svg_details && (
            <div style={{ marginTop: '24px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', fontWeight: 'bold' }}>Detalles Constructivos Transversales (Planos CAD)</h4>
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', overflow: 'auto' }} dangerouslySetInnerHTML={{ __html: results.svg_details }} />
            </div>
          )}

          {/* Settlements */}
          <div className="settlements">
            <h4>Asentamientos Diferenciales</h4>
            <div className="settlement-grid">
              {results.settlements.map((s, i) => (
                <div key={i} className={`settlement-item ${s.ok ? 'ok' : 'fail'}`}>
                  <div>Muro {i+1} ({s.type})</div>
                  <div>Δw = {s.delta_w_mm.toFixed(2)} mm</div>
                  <div>L/Δ = {s.ratio.toFixed(0)} {s.ok ? '✓' : '✗'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

