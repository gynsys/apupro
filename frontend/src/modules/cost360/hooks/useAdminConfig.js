import { useContext, useCallback } from 'react';
import toast from 'react-hot-toast';
import { SiteConfigContext } from '../../../App';
import { API_URL } from '../../../services/api';

const updateAdminConfig = async (config) => {
  const response = await fetch(`${API_URL}/admin/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('arko_admin_token')}`
    },
    body: JSON.stringify(config)
  });
  if (!response.ok) throw new Error('Failed to update config');
  return response.json();
};

export const useAdminConfig = () => {
  const { config, setConfig } = useContext(SiteConfigContext);

  const toggleGlobalCoded = useCallback(async (isChecked) => {
    const newConfig = { ...config, forceOnlyCodedMaster: isChecked };
    try {
      const result = await updateAdminConfig(newConfig);
      const updatedConfig = result.config || newConfig;
      setConfig(updatedConfig);
      if (window.ARKO_SITE_CONFIG) {
        window.ARKO_SITE_CONFIG = updatedConfig;
      }
      toast.success(isChecked ? "Filtro publico ACTIVADO" : "Filtro publico DESACTIVADO (El publico vera basura)");
      return updatedConfig;
    } catch (err) {
      toast.error("Error al actualizar la configuracion publica");
      throw err;
    }
  }, [config, setConfig]);

  const toggleCategory = useCallback(async (code, isVisible) => {
    const hiddenCategories = config?.hiddenCategories || [];
    let newHidden = [...hiddenCategories];

    if (isVisible) {
      newHidden = newHidden.filter(c => c !== code);
    } else {
      if (!newHidden.includes(code)) {
        newHidden.push(code);
      }
    }

    const newConfig = { ...config, hiddenCategories: newHidden };
    try {
      const result = await updateAdminConfig(newConfig);
      const updatedConfig = result.config || newConfig;
      setConfig(updatedConfig);
      if (window.ARKO_SITE_CONFIG) {
        window.ARKO_SITE_CONFIG = updatedConfig;
      }
      toast.success(`Categoria ${code} ${isVisible ? 'ACTIVADA' : 'OCULTADA'} en el Buscador Publico`);
      return updatedConfig;
    } catch (err) {
      toast.error("Error al actualizar la configuracion de categorias");
      throw err;
    }
  }, [config, setConfig]);

  return {
    config,
    toggleGlobalCoded,
    toggleCategory,
  };
};
