import { Package, Wrench, Users } from 'lucide-react';

/**
 * Configuración compartida de los catálogos de insumos.
 * La usan tanto el modal de búsqueda avanzada como el autocompletado inline.
 */
export const TYPE_CONFIG = {
  materials: {
    title: 'Catálogo de Materiales',
    singular: 'material',
    plural: 'materiales',
    Icon: Package,
    theme: {
      iconBox: 'bg-blue-50 border-blue-200 text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
      focusBorder: 'focus:border-blue-500 focus:ring-blue-100',
      rowHover: 'hover:bg-blue-50/60',
      codeTag: 'text-blue-700 bg-blue-50 border-blue-100',
      button: 'bg-blue-600 hover:bg-blue-700',
      spinner: 'text-blue-600',
      link: 'text-blue-600 hover:text-blue-700',
    },
    placeholder: 'Buscar por código (ej: MAT-CON, MAT-MET) o descripción del material...',
    endpoint: '/cost360/materials',
    mapItem: (mat) => ({
      codigo: mat.ref_code || mat.CodMat || '',
      cod_ins: mat.CodMat || '',
      ref_code: mat.ref_code || '',
      descripcion: mat.Descri || '',
      unidad: mat.UniMat || 'UND',
      precio_unitario: Number(mat.CosMat || 0),
      desperdicio: 5.0,
      cantidad: 1,
    }),
  },
  equipments: {
    title: 'Catálogo de Equipos',
    singular: 'equipo',
    plural: 'equipos',
    Icon: Wrench,
    theme: {
      iconBox: 'bg-indigo-50 border-indigo-200 text-indigo-600',
      badge: 'bg-indigo-100 text-indigo-700',
      focusBorder: 'focus:border-indigo-500 focus:ring-indigo-100',
      rowHover: 'hover:bg-indigo-50/60',
      codeTag: 'text-indigo-700 bg-indigo-50 border-indigo-100',
      button: 'bg-indigo-600 hover:bg-indigo-700',
      spinner: 'text-indigo-600',
      link: 'text-indigo-600 hover:text-indigo-700',
    },
    placeholder: 'Buscar por código (ej: EQU-PES, EQU-LIV) o descripción del equipo...',
    endpoint: '/cost360/equipments',
    mapItem: (eq) => {
      const precio = Number(eq.precio != null ? eq.precio : (eq.CosDia || 0));
      const cosDia = Number(eq.CosDia || 0);
      let deprec = eq.deprec_factor != null ? Number(eq.deprec_factor) : null;
      if ((deprec == null || deprec === 0 || deprec === 1.0) && precio > 0 && cosDia > 0 && precio > cosDia) {
        deprec = Number((cosDia / precio).toFixed(6));
      }
      return {
        codigo: eq.ref_code || eq.CodEqu || '',
        cod_ins: eq.CodEqu || '',
        ref_code: eq.ref_code || '',
        descripcion: eq.Descri || '',
        precio_unitario: precio,
        depreciacion: deprec != null && deprec > 0 ? deprec : 1.0,
        cantidad: 1,
        unidad: 'Día',
      };
    },
  },
  labors: {
    title: 'Catálogo de Mano de Obra',
    singular: 'cargo',
    plural: 'cargos',
    Icon: Users,
    theme: {
      iconBox: 'bg-emerald-50 border-emerald-200 text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-700',
      focusBorder: 'focus:border-emerald-500 focus:ring-emerald-100',
      rowHover: 'hover:bg-emerald-50/60',
      codeTag: 'text-emerald-700 bg-emerald-50 border-emerald-100',
      button: 'bg-emerald-600 hover:bg-emerald-700',
      spinner: 'text-emerald-600',
      link: 'text-emerald-600 hover:text-emerald-700',
    },
    placeholder: 'Buscar por código (ej: MO-OFI, MO-OBR) o cargo (ej: Maestro, Albañil)...',
    endpoint: '/cost360/labors',
    mapItem: (lab) => ({
      codigo: lab.ref_code || lab.CodMan || '',
      cod_ins: lab.CodMan || '',
      ref_code: lab.ref_code || '',
      descripcion: lab.Descri || '',
      jornal: Number(lab.Jornal || 0),
      bono: Number(lab.Bono || 0),
      precio_unitario: Number(lab.Jornal || 0),
      cantidad: 1,
      unidad: 'Día',
    }),
  },
};

export const getCatalogConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.materials;
