export const isBlankComponentRow = (row) => {
  if (!row) return true;
  const codigo = String(row.codigo ?? row.CodIns ?? '').trim().toLowerCase();
  const descripcion = String(row.descripcion ?? row.Descri ?? '').trim().toLowerCase();
  if (codigo === 's/c' && (descripcion === 'nuevo ítem' || descripcion === 'nuevo item')) {
    return true;
  }
  return !codigo && !descripcion;
};

export const filterBlankComponentRows = (rows) =>
  (Array.isArray(rows) ? rows : []).filter((row) => !isBlankComponentRow(row));
