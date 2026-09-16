import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Key, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Eye, 
  EyeOff, 
  Sparkles,
  Server,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../../lib/apiHelper';
import GlassCard from '../../../../components/shared/GlassCard';

const PROVIDER_PRESETS = {
  gemini: {
    label: 'Google Gemini',
    defaultModel: 'gemini-2.0-flash',
    suggestedModels: [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-pro-exp-02-05'
    ],
    placeholder: 'AIzaSy...',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    iconColor: 'text-blue-600',
    borderHighlight: 'border-blue-500/20'
  },
  openai: {
    label: 'OpenAI GPT',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-3.5-turbo'
    ],
    placeholder: 'sk-proj-...',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    iconColor: 'text-emerald-600',
    borderHighlight: 'border-emerald-500/20'
  },
  groq: {
    label: 'Groq Cloud',
    defaultModel: 'llama-3.3-70b-versatile',
    suggestedModels: [
      'llama-3.3-70b-versatile',
      'deepseek-r1-distill-llama-70b',
      'mixtral-8x7b-32768'
    ],
    placeholder: 'gsk_...',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
    iconColor: 'text-amber-600',
    borderHighlight: 'border-amber-500/20'
  },
  anthropic: {
    label: 'Anthropic Claude',
    defaultModel: 'claude-3-5-sonnet-20241022',
    suggestedModels: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ],
    placeholder: 'sk-ant-...',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    iconColor: 'text-purple-600',
    borderHighlight: 'border-purple-500/20'
  },
  custom: {
    label: 'Personalizado / Local',
    defaultModel: 'custom-model',
    suggestedModels: ['custom-model'],
    placeholder: 'sk-...',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    iconColor: 'text-slate-600',
    borderHighlight: 'border-slate-500/20'
  }
};

const INITIAL_FORM_STATE = {
  provider_key: 'gemini',
  display_name: 'Google Gemini Pro / Flash',
  model_name: 'gemini-2.0-flash',
  api_key: '',
  base_url: '',
  priority: 1,
  use_case: 'all',
  is_active: true
};

const KeyIATab = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingProviderId, setEditingProviderId] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiGet('/llm/keys');
      if (response.ok) {
        const data = await response.json();
        // Ordenar por prioridad ascendente (1 primero)
        setProviders(data.sort((a, b) => a.priority - b.priority));
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.detail || 'Error al cargar las llaves de IA');
      }
    } catch (error) {
      console.error('Error fetching LLM keys:', error);
      toast.error('Error de red al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingProviderId(null);
    setFormData(INITIAL_FORM_STATE);
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (provider) => {
    setModalMode('edit');
    setEditingProviderId(provider.id);
    setFormData({
      provider_key: provider.provider_key,
      display_name: provider.display_name,
      model_name: provider.model_name,
      api_key: '', // Vacío por seguridad; solo si escribe algo se sobreescribirá
      base_url: provider.base_url || '',
      priority: provider.priority || 1,
      use_case: provider.use_case || 'all',
      is_active: provider.is_active
    });
    setShowApiKey(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProviderId(null);
    setFormData(INITIAL_FORM_STATE);
    setShowApiKey(false);
  };

  const handleProviderKeyChange = (selectedKey) => {
    const preset = PROVIDER_PRESETS[selectedKey] || PROVIDER_PRESETS.custom;
    setFormData((prev) => ({
      ...prev,
      provider_key: selectedKey,
      display_name: preset.label,
      model_name: preset.defaultModel
    }));
  };

  const handleToggleActive = async (provider) => {
    const updatedStatus = !provider.is_active;
    // Actualización optimista
    setProviders((prev) =>
      prev.map((p) => (p.id === provider.id ? { ...p, is_active: updatedStatus } : p))
    );

    try {
      const response = await apiPut(`/llm/keys/${provider.id}`, { is_active: updatedStatus });
      if (!response.ok) {
        throw new Error('No se pudo actualizar el estado');
      }
      toast.success(`Proveedor ${updatedStatus ? 'activado' : 'desactivado'}`);
    } catch (error) {
      console.error('Error toggling provider status:', error);
      toast.error('Error al actualizar el estado del proveedor');
      // Revertir optimismo
      setProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? { ...p, is_active: !updatedStatus } : p))
      );
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!formData.display_name.trim()) {
      toast.error('El nombre del proveedor es obligatorio');
      return;
    }
    if (!formData.model_name.trim()) {
      toast.error('El modelo es obligatorio');
      return;
    }
    if (modalMode === 'create' && !formData.api_key.trim()) {
      toast.error('La API Key es obligatoria al registrar un proveedor');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const payload = {
          provider_key: formData.provider_key,
          display_name: formData.display_name.trim(),
          model_name: formData.model_name.trim(),
          api_key: formData.api_key.trim(),
          base_url: formData.base_url.trim() ? formData.base_url.trim() : null,
          priority: Number(formData.priority) || 1,
          use_case: formData.use_case || 'all',
          is_active: formData.is_active
        };
        const response = await apiPost('/llm/keys', payload);
        if (response.ok) {
          toast.success('Proveedor y API Key guardados con cifrado seguro');
          handleCloseModal();
          fetchProviders();
        } else {
          const err = await response.json().catch(() => ({}));
          toast.error(err.detail || 'Error al guardar la API Key');
        }
      } else {
        const payload = {
          provider_key: formData.provider_key,
          display_name: formData.display_name.trim(),
          model_name: formData.model_name.trim(),
          base_url: formData.base_url.trim() ? formData.base_url.trim() : null,
          priority: Number(formData.priority) || 1,
          use_case: formData.use_case || 'all',
          is_active: formData.is_active
        };
        if (formData.api_key.trim()) {
          payload.api_key = formData.api_key.trim();
        }
        const response = await apiPut(`/llm/keys/${editingProviderId}`, payload);
        if (response.ok) {
          toast.success('Proveedor actualizado exitosamente');
          handleCloseModal();
          fetchProviders();
        } else {
          const err = await response.json().catch(() => ({}));
          toast.error(err.detail || 'Error al actualizar el proveedor');
        }
      }
    } catch (error) {
      console.error('Error saving provider:', error);
      toast.error('Error al procesar la solicitud con el servidor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (provider) => {
    toast((t) => (
      <div className="flex flex-col gap-3 min-w-[300px]">
        <div>
          <p className="font-bold text-slate-800 text-sm m-0">¿Eliminar API Key de IA?</p>
          <p className="text-xs text-slate-600 mt-1 mb-0">
            Se eliminarán las credenciales de <strong>{provider.display_name}</strong> permanentemente de la base de datos.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                const res = await apiDelete(`/llm/keys/${provider.id}`);
                if (res.ok) {
                  toast.success('Proveedor eliminado');
                  fetchProviders();
                } else {
                  toast.error('No se pudo eliminar el proveedor');
                }
              } catch (err) {
                console.error('Error deleting provider:', err);
                toast.error('Error de conexión');
              }
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Sí, eliminar
          </button>
        </div>
      </div>
    ), { duration: 6000 });
  };

  const handleTestConnection = async (provider) => {
    setTestingId(provider.id);
    setTestResults((prev) => ({
      ...prev,
      [provider.id]: { loading: true }
    }));

    try {
      const response = await apiPost(`/llm/keys/${provider.id}/test`, {});
      const data = await response.json();

      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          loading: false,
          success: data.success,
          latency_ms: data.latency_ms,
          message: data.message,
          preview_response: data.preview_response
        }
      }));

      if (data.success) {
        toast.success(`⚡ Conexión exitosa con ${provider.display_name} (${data.latency_ms} ms)`, {
          icon: '🟢'
        });
      } else {
        toast.error(`Error de prueba: ${data.message || 'Falló la conexión'}`, {
          duration: 5000
        });
      }
    } catch (error) {
      console.error('Error testing LLM key:', error);
      setTestResults((prev) => ({
        ...prev,
        [provider.id]: {
          loading: false,
          success: false,
          message: 'Error al enviar petición de prueba'
        }
      }));
      toast.error('Error al probar la conexión con el servidor');
    } finally {
      setTestingId(null);
    }
  };

  const activeCount = providers.filter((p) => p.is_active).length;
  const primaryProvider = providers.find((p) => p.is_active);

  return (
    <div className="flex flex-col gap-6 max-h-full overflow-y-auto pr-1">
      {/* HEADER */}
      <GlassCard className="rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Gestión de API Keys & Proveedores de IA
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configuración centralizada de llaves y modelos para generación de APU, análisis de costos y RAG
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchProviders}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-colors cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refrescar</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Key IA</span>
          </button>
        </div>
      </GlassCard>

      {/* SECURITY BANNER & STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-4 rounded-xl flex items-center gap-3 border border-emerald-500/20 bg-emerald-50/40">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">Cifrado de Alta Seguridad</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Fernet AES-128-CBC + HMAC-SHA256 en base de datos
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-xl flex items-center gap-3 border border-indigo-500/20 bg-indigo-50/40">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">Proveedor Principal Activo</div>
            <div className="text-[11px] text-indigo-600 font-medium mt-0.5">
              {primaryProvider ? `${primaryProvider.display_name} (${primaryProvider.model_name})` : 'Ninguno activo'}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 rounded-xl flex items-center gap-3 border border-slate-200 bg-white/60">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">Proveedores Registrados</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {activeCount} activo{activeCount === 1 ? '' : 's'} de {providers.length} configurado{providers.length === 1 ? '' : 's'}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* PROVIDERS LIST */}
      <GlassCard className="rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Proveedores y Credenciales de IA</h3>
          </div>
          <span className="text-xs text-slate-500">
            Las prioridades más bajas (ej. 1) se evalúan primero en cascada de fallback
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Cargando credenciales de IA...</p>
          </div>
        ) : providers.length === 0 ? (
          <div className="py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Key className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No hay proveedores de IA configurados</h4>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
              Registra tu primera API key de Google Gemini, OpenAI o Groq para comenzar a utilizar las funciones de generación de presupuestos y partidas con IA.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Google Gemini</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {providers.map((provider) => {
              const preset = PROVIDER_PRESETS[provider.provider_key] || PROVIDER_PRESETS.custom;
              const isTesting = testingId === provider.id;
              const testResult = testResults[provider.id];

              return (
                <div
                  key={provider.id}
                  className={`p-4 rounded-xl border bg-white/80 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:shadow-sm ${
                    provider.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50/50'
                  }`}
                >
                  {/* LEFT: Info & Badges */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${preset.badgeColor}`}
                    >
                      <Sparkles className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">
                          {provider.display_name}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${preset.badgeColor}`}
                        >
                          {preset.label}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Prioridad {provider.priority}
                        </span>
                        {provider.use_case && provider.use_case !== 'all' && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {provider.use_case}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <strong>Modelo:</strong> {provider.model_name}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                          <strong>Key:</strong> {provider.api_key_masked || '••••••••'}
                        </span>
                        {provider.base_url && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={provider.base_url}>
                            URL: {provider.base_url}
                          </span>
                        )}
                      </div>

                      {/* Test feedback banner if available */}
                      {testResult && !testResult.loading && (
                        <div
                          className={`mt-2 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                            testResult.success
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-red-50 text-red-800 border border-red-200'
                          }`}
                        >
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          )}
                          <span className="font-medium">
                            {testResult.success
                              ? `Ping exitoso (${testResult.latency_ms} ms)`
                              : `Error: ${testResult.message}`}
                          </span>
                          {testResult.preview_response && (
                            <span className="text-[10px] text-emerald-700 font-mono bg-emerald-100/60 px-1.5 py-0.5 rounded">
                              Resp: &quot;{testResult.preview_response}&quot;
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: Actions */}
                  <div className="flex flex-wrap items-center gap-2 lg:self-center shrink-0">
                    {/* Active toggle button */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(provider)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                        provider.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                      title={provider.is_active ? 'Desactivar proveedor' : 'Activar proveedor'}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          provider.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                      />
                      <span>{provider.is_active ? 'Activo' : 'Inactivo'}</span>
                    </button>

                    {/* Test button */}
                    <button
                      type="button"
                      onClick={() => handleTestConnection(provider)}
                      disabled={isTesting}
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Probar llamada en vivo con la clave almacenada"
                    >
                      {isTesting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      <span>{isTesting ? 'Probando...' : 'Probar'}</span>
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(provider)}
                      className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Editar configuración"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(provider)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar proveedor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* MODAL: ADD / EDIT PROVIDER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {modalMode === 'create' ? 'Registrar Proveedor de IA' : 'Editar Configuración de IA'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Las credenciales serán cifradas antes de guardarse en base de datos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {/* Select Provider */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Proveedor de IA
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['gemini', 'openai', 'groq', 'anthropic'].map((key) => {
                    const preset = PROVIDER_PRESETS[key];
                    const isSelected = formData.provider_key === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleProviderKeyChange(key)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col items-center text-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`text-xs font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre a Mostrar
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Ej: Google Gemini Pro"
                  required
                />
              </div>

              {/* API Key */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    API Key {modalMode === 'edit' && <span className="text-slate-400 font-normal">(Dejar en blanco para mantener la actual)</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showApiKey ? 'Ocultar' : 'Mostrar'}</span>
                  </button>
                </div>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder={
                    PROVIDER_PRESETS[formData.provider_key]?.placeholder || 'Pega tu API Key secreta aquí'
                  }
                  required={modalMode === 'create'}
                />
              </div>

              {/* Model Name & Suggestions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Identificador de Modelo
                </label>
                <input
                  type="text"
                  value={formData.model_name}
                  onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Ej: gemini-2.0-flash"
                  required
                />
                {/* Model chips */}
                {PROVIDER_PRESETS[formData.provider_key]?.suggestedModels?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-400">Sugerencias:</span>
                    {PROVIDER_PRESETS[formData.provider_key].suggestedModels.map((model) => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => setFormData({ ...formData, model_name: model })}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                          formData.model_name === model
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-300 font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Base URL (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Base URL <span className="text-slate-400 font-normal">(Opcional para proxy o endpoint custom)</span>
                </label>
                <input
                  type="url"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="https://..."
                />
              </div>

              {/* Priority, Use Case & Active Switch */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prioridad (1 = Máx)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Caso de Uso
                  </label>
                  <select
                    value={formData.use_case}
                    onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    <option value="all">Global (Todo)</option>
                    <option value="apu_generator">Generador APU</option>
                    <option value="cost_estimation">Estimación Costos</option>
                    <option value="rag_enrichment">RAG / Búsqueda</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">Activo</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalMode === 'create' ? 'Guardar Clave' : 'Actualizar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyIATab;
