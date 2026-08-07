import React from 'react';

const APUTable = ({ title, columns, data, icon: Icon, emptyMessage = 'No hay datos' }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        {Icon && <Icon className="text-blue-600 text-xl" />}
        <h3 className="font-semibold text-gray-800 m-0">{title}</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-100">
              {columns.map((col, index) => (
                <th 
                  key={index} 
                  className={`py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data && data.length > 0 ? (
              data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-blue-50/50 transition-colors duration-150">
                  {columns.map((col, colIndex) => (
                    <td 
                      key={colIndex} 
                      className={`py-3 px-6 text-sm text-gray-600 ${col.align === 'right' ? 'text-right font-medium' : ''}`}
                    >
                      {col.render ? col.render(row[col.accessor], row) : row[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-gray-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default APUTable;
