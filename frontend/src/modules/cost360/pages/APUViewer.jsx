import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader, Package, Wrench, Users, Calculator, Printer, FileSpreadsheet } from 'lucide-react';
import cost360Service from '../services/cost360Service';
import PrintAPUModal from '../../../components/PrintAPUModal';
import PrintAPULayout from '../../../components/PrintAPULayout';

export default function APUViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState(null);

  useEffect(() => {
    const fetchAPU = async () => {
      try {
        setLoading(true);
        const apuData = await cost360Service.fetchApuDetails(id);
        setData(apuData);
      } catch (err) {
        console.error("Error loading APU details:", err);
        setError("Error loading APU details");
      } finally {
        setLoading(false);
      }
    };
    fetchAPU();
  }, [id]);

  useEffect(() => {
    if (printOptions) {
      setTimeout(() => {
        window.print();
        setPrintOptions(null);
        setPrintModalOpen(false);
      }, 300);
    }
  }, [printOptions]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (error || !data || !data.partida) {
    return (
      <div className="text-center p-8 text-red-500 bg-red-50 rounded-xl border border-red-200 m-6">
        {error || "APU not found"}
      </div>
    );
  }

  const { partida, materiales = [], equipos = [], mano_obra = [] } = data;

  const rendimiento = partida.RenPar || 1;
  const adminPercent = 15;
  const utilPercent = 10;
  const fcasFactor = 9.88; 

  const calculateMaterialTotal = () => materiales.reduce((acc, item) => acc + (item.subtotal || 0), 0);
  const calculateEquipmentTotalDay = () => equipos.reduce((acc, item) => acc + (item.subtotal || 0), 0);
  const calculateLaborTotalJornalDay = () => mano_obra.reduce((acc, item) => acc + (item.tot_jornal || 0), 0);
  const calculateLaborTotalBonoDay = () => mano_obra.reduce((acc, item) => acc + (item.tot_bono || 0), 0);
  
  const calculateLaborTotalDay = () => {
    const totalJornal = calculateLaborTotalJornalDay();
    const totalFCAS = totalJornal * fcasFactor;
    const totalBono = calculateLaborTotalBonoDay();
    return totalJornal + totalFCAS + totalBono;
  };

  const calculateDirectCost = () => {
    const mat = calculateMaterialTotal();
    const eq = calculateEquipmentTotalDay() / rendimiento;
    const lab = calculateLaborTotalDay() / rendimiento;
    return mat + eq + lab;
  };

  const subtotalA = calculateDirectCost();
  const adminCost = subtotalA * (adminPercent / 100);
  const subtotalB = subtotalA + adminCost;
  const utilCost = subtotalB * (utilPercent / 100);
  const unitPrice = subtotalB + utilCost;

  const handleExportToExcel = () => {
    try {
      // Generar SpreadsheetML con fórmulas similares al archivo de muestra
      const formatCurrency = (val) => val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      let xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>CostBase</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
  <WindowHeight>12000</WindowHeight>
  <WindowWidth>16000</WindowWidth>
  <WindowTopX>0</WindowTopX>
  <WindowTopY>0</WindowTopY>
  <ProtectStructure>False</ProtectStructure>
  <ProtectWindows>False</ProtectWindows>
 </ExcelWorkbook>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#4CAF50" ss:Pattern="Solid"/>
   <Font ss:Color="#FFFFFF"/>
  </Style>
  <Style ss:ID="SectionHeader">
   <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1"/>
   <Interior ss:Color="#FFA726" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="Total">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#E8F5E9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="APU">
  <Table ss:ExpandedColumnCount="8" ss:ExpandedRowCount="${materiales.length + equipos.length + mano_obra.length + 20}" x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="15">
   <Column ss:Width="50"/>
   <Column ss:Width="300"/>
   <Column ss:Width="60"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Row ss:Height="30">
    <Cell ss:MergeAcross="7"><Data ss:Type="String">ANÁLISIS DE PRECIO UNITARIO</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="7"><Data ss:Type="String">Obra: ${partida.Descri || 'N/A'}</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">Código:</Data></Cell>
    <Cell><Data ss:Type="String">${partida.CovPar || partida.CodPar}</Data></Cell>
    <Cell><Data ss:Type="String">Unidad:</Data></Cell>
    <Cell><Data ss:Type="String">${partida.UniPar}</Data></Cell>
    <Cell><Data ss:Type="String">Rendimiento:</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${rendimiento}</Data></Cell>
   </Row>
   <Row ss:Height="20"/>`;
      
      let currentRow = 5;
      
      // MATERIALES
      xml += `
   <Row ss:StyleID="SectionHeader">
    <Cell ss:MergeAcross="7"><Data ss:Type="String">1. MATERIALES</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">No.</Data></Cell>
    <Cell><Data ss:Type="String">Descripción</Data></Cell>
    <Cell><Data ss:Type="String">Und.</Data></Cell>
    <Cell><Data ss:Type="String">Cant.</Data></Cell>
    <Cell><Data ss:Type="String">Desp.</Data></Cell>
    <Cell><Data ss:Type="String">Precio</Data></Cell>
    <Cell><Data ss:Type="String">Total</Data></Cell>
   </Row>`;
      
      currentRow += 2;
      const matStartRow = currentRow;
      materiales.forEach((m, i) => {
        const row = currentRow + i;
        xml += `
   <Row>
    <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
    <Cell><Data ss:Type="String">${m.Descri || ''}</Data></Cell>
    <Cell><Data ss:Type="String">${m.UniPar || ''}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.Cant || 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.Desperdicio || 0}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${m.Precio || 0}</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=ROUND((RC[-1]*RC[-3])*((RC[-2]/100)+1),2)"><Data ss:Type="Number">${m.subtotal || 0}</Data></Cell>
   </Row>`;
      });
      
      currentRow += materiales.length;
      const matEndRow = currentRow;
      xml += `
   <Row ss:StyleID="Total">
    <Cell ss:MergeAcross="5"><Data ss:Type="String">Total Materiales:</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=SUM(R[${matEndRow - matStartRow}]C:R[-1]C)"><Data ss:Type="Number">${calculateMaterialTotal()}</Data></Cell>
   </Row>`;
      
      currentRow++;
      
      // EQUIPOS
      xml += `
   <Row ss:Height="10"/>
   <Row ss:StyleID="SectionHeader">
    <Cell ss:MergeAcross="7"><Data ss:Type="String">2. EQUIPOS</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">No.</Data></Cell>
    <Cell><Data ss:Type="String">Descripción</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="String">Cant.</Data></Cell>
    <Cell><Data ss:Type="String">Cop/Dep</Data></Cell>
    <Cell><Data ss:Type="String">Precio</Data></Cell>
    <Cell><Data ss:Type="String">Total</Data></Cell>
   </Row>`;
      
      currentRow += 2;
      const eqStartRow = currentRow;
      equipos.forEach((e, i) => {
        const row = currentRow + i;
        xml += `
   <Row>
    <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
    <Cell><Data ss:Type="String">${e.Descri || ''}</Data></Cell>
    <Cell><Data ss:Type="String"></Data></Cell>
    <Cell><Data ss:Type="Number">${e.Cant || 0}</Data></Cell>
    <Cell><Data ss:Type="Number">${e.CopDep || 0}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${e.Precio || 0}</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=ROUND((RC[-1]*RC[-3])*(RC[-2]),2)"><Data ss:Type="Number">${e.subtotal || 0}</Data></Cell>
   </Row>`;
      });
      
      currentRow += equipos.length;
      const eqEndRow = currentRow;
      xml += `
   <Row ss:StyleID="Total">
    <Cell ss:MergeAcross="5"><Data ss:Type="String">Total Equipos:</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=SUM(R[${eqEndRow - eqStartRow}]C:R[-1]C)"><Data ss:Type="Number">${calculateEquipmentTotalDay()}</Data></Cell>
   </Row>`;
      
      currentRow++;
      
      // MANO DE OBRA
      xml += `
   <Row ss:Height="10"/>
   <Row ss:StyleID="SectionHeader">
    <Cell ss:MergeAcross="7"><Data ss:Type="String">3. MANO DE OBRA</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">No.</Data></Cell>
    <Cell><Data ss:Type="String">Descripción</Data></Cell>
    <Cell><Data ss:Type="String">Cant.</Data></Cell>
    <Cell><Data ss:Type="String">Jornal</Data></Cell>
    <Cell><Data ss:Type="String">Bono</Data></Cell>
    <Cell><Data ss:Type="String">Total Jornal</Data></Cell>
    <Cell><Data ss:Type="String">Total Bono</Data></Cell>
   </Row>`;
      
      currentRow += 2;
      const moStartRow = currentRow;
      mano_obra.forEach((mo, i) => {
        const row = currentRow + i;
        xml += `
   <Row>
    <Cell><Data ss:Type="Number">${i + 1}</Data></Cell>
    <Cell><Data ss:Type="String">${mo.Descri || ''}</Data></Cell>
    <Cell><Data ss:Type="Number">${mo.Cant || 0}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${mo.Jornal || 0}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${mo.Bono || 0}</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=RC[-3]*RC[-2]"><Data ss:Type="Number">${mo.tot_jornal || 0}</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=RC[-4]*RC[-3]"><Data ss:Type="Number">${mo.tot_bono || 0}</Data></Cell>
   </Row>`;
      });
      
      currentRow += mano_obra.length;
      const moEndRow = currentRow;
      xml += `
   <Row ss:StyleID="Total">
    <Cell ss:MergeAcross="4"><Data ss:Type="String">Total Mano de Obra:</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=SUM(R[${moEndRow - moStartRow}]C[-1]:R[-1]C[-1])"><Data ss:Type="Number">${calculateLaborTotalJornalDay()}</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=SUM(R[${moEndRow - moStartRow}]C:R[-1]C)"><Data ss:Type="Number">${calculateLaborTotalBonoDay()}</Data></Cell>
   </Row>`;
      
      currentRow++;
      
      // RESUMEN
      xml += `
   <Row ss:Height="20"/>
   <Row ss:StyleID="SectionHeader">
    <Cell ss:MergeAcross="7"><Data ss:Type="String">RESUMEN</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="5"><Data ss:Type="String">Costo Directo:</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=R[${matEndRow}]C+R[${eqEndRow}]C+R[${moEndRow}]C"><Data ss:Type="Number">${subtotalA}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="5"><Data ss:Type="String">Administración y Gastos (${adminPercent}%):</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=R[-1]C*${adminPercent/100}"><Data ss:Type="Number">${adminCost}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="5"><Data ss:Type="String">Subtotal B:</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=R[-2]C+R[-1]C"><Data ss:Type="Number">${subtotalB}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="5"><Data ss:Type="String">Imprevisto y Utilidad (${utilPercent}%):</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=R[-1]C*${utilPercent/100}"><Data ss:Type="Number">${utilCost}</Data></Cell>
   </Row>
   <Row ss:StyleID="Total">
    <Cell ss:MergeAcross="5"><Data ss:Type="String">PRECIO UNITARIO FINAL:</Data></Cell>
    <Cell ss:StyleID="Currency" ss:Formula="=R[-2]C+R[-1]C"><Data ss:Type="Number">${unitPrice}</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;
      
      // Crear blob y descargar
      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `APU_${partida.CovPar || partida.CodPar}.xls`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('APU exportado exitosamente con fórmulas');
    } catch (error) {
      console.error('Error al exportar APU:', error);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto min-h-screen pb-20 print:p-0 print:m-0 print:max-w-none print:bg-white print:w-full">
      {printOptions && (
        <PrintAPULayout 
          partida={partida} 
          materiales={materiales} 
          equipos={equipos} 
          mano_obra={mano_obra} 
          options={printOptions} 
        />
      )}
      
      {printModalOpen && (
        <PrintAPUModal 
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)} 
          onPrint={(options) => setPrintOptions(options)} 
        />
      )}
      
      <div className="print:hidden">
        {/* TOOLBAR */}
        <div className="flex items-center justify-between mb-4 sticky top-0 z-30 bg-gray-50/95 backdrop-blur py-3 px-4 md:px-6 border-b border-gray-200/50 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/cost360')}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shrink-0 shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <Calculator size={16} className="text-blue-500" /> ANÁLISIS DE PRECIO UNITARIO
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPrintModalOpen(true)}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-blue-600 transition-colors shadow-sm flex items-center gap-2"
              title="Imprimir"
            >
              <Printer size={20} />
            </button>
            <button 
              onClick={() => handleExportToExcel()}
              className="p-2 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 hover:text-green-600 transition-colors shadow-sm flex items-center gap-2"
              title="Exportar a Excel"
            >
              <FileSpreadsheet size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* MAPREX STYLE TOP HEADER */}
      <div className="bg-white border-2 border-slate-200 rounded-xl shadow-sm mb-6 overflow-hidden">
        {/* Info row */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <span className="block text-xs font-bold text-slate-400 uppercase">Referencia / Código</span>
            <span className="text-sm font-mono font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
              {partida.CovPar || partida.CodPar}
            </span>
          </div>
          <div className="md:col-span-3">
            <span className="block text-xs font-bold text-slate-400 uppercase">Descripción</span>
            <span className="text-sm font-medium text-slate-800 leading-tight">
              {partida.Descri}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap border-b border-slate-200 bg-white">
          <div className="flex-1 p-3 border-r border-slate-100 min-w-[120px]">
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Unidad</span>
            <span className="text-sm font-bold text-slate-700">{partida.UniPar}</span>
          </div>
          <div className="flex-1 p-3 border-r border-slate-100 min-w-[120px]">
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Cantidad</span>
            <span className="text-sm font-bold text-slate-700">1</span>
          </div>
          <div className="flex-1 p-3 border-r border-slate-100 min-w-[150px] bg-amber-50/30">
            <span className="block text-xs font-bold text-amber-700/70 uppercase mb-1">Rendimiento</span>
            <span className="block w-full text-lg font-bold text-amber-900">
              {rendimiento.toLocaleString('es-VE')}
            </span>
          </div>
          <div className="flex-1 p-3 min-w-[150px] bg-blue-50/50">
            <span className="block text-xs font-bold text-blue-500 uppercase mb-1">Precio Unitario (USD)</span>
            <span className="text-lg font-black text-blue-700">
              {unitPrice.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
        </div>
      </div>

      {/* SECTIONS */}
      <div className="space-y-6">
        
        {/* 1. MATERIALES */}
        <div className="bg-white border border-slate-400 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-400 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Package className="text-orange-600" size={18} />
              <h3 className="font-bold text-orange-800 text-sm tracking-wide">1. MATERIALES ( {materiales.length} )</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="p-2 w-24 border-r border-slate-200">Ref. / Código</th>
                  <th className="p-2 border-r border-slate-200">Descripción</th>
                  <th className="p-2 w-16 text-center border-r border-slate-200">Und.</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Cant.</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Desp. %</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Precio</th>
                  <th className="p-2 w-32 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {materiales.map(mat => (
                  <tr key={mat.id || mat.codigo} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2 border-r border-slate-200 font-mono text-xs">{mat.codigo}</td>
                    <td className="p-2 border-r border-slate-200 text-xs">{mat.descripcion}</td>
                    <td className="p-2 border-r border-slate-200 text-center text-xs">{mat.unidad}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                      {mat.cantidad}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                      {mat.desperdicio || 0}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                      {mat.precio_unitario?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 text-xs">
                      {mat.subtotal?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                  </tr>
                ))}
                {materiales.length === 0 && (
                  <tr><td colSpan="7" className="p-4 text-center text-slate-400 text-xs">Sin materiales</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-300 flex justify-end items-center gap-4">
            <span className="text-xs font-bold text-slate-600 uppercase">Total Materiales:</span>
            <span className="text-sm font-black text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded min-w-[120px] text-right">
              {calculateMaterialTotal().toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
            </span>
          </div>
        </div>

        {/* 2. EQUIPOS */}
        <div className="bg-white border border-slate-400 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-400 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Wrench className="text-indigo-600" size={18} />
              <h3 className="font-bold text-indigo-800 text-sm tracking-wide">2. EQUIPOS ( {equipos.length} )</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="p-2 w-24 border-r border-slate-200">Ref. / Código</th>
                  <th className="p-2 border-r border-slate-200">Descripción</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Cant.</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">COP/Dep/Al</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Precio</th>
                  <th className="p-2 w-32 text-right">Total Día</th>
                </tr>
              </thead>
              <tbody>
                {equipos.map(eq => (
                  <tr key={eq.id || eq.codigo} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2 border-r border-slate-200 font-mono text-xs">{eq.codigo}</td>
                    <td className="p-2 border-r border-slate-200 text-xs">{eq.descripcion}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                      {eq.cantidad}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                      {eq.depreciacion ?? 1}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                      {eq.precio_unitario?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                    <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 text-xs">
                      {eq.subtotal?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                    </td>
                  </tr>
                ))}
                {equipos.length === 0 && (
                  <tr><td colSpan="6" className="p-4 text-center text-slate-400 text-xs">Sin equipos</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-300 flex justify-end items-center gap-4">
            <span className="text-xs font-bold text-slate-600 uppercase">Total Equipos (Día):</span>
            <span className="text-sm font-black text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded min-w-[120px] text-right">
              {calculateEquipmentTotalDay().toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
            </span>
          </div>
        </div>

        {/* 3. MANO DE OBRA */}
        <div className="bg-white border border-slate-400 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-400 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="text-teal-600" size={18} />
              <h3 className="font-bold text-teal-800 text-sm tracking-wide">3. MANO DE OBRA ( {mano_obra.length} )</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-xs font-bold text-slate-600">
                  <th className="p-2 w-24 border-r border-slate-200">Ref. / Código</th>
                  <th className="p-2 border-r border-slate-200">Descripción</th>
                  <th className="p-2 w-24 text-right border-r border-slate-200">Cuadrilla</th>
                  <th className="p-2 w-28 text-right border-r border-slate-200">Jornal</th>
                  <th className="p-2 w-28 text-right border-r border-slate-200">Bono</th>
                  <th className="p-2 w-32 text-right border-r border-slate-200">Total Jornal</th>
                  <th className="p-2 w-32 text-right">Total Bono</th>
                </tr>
              </thead>
              <tbody>
                {mano_obra.map(lab => {
                  return (
                    <tr key={lab.id || lab.codigo} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 border-r border-slate-200 font-mono text-xs">{lab.codigo}</td>
                      <td className="p-2 border-r border-slate-200 text-xs">{lab.descripcion}</td>
                      <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                        {lab.cantidad}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                        {lab.jornal?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-medium text-xs">
                        {lab.bono?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                      <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 border-r border-slate-200 text-xs">
                        {lab.tot_jornal?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                      <td className="p-2 text-right font-semibold text-slate-700 bg-slate-50 text-xs">
                        {lab.tot_bono?.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>
                    </tr>
                  )
                })}
                {mano_obra.length === 0 && (
                  <tr><td colSpan="7" className="p-4 text-center text-slate-400 text-xs">Sin mano de obra</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-4 border-t border-slate-300">
            <div className="flex flex-col gap-2 items-end">
              <div className="flex items-center gap-4 w-full md:w-1/2 justify-between">
                <span className="text-xs font-bold text-slate-600">Total Jornal:</span>
                <span className="text-sm font-semibold text-slate-700">{calculateLaborTotalJornalDay().toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              <div className="flex items-center gap-4 w-full md:w-1/2 justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                  <span className="bg-teal-100 text-teal-800 px-1 border border-teal-300 rounded text-[10px]">{fcasFactor * 100}%</span>
                  F.C.A.S / Prestaciones Sociales:
                </span>
                <span className="text-sm font-semibold text-slate-700">{(calculateLaborTotalJornalDay() * fcasFactor).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              <div className="flex items-center gap-4 w-full md:w-1/2 justify-between">
                <span className="text-xs font-bold text-slate-600">Total Bono:</span>
                <span className="text-sm font-semibold text-slate-700">{calculateLaborTotalBonoDay().toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>
              <div className="flex items-center gap-4 w-full md:w-1/2 justify-between mt-2 pt-2 border-t-2 border-slate-300">
                <span className="text-sm font-bold text-slate-800 uppercase">Total Mano de Obra (Día):</span>
                <span className="text-base font-black text-slate-800 bg-white border border-slate-400 px-3 py-1 rounded min-w-[120px] text-right shadow-sm">
                  {calculateLaborTotalDay().toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SUMMARY BLOCK (Maprex Style) */}
        <div className="flex justify-end mt-8">
          <div className="w-full md:w-[450px] bg-slate-50 border border-slate-300 shadow-md p-1">
            <table className="w-full text-xs font-bold text-slate-700 border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-2 uppercase w-[250px]">Costo Directo Sub-Total "A"</td>
                  <td className="p-2 text-right bg-white font-mono text-sm border-l border-slate-200 shadow-inner">
                    {subtotalA.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
                <tr className="border-b border-slate-200 text-slate-500">
                  <td className="p-2 uppercase flex justify-between items-center">
                    <span>Administración e Imprevistos</span>
                    <span className="text-[10px] bg-slate-200 px-1 rounded">{adminPercent}%</span>
                  </td>
                  <td className="p-2 text-right font-mono border-l border-slate-200 bg-slate-100">
                    {adminCost.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="p-2 uppercase">Sub-Total "B"</td>
                  <td className="p-2 text-right bg-white font-mono text-sm border-l border-slate-200 shadow-inner">
                    {subtotalB.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
                <tr className="border-b border-slate-200 text-slate-500">
                  <td className="p-2 uppercase flex justify-between items-center">
                    <span>Utilidad</span>
                    <span className="text-[10px] bg-slate-200 px-1 rounded">{utilPercent}%</span>
                  </td>
                  <td className="p-2 text-right font-mono border-l border-slate-200 bg-slate-100">
                    {utilCost.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
                <tr className="bg-blue-600 text-white shadow-sm">
                  <td className="p-3 uppercase text-sm">Precio Unitario</td>
                  <td className="p-3 text-right font-mono text-lg font-black border-l border-blue-500 shadow-inner">
                    {unitPrice.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
