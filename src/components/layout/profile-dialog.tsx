'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  User,
  Sparkles,
  Clock,
  Search,
  Calendar,
  CheckCircle2,
  Zap,
  FileText,
  Sliders,
  Shield,
  Layers,
  Wrench,
  X,
  History,
  Tag,
} from 'lucide-react';
import { SYSTEM_UPDATES_DATA, UpdateType } from '@/data/system-updates';
import { Badge } from '@/components/ui/badge';

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const [activeTab, setActiveTab] = useState<'updates' | 'profile' | 'settings' | 'security'>('updates');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<UpdateType | 'all'>('all');

  // Filter updates based on search query and selected type
  const filteredGroups = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return SYSTEM_UPDATES_DATA.map((group) => {
      const filteredItems = group.items.filter((item) => {
        const matchesQuery =
          !query ||
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          (item.tag && item.tag.toLowerCase().includes(query)) ||
          (item.module && item.module.toLowerCase().includes(query));

        const matchesType = selectedType === 'all' || item.type === selectedType;

        return matchesQuery && matchesType;
      });

      return {
        ...group,
        items: filteredItems,
      };
    }).filter((group) => group.items.length > 0);
  }, [searchQuery, selectedType]);

  const totalItemsCount = useMemo(() => {
    return SYSTEM_UPDATES_DATA.reduce((acc, curr) => acc + curr.items.length, 0);
  }, []);

  const getTypeBadge = (type: UpdateType) => {
    switch (type) {
      case 'feature':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Nueva Función
          </span>
        );
      case 'fix':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full">
            <Wrench className="w-3 h-3 text-blue-600" />
            Corrección
          </span>
        );
      case 'improvement':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full">
            <Zap className="w-3 h-3 text-amber-600" />
            Mejora
          </span>
        );
      case 'report':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-full">
            <FileText className="w-3 h-3 text-sky-600" />
            Reporte / PDF
          </span>
        );
      case 'design':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full">
            <Layers className="w-3 h-3 text-purple-600" />
            Diseño
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden bg-slate-50 border-slate-200 shadow-2xl rounded-xl">
        {/* Header with User Info and System Status */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white relative">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-slate-700/80 border-2 border-emerald-500/70 flex items-center justify-center shadow-inner">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div
                  className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900"
                  title="Sistema Activo y Conectado"
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Repuestos Sotomayor
                  </h2>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    v2.4.0
                  </span>
                </div>
                <p className="text-[12px] text-slate-300 flex items-center gap-2 mt-0.5">
                  <span>Administrador del Sistema</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-emerald-400 font-medium">En línea</span>
                </p>
              </div>
            </div>

            {/* Status chip */}
            <div className="hidden sm:flex flex-col items-end">
              <div className="text-[11px] text-slate-400 font-mono">Última compilación</div>
              <div className="text-[12px] text-slate-200 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>20 Oct 2026</span>
              </div>
            </div>
          </div>

          {/* Navigation Bar for tabs (Prepared for future options) */}
          <div className="flex items-center gap-1.5 mt-5 border-t border-slate-700/60 pt-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('updates')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'updates'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <History className="w-3.5 h-3.5 text-emerald-600" />
              <span>Actualizaciones</span>
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                {totalItemsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/40 transition-all opacity-80 cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Mi Perfil</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Próximamente
              </span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/40 transition-all opacity-80 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configuración</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Próximamente
              </span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/40 transition-all opacity-80 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Seguridad & Roles</span>
              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Próximamente
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 md:p-6 max-h-[68vh] overflow-y-auto">
          {activeTab === 'updates' ? (
            <div className="space-y-5">
              {/* Search & Filter Bar */}
              <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar actualización (ej. clutch, pdf, stock, precios)..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => setSelectedType('all')}
                    className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition-colors shrink-0 ${
                      selectedType === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setSelectedType('feature')}
                    className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition-colors shrink-0 ${
                      selectedType === 'feature'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Funciones
                  </button>
                  <button
                    onClick={() => setSelectedType('improvement')}
                    className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition-colors shrink-0 ${
                      selectedType === 'improvement'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Mejoras
                  </button>
                  <button
                    onClick={() => setSelectedType('fix')}
                    className={`px-2.5 py-1 text-[11px] rounded-md font-semibold transition-colors shrink-0 ${
                      selectedType === 'fix'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Correcciones
                  </button>
                </div>
              </div>

              {/* Day-by-Day Updates Timeline */}
              {filteredGroups.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-slate-200/80">
                  <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No se encontraron actualizaciones</p>
                  <p className="text-xs text-slate-400 mt-1">Prueba con otro término de búsqueda o filtro.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredGroups.map((group) => (
                    <div key={group.date} className="relative">
                      {/* Day Header */}
                      <div className="flex items-center gap-2.5 mb-3 sticky top-0 bg-slate-50/95 backdrop-blur-xs py-1 z-10">
                        <div
                          className={`w-3 h-3 rounded-full border-2 ${
                            group.isToday
                              ? 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-500/20'
                              : 'bg-slate-400 border-slate-200'
                          }`}
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xs md:text-sm font-bold text-slate-900 tracking-tight">
                            {group.displayDate}
                          </h3>
                          {group.badge && (
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                                group.isToday
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {group.badge}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            ({group.items.length} cambio{group.items.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>

                      {/* Updates List for this day */}
                      <div className="ml-1.5 pl-4 border-l-2 border-slate-200 space-y-2.5 pb-2">
                        {group.summary && (
                          <p className="text-[11px] text-slate-500 italic pb-0.5">
                            {group.summary}
                          </p>
                        )}

                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getTypeBadge(item.type)}
                                {item.module && (
                                  <span className="text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                    {item.module}
                                  </span>
                                )}
                              </div>
                              {item.tag && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  #{item.tag}
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-slate-900 mb-1 leading-snug">
                              {item.title}
                            </h4>

                            <p className="text-[11.5px] text-slate-600 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Placeholder for future options */
            <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-500">
                {activeTab === 'profile' && <User className="w-6 h-6" />}
                {activeTab === 'settings' && <Sliders className="w-6 h-6" />}
                {activeTab === 'security' && <Shield className="w-6 h-6" />}
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {activeTab === 'profile' && 'Perfil de Usuario'}
                {activeTab === 'settings' && 'Configuración Avanzada'}
                {activeTab === 'security' && 'Gestión de Seguridad y Roles'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Esta sección está preparada y será habilitada en una próxima actualización. Por el momento, puedes consultar el historial diario de actualizaciones en la pestaña correspondiente.
              </p>
              <button
                onClick={() => setActiveTab('updates')}
                className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
              >
                Volver a Actualizaciones
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
