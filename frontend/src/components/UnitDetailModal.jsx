/**
 * UnitDetailModal - Modal de Detalle de Unidad con Checklist de Construcción
 * @version 1.8
 * @date 2026-01-03
 * 
 * Sistema de incidencias con subcategorías y item "General" automático
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const MODAL_VERSION = '1.8';
import {
  X, Save, CheckCircle2, Circle, Clock, AlertTriangle,
  Building2, FileText, Image, Upload, Trash2, Plus, 
  ChevronDown, ChevronRight, Zap, Droplets, Flame, 
  PaintBucket, DoorOpen, Bath, Wrench, Sparkles, 
  ClipboardCheck, Check, Loader2, Edit2, Info,
  Thermometer, Layers, LayoutGrid, Grip, Hammer, 
  ShowerHead, Package, Fence, FileCheck, Square
} from 'lucide-react';

// =============================================
// CONSTANTES - ALINEADAS CON EL BACKEND
// =============================================

// Mapeo de códigos de categoría del backend a iconos y colores
const CATEGORY_CONFIG = {
  // Estructura
  masonry: { name: 'Mampostería', icon: Layers, color: 'amber' },
  plastering: { name: 'Revoque y Enlucido', icon: Square, color: 'orange' },
  // Instalaciones
  electrical: { name: 'Electricidad', icon: Zap, color: 'yellow' },
  plumbing: { name: 'Plomería', icon: Droplets, color: 'blue' },
  gas: { name: 'Gas', icon: Flame, color: 'red' },
  hvac: { name: 'Climatización', icon: Thermometer, color: 'cyan' },
  // Terminaciones
  flooring: { name: 'Pisos', icon: LayoutGrid, color: 'amber' },
  tiling: { name: 'Revestimientos', icon: Grip, color: 'teal' },
  painting: { name: 'Pintura', icon: PaintBucket, color: 'purple' },
  carpentry: { name: 'Carpintería', icon: DoorOpen, color: 'amber' },
  metalwork: { name: 'Herrería', icon: Hammer, color: 'slate' },
  // Baño y cocina
  fixtures: { name: 'Grifería', icon: ShowerHead, color: 'indigo' },
  sanitary: { name: 'Sanitarios', icon: Bath, color: 'sky' },
  countertops: { name: 'Mesada y Bachas', icon: Package, color: 'emerald' },
  // Aberturas
  windows: { name: 'Ventanas', icon: Square, color: 'blue' },
  main_door: { name: 'Puerta Principal', icon: DoorOpen, color: 'rose' },
  // Exteriores
  balcony: { name: 'Balcón/Terraza', icon: Fence, color: 'green' },
  // Final
  final_cleaning: { name: 'Limpieza Final', icon: Sparkles, color: 'violet' },
  final_inspection: { name: 'Inspección Final', icon: ClipboardCheck, color: 'lime' },
  documentation: { name: 'Documentación', icon: FileCheck, color: 'fuchsia' }
};

// Colores para las barras de progreso
const CATEGORY_COLORS = {
  amber: { bg: 'bg-amber-100', fill: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300', accent: 'accent-amber-500' },
  orange: { bg: 'bg-orange-100', fill: 'bg-orange-500', text: 'text-orange-700', border: 'border-orange-300', accent: 'accent-orange-500' },
  yellow: { bg: 'bg-yellow-100', fill: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-300', accent: 'accent-yellow-500' },
  blue: { bg: 'bg-blue-100', fill: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-300', accent: 'accent-blue-500' },
  red: { bg: 'bg-red-100', fill: 'bg-red-500', text: 'text-red-700', border: 'border-red-300', accent: 'accent-red-500' },
  cyan: { bg: 'bg-cyan-100', fill: 'bg-cyan-500', text: 'text-cyan-700', border: 'border-cyan-300', accent: 'accent-cyan-500' },
  teal: { bg: 'bg-teal-100', fill: 'bg-teal-500', text: 'text-teal-700', border: 'border-teal-300', accent: 'accent-teal-500' },
  purple: { bg: 'bg-purple-100', fill: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-300', accent: 'accent-purple-500' },
  slate: { bg: 'bg-slate-100', fill: 'bg-slate-500', text: 'text-slate-700', border: 'border-slate-300', accent: 'accent-slate-500' },
  indigo: { bg: 'bg-indigo-100', fill: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-300', accent: 'accent-indigo-500' },
  sky: { bg: 'bg-sky-100', fill: 'bg-sky-500', text: 'text-sky-700', border: 'border-sky-300', accent: 'accent-sky-500' },
  emerald: { bg: 'bg-emerald-100', fill: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-300', accent: 'accent-emerald-500' },
  rose: { bg: 'bg-rose-100', fill: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-300', accent: 'accent-rose-500' },
  green: { bg: 'bg-green-100', fill: 'bg-green-500', text: 'text-green-700', border: 'border-green-300', accent: 'accent-green-500' },
  violet: { bg: 'bg-violet-100', fill: 'bg-violet-500', text: 'text-violet-700', border: 'border-violet-300', accent: 'accent-violet-500' },
  lime: { bg: 'bg-lime-100', fill: 'bg-lime-500', text: 'text-lime-700', border: 'border-lime-300', accent: 'accent-lime-500' },
  fuchsia: { bg: 'bg-fuchsia-100', fill: 'bg-fuchsia-500', text: 'text-fuchsia-700', border: 'border-fuchsia-300', accent: 'accent-fuchsia-500' }
};

// Estados
const CONSTRUCTION_STATUS = {
  not_started: { label: 'Sin Iniciar', color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'En Construcción', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700' },
  delivered: { label: 'Entregado', color: 'bg-purple-100 text-purple-700' }
};

const SALE_STATUS = {
  available: { label: 'Disponible', color: 'bg-green-100 text-green-700' },
  reserved: { label: 'Reservado', color: 'bg-yellow-100 text-yellow-700' },
  sold: { label: 'Vendido', color: 'bg-blue-100 text-blue-700' },
  rented: { label: 'Alquilado', color: 'bg-purple-100 text-purple-700' },
  unavailable: { label: 'No Disponible', color: 'bg-red-100 text-red-700' }
};

// =============================================
// COMPONENTE: BARRA DE PROGRESO
// =============================================
const ProgressBar = ({ progress, colorScheme = 'blue', size = 'md' }) => {
  const colors = CATEGORY_COLORS[colorScheme] || CATEGORY_COLORS.blue;
  const isComplete = progress >= 100;
  const height = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-5' : 'h-3';
  
  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`flex-1 ${colors.bg} rounded-full ${height} overflow-hidden shadow-inner`}>
        <div 
          className={`${height} rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : colors.fill}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <span className={`text-sm font-bold min-w-[3.5rem] text-right ${isComplete ? 'text-green-600' : colors.text}`}>
        {Math.round(progress)}%
      </span>
    </div>
  );
};

// =============================================
// COMPONENTE: SUBCATEGORÍA ITEM
// =============================================
const SubcategoryItem = ({ 
  item, 
  categoryColor, 
  onProgressChange, 
  onWeightChange,
  onDelete, 
  onEdit,
  isGeneral,
  availableWeight
}) => {
  const colors = CATEGORY_COLORS[categoryColor] || CATEGORY_COLORS.blue;
  const [localProgress, setLocalProgress] = useState(item.progress_percentage || 0);
  const debounceRef = useRef(null);
  
  // Sincronizar con prop
  useEffect(() => {
    setLocalProgress(item.progress_percentage || 0);
  }, [item.progress_percentage]);

  const handleProgressChange = (value) => {
    setLocalProgress(value);
    // Debounce para no saturar el servidor
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onProgressChange(item.id, value);
    }, 300);
  };

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      isGeneral 
        ? 'bg-slate-50/50 border-dashed border-slate-300' 
        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
    }`}>
      <div className="flex items-start gap-4">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${isGeneral ? 'text-slate-500 italic' : 'text-slate-800'}`}>
              {item.name}
            </span>
            {isGeneral && (
              <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                Auto-compensado
              </span>
            )}
          </div>
          
          {/* Incidencia */}
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${colors.bg} ${colors.text}`}>
              Incidencia: {item.weight || 0}%
            </span>
            <span className="text-xs text-slate-400">
              Aporta {Math.round(((item.weight || 0) * localProgress) / 100)}% al total
            </span>
          </div>
          
          {item.notes && (
            <p className="text-xs text-slate-500 mt-1 truncate">{item.notes}</p>
          )}
        </div>
        
        {/* Slider de progreso */}
        <div className="w-52 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={localProgress}
              onChange={(e) => handleProgressChange(parseInt(e.target.value))}
              className={`flex-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200`}
              style={{
                background: `linear-gradient(to right, ${localProgress >= 100 ? '#22c55e' : ''} ${localProgress}%, #e2e8f0 ${localProgress}%)`
              }}
            />
            <span className={`text-sm font-bold w-12 text-right ${localProgress >= 100 ? 'text-green-600' : colors.text}`}>
              {localProgress}%
            </span>
          </div>
        </div>
        
        {/* Acciones (solo para items no-general) */}
        {!isGeneral && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(item)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Editar incidencia"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar subcategoría"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================
// COMPONENTE: CATEGORÍA DE CONSTRUCCIÓN
// =============================================
const ConstructionCategory = ({
  categoryCode,
  categoryName,
  items,
  isExpanded,
  onToggle,
  onAddSubcategory,
  onProgressChange,
  onDeleteSubcategory,
  onEditSubcategory
}) => {
  const config = CATEGORY_CONFIG[categoryCode] || { name: categoryName, icon: Circle, color: 'slate' };
  const colors = CATEGORY_COLORS[config.color] || CATEGORY_COLORS.slate;
  const Icon = config.icon;
  
  // Separar items: el "General" y los demás
  const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
  const regularItems = items.filter(i => !i.name?.toLowerCase().includes('general'));
  
  // Calcular progreso ponderado de la categoría
  const categoryProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
    if (totalWeight === 0) return 0;
    
    return items.reduce((acc, item) => {
      const normalizedWeight = (item.weight || 0) / totalWeight * 100;
      return acc + (normalizedWeight * (item.progress_percentage || 0)) / 100;
    }, 0);
  }, [items]);
  
  // Calcular peso disponible para nuevas subcategorías
  const usedWeight = regularItems.reduce((sum, item) => sum + (item.weight || 0), 0);
  const availableWeight = Math.max(0, 100 - usedWeight);
  
  const isComplete = categoryProgress >= 99.5;
  
  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all shadow-sm ${
      isComplete 
        ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50' 
        : `${colors.border} bg-white`
    }`}>
      {/* Header */}
      <div 
        className={`p-5 cursor-pointer transition-colors ${
          isComplete ? 'hover:bg-green-100/50' : 'hover:bg-slate-50'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          {/* Icono */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
            isComplete ? 'bg-gradient-to-br from-green-500 to-emerald-600' : colors.fill
          }`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className={`font-bold text-lg ${isComplete ? 'text-green-800' : 'text-slate-800'}`}>
                {config.name}
              </h3>
              {isComplete && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-200 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completado
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {items.length} {items.length === 1 ? 'subcategoría' : 'subcategorías'}
              {availableWeight < 100 && !isComplete && (
                <span className="ml-2 text-amber-600">• {availableWeight}% disponible</span>
              )}
            </p>
          </div>
          
          {/* Barra de progreso */}
          <div className="w-64 flex-shrink-0">
            <ProgressBar 
              progress={categoryProgress}
              colorScheme={isComplete ? 'green' : config.color}
              size="md"
            />
          </div>
          
          {/* Chevron */}
          <div className="p-2 text-slate-400">
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </div>
        </div>
      </div>
      
      {/* Contenido expandido */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-5 space-y-3 bg-slate-50/30">
          {/* Items regulares primero */}
          {regularItems.map((item) => (
            <SubcategoryItem
              key={item.id}
              item={item}
              categoryColor={config.color}
              isGeneral={false}
              onProgressChange={onProgressChange}
              onDelete={onDeleteSubcategory}
              onEdit={onEditSubcategory}
              availableWeight={availableWeight}
            />
          ))}
          
          {/* Item "General" al final */}
          {generalItem && (
            <SubcategoryItem
              key={generalItem.id}
              item={generalItem}
              categoryColor={config.color}
              isGeneral={true}
              onProgressChange={onProgressChange}
              onDelete={() => {}}
              onEdit={() => {}}
              availableWeight={0}
            />
          )}
          
          {/* Botón agregar */}
          {availableWeight > 0 && (
            <button
              onClick={onAddSubcategory}
              className={`w-full p-4 rounded-xl border-2 border-dashed ${colors.border} 
                text-slate-500 hover:${colors.text} hover:${colors.bg} hover:border-solid
                transition-all flex items-center justify-center gap-2 font-medium`}
            >
              <Plus className="w-5 h-5" />
              Agregar Subcategoría ({availableWeight}% disponible)
            </button>
          )}
          
          {availableWeight <= 0 && !generalItem && (
            <div className="text-center py-3 text-amber-600 text-sm bg-amber-50 rounded-lg">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              100% asignado. Editá los porcentajes existentes para agregar más.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================
// COMPONENTE PRINCIPAL: MODAL
// =============================================
const UnitDetailModal = ({ unitId, assetId, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState(null);
  const [activeTab, setActiveTab] = useState('checklist');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingInfo, setEditingInfo] = useState(false);
  const [formData, setFormData] = useState({});
  
  // Modal de subcategoría
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [targetCategory, setTargetCategory] = useState(null);
  const [subcategoryForm, setSubcategoryForm] = useState({ name: '', weight: 20 });
  
  // Refs
  const debounceTimers = useRef({});

  // =============================================
  // CARGA DE DATOS
  // =============================================
  
  const loadUnit = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/units/${unitId}`);
      if (response.data.success) {
        const unitData = response.data.data.unit;
        setUnit(unitData);
        setFormData({
          unit_code: unitData.unit_code || '',
          unit_name: unitData.unit_name || '',
          floor_number: unitData.floor_number || '',
          total_area_m2: unitData.total_area_m2 || '',
          covered_area_m2: unitData.covered_area_m2 || '',
          rooms: unitData.rooms || '',
          bedrooms: unitData.bedrooms || '',
          bathrooms: unitData.bathrooms || '',
          has_balcony: unitData.has_balcony || false,
          has_terrace: unitData.has_terrace || false,
          orientation: unitData.orientation || '',
          list_price: unitData.list_price || '',
          sale_price: unitData.sale_price || '',
          rental_price: unitData.rental_price || '',
          currency: unitData.currency || 'USD',
          construction_status: unitData.construction_status || 'not_started',
          sale_status: unitData.sale_status || 'available',
          delivery_date: unitData.delivery_date?.split('T')[0] || '',
          notes: unitData.notes || ''
        });
      }
    } catch (error) {
      console.error('Error cargando unidad:', error);
      toast.error('Error al cargar unidad');
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [unitId, onClose]);

  useEffect(() => {
    loadUnit();
  }, [loadUnit]);

  // Agrupar items por categoría
  const groupedItems = useMemo(() => {
    if (!unit?.progress_items) return {};
    
    return unit.progress_items.reduce((acc, item) => {
      const key = item.category_code || 'other';
      if (!acc[key]) {
        acc[key] = {
          name: item.category_name || key,
          items: []
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {});
  }, [unit?.progress_items]);

  // Calcular progreso general
  const overallProgress = useMemo(() => {
    const categories = Object.values(groupedItems);
    if (categories.length === 0) return 0;
    
    let totalProgress = 0;
    let validCategories = 0;
    
    categories.forEach(({ items }) => {
      if (items.length === 0) return;
      const totalWeight = items.reduce((sum, i) => sum + (i.weight || 0), 0);
      if (totalWeight === 0) return;
      
      const catProgress = items.reduce((acc, item) => {
        const normalizedWeight = (item.weight || 0) / totalWeight * 100;
        return acc + (normalizedWeight * (item.progress_percentage || 0)) / 100;
      }, 0);
      
      totalProgress += catProgress;
      validCategories++;
    });
    
    return validCategories > 0 ? Math.round(totalProgress / validCategories) : 0;
  }, [groupedItems]);

  // Stats
  const progressStats = useMemo(() => {
    const categories = Object.entries(groupedItems);
    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    
    categories.forEach(([, { items }]) => {
      const totalWeight = items.reduce((sum, i) => sum + (i.weight || 0), 0);
      const catProgress = totalWeight > 0 
        ? items.reduce((acc, i) => acc + ((i.weight || 0) / totalWeight * 100 * (i.progress_percentage || 0)) / 100, 0)
        : 0;
      
      if (catProgress >= 99.5) completed++;
      else if (catProgress > 0) inProgress++;
      else notStarted++;
    });
    
    return { completed, inProgress, notStarted, total: categories.length };
  }, [groupedItems]);

  // =============================================
  // HANDLERS
  // =============================================
  
  const handleFormChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  const handleSaveInfo = async () => {
    try {
      setSaving(true);
      const response = await api.put(`/units/${unitId}`, formData);
      if (response.data.success) {
        toast.success('Información guardada');
        setUnit(prev => ({ ...prev, ...response.data.data.unit }));
        setEditingInfo(false);
        onUpdate?.();
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (code) => {
    setExpandedCategories(prev => ({ ...prev, [code]: !prev[code] }));
  };

  // Cambiar progreso de un item
  const handleProgressChange = useCallback(async (itemId, newProgress) => {
    // Actualizar localmente
    setUnit(prev => ({
      ...prev,
      progress_items: prev.progress_items.map(item =>
        item.id === itemId 
          ? { 
              ...item, 
              progress_percentage: newProgress,
              status: newProgress >= 100 ? 'completed' : newProgress > 0 ? 'in_progress' : 'pending'
            } 
          : item
      )
    }));

    // Debounce para servidor
    const timerKey = `progress_${itemId}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }

    debounceTimers.current[timerKey] = setTimeout(async () => {
      try {
        await api.put(`/units/${unitId}/progress/${itemId}`, {
          progress_percentage: newProgress,
          status: newProgress >= 100 ? 'completed' : newProgress > 0 ? 'in_progress' : 'pending'
        });
      } catch (error) {
        console.error('Error guardando progreso:', error);
        toast.error('Error al guardar progreso');
      }
    }, 500);
  }, [unitId]);

  // Inicializar checklist
  const handleInitializeChecklist = async () => {
    try {
      setSaving(true);
      const response = await api.post(`/units/${unitId}/progress/initialize`, {
        categories: 'all'
      });
      
      if (response.data.success) {
        toast.success(`${response.data.data.items?.length || 0} categorías inicializadas`);
        await loadUnit();
      }
    } catch (error) {
      console.error('Error inicializando:', error);
      toast.error('Error al inicializar checklist');
    } finally {
      setSaving(false);
    }
  };

  // Abrir modal para agregar subcategoría
  const openAddSubcategoryModal = (categoryCode, categoryName) => {
    const items = groupedItems[categoryCode]?.items || [];
    const regularItems = items.filter(i => !i.name?.toLowerCase().includes('general'));
    const usedWeight = regularItems.reduce((sum, i) => sum + (i.weight || 0), 0);
    const available = Math.max(0, 100 - usedWeight);
    
    if (available <= 0) {
      toast.error('No hay porcentaje disponible. Reducí otras subcategorías primero.');
      return;
    }
    
    setTargetCategory({ code: categoryCode, name: categoryName });
    setEditingSubcategory(null);
    setSubcategoryForm({ name: '', weight: Math.min(20, available) });
    setShowSubcategoryModal(true);
  };

  // Abrir modal para editar subcategoría
  const openEditSubcategoryModal = (categoryCode, categoryName, item) => {
    setTargetCategory({ code: categoryCode, name: categoryName });
    setEditingSubcategory(item);
    setSubcategoryForm({ name: item.name, weight: item.weight || 0 });
    setShowSubcategoryModal(true);
  };

  // Guardar subcategoría
  const handleSaveSubcategory = async () => {
    if (!subcategoryForm.name.trim()) {
      toast.error('Ingresá un nombre');
      return;
    }

    const categoryCode = targetCategory.code;
    const items = groupedItems[categoryCode]?.items || [];
    const regularItems = items.filter(i => !i.name?.toLowerCase().includes('general') && i.id !== editingSubcategory?.id);
    const usedWeight = regularItems.reduce((sum, i) => sum + (i.weight || 0), 0);
    const maxAvailable = 100 - usedWeight;
    
    if (subcategoryForm.weight > maxAvailable) {
      toast.error(`Máximo disponible: ${maxAvailable}%`);
      return;
    }

    try {
      setSaving(true);
      
      if (editingSubcategory) {
        // Actualizar existente
        await api.put(`/units/${unitId}/progress/${editingSubcategory.id}`, {
          name: subcategoryForm.name,
          weight: subcategoryForm.weight
        });
        
        // Actualizar "General" para compensar
        const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
        if (generalItem) {
          const newGeneralWeight = maxAvailable - subcategoryForm.weight;
          await api.put(`/units/${unitId}/progress/${generalItem.id}`, {
            weight: newGeneralWeight
          });
        }
        
        toast.success('Subcategoría actualizada');
      } else {
        // Crear nueva
        const config = CATEGORY_CONFIG[categoryCode];
        await api.post(`/units/${unitId}/progress`, {
          name: subcategoryForm.name,
          category_code: categoryCode,
          category_name: config?.name || targetCategory.name,
          weight: subcategoryForm.weight,
          status: 'pending',
          progress_percentage: 0
        });
        
        // Actualizar "General" para compensar
        const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
        if (generalItem) {
          const newGeneralWeight = maxAvailable - subcategoryForm.weight;
          await api.put(`/units/${unitId}/progress/${generalItem.id}`, {
            weight: Math.max(0, newGeneralWeight)
          });
        }
        
        toast.success('Subcategoría agregada');
      }
      
      await loadUnit();
      setShowSubcategoryModal(false);
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar subcategoría
  const handleDeleteSubcategory = async (categoryCode, item) => {
    if (item.name?.toLowerCase().includes('general')) {
      toast.error('No se puede eliminar la subcategoría General');
      return;
    }
    
    const config = CATEGORY_CONFIG[categoryCode];
    if (!window.confirm(`¿Eliminar "${item.name}"?\nEl ${item.weight}% se reasignará a "${config?.name || categoryCode} General".`)) {
      return;
    }
    
    try {
      await api.delete(`/units/${unitId}/progress/${item.id}`);
      
      // Actualizar "General" para absorber el peso
      const items = groupedItems[categoryCode]?.items || [];
      const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
      if (generalItem) {
        await api.put(`/units/${unitId}/progress/${generalItem.id}`, {
          weight: (generalItem.weight || 0) + (item.weight || 0)
        });
      }
      
      toast.success(`Subcategoría eliminada. ${item.weight}% reasignado a General.`);
      await loadUnit();
      
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar');
    }
  };

  const formatCurrency = (value, currency = 'USD') => {
    if (!value) return '-';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(value);
  };

  // =============================================
  // RENDER
  // =============================================

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
        <div className="relative bg-white rounded-2xl shadow-2xl p-8">
          <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (!unit) return null;

  const hasProgressItems = unit.progress_items && unit.progress_items.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {unit.unit_name || unit.unit_code || 'Unidad'}
              </h2>
              <p className="text-sm text-slate-500">
                {unit.asset_name} • Piso {unit.floor_number || '-'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Progreso circular */}
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke={overallProgress >= 100 ? '#22c55e' : '#3b82f6'}
                  strokeWidth="6"
                  strokeDasharray={`${overallProgress * 1.76} 176`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-700">
                {overallProgress}%
              </span>
            </div>
            
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
          {/* Versión */}
          <span className="absolute bottom-2 right-4 text-[10px] text-slate-300 font-mono">v{MODAL_VERSION}</span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          {[
            { id: 'checklist', label: 'Checklist Construcción', icon: ClipboardCheck },
            { id: 'info', label: 'Información', icon: Building2 },
            { id: 'documents', label: 'Documentos', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          
          {/* Tab: Checklist */}
          {activeTab === 'checklist' && (
            <div className="p-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center shadow-md">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-700">{progressStats.completed}</p>
                      <p className="text-xs text-green-600 font-medium">Completados</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-700">{progressStats.inProgress}</p>
                      <p className="text-xs text-blue-600 font-medium">En Progreso</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-400 rounded-lg flex items-center justify-center shadow-md">
                      <Circle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-700">{progressStats.notStarted}</p>
                      <p className="text-xs text-slate-600 font-medium">Sin Iniciar</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-4 border border-primary-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center shadow-md">
                      <ClipboardCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-primary-700">{overallProgress}%</p>
                      <p className="text-xs text-primary-600 font-medium">Progreso Total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Sistema de Incidencias</p>
                  <ul className="space-y-0.5 text-blue-700">
                    <li>• Cada categoría tiene subcategorías con <strong>porcentaje de incidencia</strong> que suman 100%</li>
                    <li>• El item "<strong>General</strong>" compensa automáticamente el porcentaje no asignado</li>
                    <li>• Ajustá el <strong>progreso</strong> de cada subcategoría con el slider (0-100%)</li>
                  </ul>
                </div>
              </div>

              {/* Categorías */}
              {!hasProgressItems ? (
                <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-dashed border-slate-300">
                  <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 mb-2">Sin checklist de construcción</h3>
                  <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    Inicializá el checklist para hacer seguimiento detallado de todas las etapas de construcción.
                  </p>
                  <button
                    onClick={handleInitializeChecklist}
                    disabled={saving}
                    className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    Inicializar Checklist Completo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedItems).map(([code, { name, items }]) => (
                    <ConstructionCategory
                      key={code}
                      categoryCode={code}
                      categoryName={name}
                      items={items}
                      isExpanded={expandedCategories[code] || false}
                      onToggle={() => toggleCategory(code)}
                      onAddSubcategory={() => openAddSubcategoryModal(code, name)}
                      onProgressChange={handleProgressChange}
                      onDeleteSubcategory={(item) => handleDeleteSubcategory(code, item)}
                      onEditSubcategory={(item) => openEditSubcategoryModal(code, name, item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Información */}
          {activeTab === 'info' && (
            <div className="p-6 space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Estado Construcción</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${CONSTRUCTION_STATUS[unit.construction_status]?.color || ''}`}>
                    {CONSTRUCTION_STATUS[unit.construction_status]?.label || unit.construction_status}
                  </span>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Estado Venta</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${SALE_STATUS[unit.sale_status]?.color || ''}`}>
                    {SALE_STATUS[unit.sale_status]?.label || unit.sale_status}
                  </span>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Superficie Total</p>
                  <p className="font-bold text-slate-800 text-lg">{unit.total_area_m2 || '-'} m²</p>
                </div>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">Precio Lista</p>
                  <p className="font-bold text-slate-800">{formatCurrency(unit.list_price, unit.currency)}</p>
                </div>
              </div>

              {/* Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-800 text-lg">Datos de la Unidad</h3>
                  {!editingInfo ? (
                    <button onClick={() => setEditingInfo(true)} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      <Edit2 className="w-4 h-4" /> Editar
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => setEditingInfo(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                      <button onClick={handleSaveInfo} disabled={saving} className="btn-primary text-sm py-2 flex items-center gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">Código</label>
                    <input type="text" value={formData.unit_code} disabled className="input-field bg-slate-100" />
                  </div>
                  <div>
                    <label className="form-label">Nombre</label>
                    <input type="text" name="unit_name" value={formData.unit_name} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Piso</label>
                    <input type="number" name="floor_number" value={formData.floor_number} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Orientación</label>
                    <select name="orientation" value={formData.orientation} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50">
                      <option value="">Seleccionar...</option>
                      <option value="N">Norte</option><option value="S">Sur</option><option value="E">Este</option><option value="O">Oeste</option>
                      <option value="NE">Noreste</option><option value="NO">Noroeste</option><option value="SE">Sureste</option><option value="SO">Suroeste</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Sup. Total (m²)</label>
                    <input type="number" name="total_area_m2" value={formData.total_area_m2} onChange={handleFormChange} disabled={!editingInfo} step="0.01" className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Sup. Cubierta (m²)</label>
                    <input type="number" name="covered_area_m2" value={formData.covered_area_m2} onChange={handleFormChange} disabled={!editingInfo} step="0.01" className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Ambientes</label>
                    <input type="number" name="rooms" value={formData.rooms} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Dormitorios</label>
                    <input type="number" name="bedrooms" value={formData.bedrooms} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Baños</label>
                    <input type="number" name="bathrooms" value={formData.bathrooms} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50" />
                  </div>
                  <div className="flex items-center gap-6 col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="has_balcony" checked={formData.has_balcony} onChange={handleFormChange} disabled={!editingInfo} className="w-4 h-4 rounded" />
                      <span className="text-sm text-slate-700">Balcón</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="has_terrace" checked={formData.has_terrace} onChange={handleFormChange} disabled={!editingInfo} className="w-4 h-4 rounded" />
                      <span className="text-sm text-slate-700">Terraza</span>
                    </label>
                  </div>
                </div>

                <h4 className="font-medium text-slate-700 mt-8 mb-4 pb-2 border-b">Precios y Venta</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">Moneda</label>
                    <select name="currency" value={formData.currency} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50">
                      <option value="USD">USD</option><option value="ARS">ARS</option><option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Precio Lista</label>
                    <input type="number" name="list_price" value={formData.list_price} onChange={handleFormChange} disabled={!editingInfo} step="0.01" className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Precio Venta</label>
                    <input type="number" name="sale_price" value={formData.sale_price} onChange={handleFormChange} disabled={!editingInfo} step="0.01" className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Precio Alquiler</label>
                    <input type="number" name="rental_price" value={formData.rental_price} onChange={handleFormChange} disabled={!editingInfo} step="0.01" className="input-field disabled:bg-slate-50" />
                  </div>
                  <div>
                    <label className="form-label">Estado Construcción</label>
                    <select name="construction_status" value={formData.construction_status} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50">
                      {Object.entries(CONSTRUCTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Estado Venta</label>
                    <select name="sale_status" value={formData.sale_status} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50">
                      {Object.entries(SALE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Fecha Entrega</label>
                    <input type="date" name="delivery_date" value={formData.delivery_date} onChange={handleFormChange} disabled={!editingInfo} className="input-field disabled:bg-slate-50" />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="form-label">Notas</label>
                  <textarea name="notes" value={formData.notes} onChange={handleFormChange} disabled={!editingInfo} rows="3" className="input-field disabled:bg-slate-50" placeholder="Notas adicionales..." />
                </div>
              </div>
            </div>
          )}

          {/* Tab: Documentos */}
          {activeTab === 'documents' && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-lg">Documentos y Fotos</h3>
                <label className="btn-primary inline-flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" /> Subir Archivo
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={() => toast.error('Funcionalidad en desarrollo')} />
                </label>
              </div>

              <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-dashed border-slate-300">
                <Image className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">Sin documentos</h3>
                <p className="text-slate-500">Subí fotos del progreso, planos, facturas y otros documentos</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Subcategoría */}
      {showSubcategoryModal && targetCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="text-lg font-bold text-slate-900">
                {editingSubcategory ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">Categoría: {CATEGORY_CONFIG[targetCategory.code]?.name || targetCategory.name}</p>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  value={subcategoryForm.name}
                  onChange={(e) => setSubcategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Cocina, Baño principal..."
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label">Porcentaje de Incidencia</label>
                {(() => {
                  const items = groupedItems[targetCategory.code]?.items || [];
                  const regularItems = items.filter(i => !i.name?.toLowerCase().includes('general') && i.id !== editingSubcategory?.id);
                  const usedWeight = regularItems.reduce((sum, i) => sum + (i.weight || 0), 0);
                  const maxAvailable = 100 - usedWeight;
                  
                  return (
                    <div className="space-y-4">
                      <div className="bg-slate-100 rounded-xl p-4">
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-600">Distribución</span>
                          <span className="font-semibold text-slate-700">Total: 100%</span>
                        </div>
                        <div className="h-6 bg-slate-200 rounded-lg overflow-hidden flex">
                          {regularItems.map((item, idx) => {
                            const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500'];
                            return (
                              <div
                                key={item.id}
                                className={`h-full ${colors[idx % colors.length]} flex items-center justify-center text-white text-xs font-medium`}
                                style={{ width: `${item.weight || 0}%` }}
                              >
                                {(item.weight || 0) >= 10 && `${item.weight}%`}
                              </div>
                            );
                          })}
                          {subcategoryForm.weight > 0 && subcategoryForm.weight <= maxAvailable && (
                            <div className="h-full bg-green-500 flex items-center justify-center text-white text-xs font-medium" style={{ width: `${subcategoryForm.weight}%` }}>
                              {subcategoryForm.weight >= 10 && `${subcategoryForm.weight}%`}
                            </div>
                          )}
                          {(maxAvailable - (subcategoryForm.weight <= maxAvailable ? subcategoryForm.weight : 0)) > 0 && (
                            <div className="h-full bg-slate-400 flex items-center justify-center text-slate-200 text-xs" style={{ width: `${maxAvailable - (subcategoryForm.weight <= maxAvailable ? subcategoryForm.weight : 0)}%` }}>
                              General
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          min="1"
                          max={maxAvailable}
                          value={Math.min(subcategoryForm.weight, maxAvailable)}
                          onChange={(e) => setSubcategoryForm(prev => ({ ...prev, weight: parseInt(e.target.value) }))}
                          className="flex-1 h-2 accent-green-500"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={maxAvailable}
                            value={subcategoryForm.weight}
                            onChange={(e) => setSubcategoryForm(prev => ({ ...prev, weight: Math.min(parseInt(e.target.value) || 1, maxAvailable) }))}
                            className="w-16 px-2 py-1 text-center border border-slate-200 rounded-lg font-bold"
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        Máximo disponible: <span className="font-semibold text-green-600">{maxAvailable}%</span>
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowSubcategoryModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveSubcategory} disabled={saving || !subcategoryForm.name.trim()} className="btn-primary inline-flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingSubcategory ? 'Guardar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitDetailModal;
