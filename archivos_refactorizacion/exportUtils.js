/**
 * Utilidades para exportación de datos.
 */

/**
 * Genera un archivo Excel (.xls) en formato XML Spreadsheet 2003
 * a partir de un array de partidas.
 */
export const generatePartidasExcel = (items) => {
  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="sDesc">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="9" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="sNormal">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="sNumber">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Partidas">
  <Table>
   <Column ss:Width="40"/>
   <Column ss:Width="100"/>
   <Column ss:Width="450"/>
   <Column ss:Width="60"/>
   <Row ss:Height="20">
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">N°</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Código Covenin</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Descripción</Data></Cell>
    <Cell ss:StyleID="sHeader"><Data ss:Type="String">Unidad</Data></Cell>
   </Row>
   ${items.map((item, index) => {
     const descri = (item.Descri || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
     const cov = (item.CovPar || item.CodPar || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     const uni = (item.UniPar || item.Unidad || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
     return `<Row ss:Height="24">
    <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${index + 1}</Data></Cell>
    <Cell ss:StyleID="sNormal"><Data ss:Type="String">${cov}</Data></Cell>
    <Cell ss:StyleID="sDesc"><Data ss:Type="String">${descri}</Data></Cell>
    <Cell ss:StyleID="sNormal"><Data ss:Type="String">${uni}</Data></Cell>
   </Row>`;
   }).join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob(['\uFEFF' + xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Listado_Partidas_${new Date().toISOString().slice(0, 10)}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};