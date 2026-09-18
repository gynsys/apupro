import React, { useState } from 'react';
import { FiUpload } from 'react-icons/fi';
import GlassCard from '../../../../components/shared/GlassCard';
import BulkDescModal from '../modals/BulkDescModal';
import CatalogResourceTab from '../CatalogResourceTab';

const CatalogTab = ({ title, resourceType, selectedDatabase, config }) => {
  const [showDescModal, setShowDescModal] = useState(false);

  // Ensure config is always an object
  const safeConfig = config || {};

  return (
    <>
      <GlassCard className="rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 font-medium">
            Catálogo de {title}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDescModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-[1.02] text-xs"
            >
              <FiUpload size={14} />
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
        config={safeConfig}
      />

      {showDescModal && (
        <BulkDescModal
          resourceType={resourceType}
          selectedDatabase={selectedDatabase}
          title={title}
          onClose={() => setShowDescModal(false)}
          onSuccess={() => setShowDescModal(false)}
        />
      )}
    </>
  );
};

export default CatalogTab;
