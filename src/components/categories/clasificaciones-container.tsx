import { useState } from 'react';
import { CategoryTable } from './category-table';
import { BrandTable } from './brand-table';

export function ClasificacionesContainer() {
  const [activeTab, setActiveTab] = useState<'categories' | 'brands'>('categories');

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="mb-4">
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 shadow-sm w-full max-w-sm">
          <button
            onClick={() => setActiveTab('categories')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
              activeTab === 'categories'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900 hover:bg-slate-200/50'
            } w-1/2`}
          >
            Categorías
          </button>
          <button
            onClick={() => setActiveTab('brands')}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
              activeTab === 'brands'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'hover:text-slate-900 hover:bg-slate-200/50'
            } w-1/2`}
          >
            Marcas
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'categories' ? <CategoryTable /> : <BrandTable />}
      </div>
    </div>
  );
}
