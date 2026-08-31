import React, { useState } from 'react';
import { FiDownload, FiUpload } from 'react-icons/fi';
import GlassCard from '../../../../components/shared/GlassCard';
import BulkPriceModal from '../modals/BulkPriceModal';
import BulkDescModal from '../modals/BulkDescModal';
import CatalogResourceTab from '../CatalogResourceTab';

const CatalogTab = ({ title, resourceType, selectedDatabase, config }) => {
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showDescModal, setShowDescModal] = useState(false);

  return (
    <>
      <GlassCard className="rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 font-medium">
            Actualizacion en masa
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPriceModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <FiDownload size={16} />
              Actualizar Precios
            </button>
            <button
              onClick={() => setShowDescModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
            >
              <FiUpload size={16} />
              Actualizar Descripciones
            </button>
          </div>
        </div>
      </GlassCard>

      <CatalogResourceTab
        key={`${resourceType}-${selectedDatabase}`}
        title={title}
        resourceType={resourceType}
        selectedDatabase={selectedDatabase}
        adminMode={true}
        config={config}
      />

      {showPriceModal && (
        <BulkPriceModal
          onClose={() => setShowPriceModal(false)}
          onSuccess={() => setShowPriceModal(false)}
        />
      )}

      {showDescModal && (
        <BulkDescModal
          onClose={() => setShowDescModal(false)}
          onSuccess={() => setShowDescModal(false)}
        />
      )}
    </>
  );
};

export default CatalogTab;
