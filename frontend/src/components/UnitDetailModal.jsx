/**
 * UnitDetailModal - Modal de Detalle de Unidad con Checklist de Construcción
 * @version 1.9
 * @date 2026-01-03
 * 
 * Sistema de incidencias con subcategorías y item "General" automático
 * v1.9: Armonización de colores con el resto del dashboard
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const MODAL_VERSION = '1.13';
import {
  X, Save, CheckCircle2, Circle, Clock, AlertTriangle,
  Building2, FileText, Image, Upload, Trash2, Plus, 
  ChevronDown, ChevronRight, Zap, Droplets, Flame, 
  PaintBucket, DoorOpen, Bath, Wrench, Sparkles, 
  ClipboardCheck, Check, Loader2, Edit2, Info,
  Thermometer, Layers, LayoutGrid, Grip, Hammer, 
  ShowerHead, Package, Fence, FileCheck, Square,
  Ban, MoreVertical
} from 'lucide-react';

// =============================================
// CONSTANTES - ALINEADAS CON EL BACKEND
// =============================================

// Mapeo de códigos de categoría del backend a iconos
// Todos usan la misma paleta de colores (slate/primary)
const CATEGORY_ICONS = {
  masonry: Layers,
  plastering: Square,
  electrical: Zap,
  plumbing: Droplets,
  gas: Flame,
  hvac: Thermometer,
  flooring: LayoutGrid,
  tiling: Grip,
  painting: PaintBucket,
  carpentry: DoorOpen,
  metalwork: Hammer,
  fixtures: ShowerHead,
  sanitary: Bath,
  countertops: Package,
  windows: Square,
  main_door: DoorOpen,
  balcony: Fence,
  final_cleaning: Sparkles,
  final_inspection: ClipboardCheck,
  documentation: FileCheck
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
// COMPONENTE: BARRA DE PROGRESO (Colores unificados)
// =============================================
const ProgressBar = ({ progress, size = 'md' }) => {
  const isComplete = progress >= 100;
  const height = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-5' : 'h-3';
  
  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`flex-1 bg-slate-200 rounded-full ${height} overflow-hidden`}>
        <div 
          className={`${height} rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-primary-500'}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <span className={`text-sm font-bold min-w-[3.5rem] text-right ${isComplete ? 'text-green-600' : 'text-slate-700'}`}>
        {Math.round(progress)}%
      </span>
    </div>
  );
};

// =============================================
// COMPONENTE: SUBCATEGORÍA ITEM (Colores unificados)
// =============================================
const SubcategoryItem = ({ 
  item, 
  onProgressChange, 
  onDelete, 
  onEdit,
  isGeneral
}) => {
  const [localProgress, setLocalProgress] = useState(item.progress_percentage || 0);
  const debounceRef = useRef(null);
  
  useEffect(() => {
    setLocalProgress(item.progress_percentage || 0);
  }, [item.progress_percentage]);

  const handleProgressChange = (value) => {
    setLocalProgress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onProgressChange(item.id, value);
    }, 300);
  };

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isGeneral 
        ? 'bg-slate-50 border-dashed border-slate-300' 
        : 'bg-white border-slate-200 hover:border-slate-300'
    }`}>
      <div className="flex items-start gap-4">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-medium ${isGeneral ? 'text-slate-400 italic' : 'text-slate-700'}`}>
              {item.name}
            </span>
            {isGeneral && (
              <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded">
                Auto
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {item.weight || 0}% incidencia
            </span>
            <span className="text-xs text-slate-400">
              → {Math.round(((item.weight || 0) * localProgress) / 100)}% aporte
            </span>
          </div>
        </div>
        
        {/* Slider */}
        <div className="w-48 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={localProgress}
              onChange={(e) => handleProgressChange(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-primary-500"
            />
            <span className={`text-sm font-bold w-12 text-right ${localProgress >= 100 ? 'text-green-600' : 'text-slate-600'}`}>
              {localProgress}%
            </span>
          </div>
        </div>
        
        {/* Acciones */}
        {!isGeneral && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Editar">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(item)} className="p-1.5 text-slate-400 hover:text-red-500 rounded" title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================
// COMPONENTE: CATEGORÍA DE CONSTRUCCIÓN (Colores unificados)
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
  const Icon = CATEGORY_ICONS[categoryCode] || Circle;
  
  const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
  const regularItems = items.filter(i => !i.name?.toLowerCase().includes('general'));
  
  const categoryProgress = useMemo(() => {
    if (items.length === 0) return 0;
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
    if (totalWeight === 0) return 0;
    return items.reduce((acc, item) => {
      const normalizedWeight = (item.weight || 0) / totalWeight * 100;
      return acc + (normalizedWeight * (item.progress_percentage || 0)) / 100;
    }, 0);
  }, [items]);
  
  const isComplete = categoryProgress >= 99.5;
  
  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      isComplete ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white'
    }`}>
      {/* Header */}
      <div 
        className={`p-4 cursor-pointer transition-colors ${isComplete ? 'hover:bg-green-100' : 'hover:bg-slate-50'}`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isComplete ? 'bg-green-500' : 'bg-primary-500'}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold ${isComplete ? 'text-green-800' : 'text-slate-800'}`}>
                {categoryName}
              </h3>
              {isComplete && (
                <span className="flex items-center gap-1 text-xs text-green-700 bg-green-200 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3 h-3" /> Listo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {items.length} items{generalItem && generalItem.weight > 0 && generalItem.weight < 100 && ` • General: ${generalItem.weight}%`}
            </p>
          </div>
          
          <div className="w-56 flex-shrink-0">
            <ProgressBar progress={categoryProgress} size="md" />
          </div>
          
          <div className="text-slate-400">
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </div>
        </div>
      </div>
      
      {/* Contenido */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-4 space-y-2 bg-slate-50">
          {regularItems.map((item) => (
            <SubcategoryItem
              key={item.id}
              item={item}
              isGeneral={false}
              onProgressChange={onProgressChange}
              onDelete={onDeleteSubcategory}
              onEdit={onEditSubcategory}
            />
          ))}
          
          {generalItem && (
            <SubcategoryItem
              key={generalItem.id}
              item={generalItem}
              isGeneral={true}
              onProgressChange={onProgressChange}
              onDelete={() => {}}
              onEdit={() => {}}
            />
          )}
          
          {generalItem && generalItem.weight > 0 && (
            <button
              onClick={onAddSubcategory}
              className="w-full p-3 rounded-lg border border-dashed border-slate-300 text-slate-500 
                hover:text-slate-700 hover:bg-white hover:border-slate-400
                transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Agregar subitem (General tiene {generalItem.weight}%)
            </button>
          )}
          
          {generalItem && generalItem.weight <= 0 && regularItems.length > 0 && (
            <div className="text-center py-2 text-xs text-amber-600 bg-amber-50 rounded-lg">
              "General" en 0%. Para agregar más, reducí el % de otros subitems.
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
  
  // Menú de acciones y confirmaciones
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
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

  // Borrar unidad
  const handleDeleteUnit = async () => {
    try {
      setDeleting(true);
      await api.delete(`/units/${unitId}`);
      toast.success('Departamento eliminado');
      onUpdate?.();
      onClose?.();
    } catch (error) {
      console.error('Error eliminando unidad:', error);
      toast.error('Error al eliminar el departamento');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Bloquear/Desbloquear unidad
  const handleToggleBlock = async () => {
    try {
      setSaving(true);
      const newStatus = unit.sale_status === 'unavailable' ? 'available' : 'unavailable';
      const response = await api.put(`/units/${unitId}`, { sale_status: newStatus });
      if (response.data.success) {
        setUnit(prev => ({ ...prev, sale_status: newStatus }));
        toast.success(newStatus === 'unavailable' ? 'Departamento bloqueado' : 'Departamento desbloqueado');
        onUpdate?.();
      }
    } catch (error) {
      toast.error('Error al cambiar estado');
    } finally {
      setSaving(false);
      setShowActionsMenu(false);
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
    const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
    const generalWeight = generalItem?.weight || 0;
    
    // Solo se puede agregar si "General" tiene porcentaje disponible
    if (generalWeight <= 0) {
      toast.error(
        'No hay porcentaje disponible en "General".\n' +
        'Para agregar un subitem, primero reducí el porcentaje de otros subitems.',
        { duration: 4000 }
      );
      return;
    }
    
    setTargetCategory({ code: categoryCode, name: categoryName });
    setEditingSubcategory(null);
    setSubcategoryForm({ name: '', weight: Math.min(20, generalWeight) });
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
    // BLOQUEO INMEDIATO para evitar doble clic
    if (saving) return;
    setSaving(true);
    
    if (!subcategoryForm.name.trim()) {
      toast.error('Ingresá un nombre');
      setSaving(false);
      return;
    }

    const categoryCode = targetCategory.code;
    const items = groupedItems[categoryCode]?.items || [];
    const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
    
    if (!generalItem) {
      toast.error('Error: No se encontró el item General');
      setSaving(false);
      return;
    }
    
    try {
      if (editingSubcategory) {
        // EDITAR: calcular diferencia y ajustar General
        const oldWeight = editingSubcategory.weight || 0;
        const newWeight = subcategoryForm.weight;
        const difference = newWeight - oldWeight; // positivo = toma de General, negativo = devuelve a General
        
        // Verificar que General tenga suficiente para dar
        if (difference > 0 && difference > generalItem.weight) {
          toast.error(`"General" solo tiene ${generalItem.weight}% disponible para entregar.`);
          setSaving(false);
          return;
        }
        
        // Actualizar el subitem
        await api.put(`/units/${unitId}/progress/${editingSubcategory.id}`, {
          name: subcategoryForm.name,
          weight: newWeight
        });
        
        // Actualizar "General" (resta si subitem aumenta, suma si subitem reduce)
        const newGeneralWeight = generalItem.weight - difference;
        await api.put(`/units/${unitId}/progress/${generalItem.id}`, {
          weight: newGeneralWeight
        });
        
        toast.success('Subcategoría actualizada');
      } else {
        // CREAR: tomar porcentaje de General
        if (subcategoryForm.weight > generalItem.weight) {
          toast.error(`"General" solo tiene ${generalItem.weight}% disponible.`);
          setSaving(false);
          return;
        }
        
        // Crear el nuevo subitem
        await api.post(`/units/${unitId}/progress`, {
          name: subcategoryForm.name,
          category_code: categoryCode,
          category_name: targetCategory.name,
          weight: subcategoryForm.weight,
          status: 'pending',
          progress_percentage: 0
        });
        
        // Restar de "General"
        const newGeneralWeight = generalItem.weight - subcategoryForm.weight;
        await api.put(`/units/${unitId}/progress/${generalItem.id}`, {
          weight: newGeneralWeight
        });
        
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
    
    const categoryName = groupedItems[categoryCode]?.name || categoryCode;
    if (!window.confirm(`¿Eliminar "${item.name}"?\nEl ${item.weight}% se reasignará a "${categoryName} General".`)) {
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
            <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  {unit.unit_code || 'SIN-CÓDIGO'}
                </span>
                {unit.sale_status && (
                  <span className={`text-xs px-2 py-0.5 rounded ${SALE_STATUS[unit.sale_status]?.color || 'bg-slate-100'}`}>
                    {SALE_STATUS[unit.sale_status]?.label || unit.sale_status}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-800 mt-0.5">
                {unit.unit_name || 'Sin nombre'}
              </h2>
              <p className="text-xs text-slate-500">
                {unit.asset_name} • Piso {unit.floor_number || '-'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Progreso circular */}
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="24" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke={overallProgress >= 100 ? '#22c55e' : '#3b82f6'}
                  strokeWidth="5"
                  strokeDasharray={`${overallProgress * 1.51} 151`}
                  strokeLinecap="round"
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">
                {overallProgress}%
              </span>
            </div>
            
            {/* Menú de acciones */}
            <div className="relative">
              <button 
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              {showActionsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                    <button
                      onClick={() => {
                        setActiveTab('info');
                        setEditingInfo(true);
                        setShowActionsMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar datos
                    </button>
                    <button
                      onClick={handleToggleBlock}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Ban className="w-4 h-4" />
                      {unit.sale_status === 'unavailable' ? 'Desbloquear' : 'Bloquear'}
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowActionsMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar departamento
                    </button>
                  </div>
                </>
              )}
            </div>
            
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
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
              {/* Stats - Diseño simplificado */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                  <p className="text-2xl font-bold text-green-600">{progressStats.completed}</p>
                  <p className="text-xs text-slate-500">Completados</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                  <p className="text-2xl font-bold text-blue-600">{progressStats.inProgress}</p>
                  <p className="text-xs text-slate-500">En Progreso</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                  <p className="text-2xl font-bold text-slate-400">{progressStats.notStarted}</p>
                  <p className="text-xs text-slate-500">Sin Iniciar</p>
                </div>
                <div className="bg-primary-500 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{overallProgress}%</p>
                  <p className="text-xs text-primary-100">Total</p>
                </div>
              </div>

              {/* Info box - Más sutil */}
              <div className="flex items-start gap-2 p-3 bg-slate-100 rounded-lg text-xs text-slate-600">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p>
                  Cada categoría tiene subcategorías con % de incidencia que suman 100%. 
                  El item "General" compensa el % no asignado. Ajustá el progreso con los sliders.
                </p>
              </div>

              {/* Categorías */}
              {!hasProgressItems ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-1">Sin checklist</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Inicializá el checklist para seguimiento de construcción.
                  </p>
                  <button
                    onClick={handleInitializeChecklist}
                    disabled={saving}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Inicializar Checklist
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

      {/* Modal Subcategoría - Simplificado */}
      {showSubcategoryModal && targetCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">
                {editingSubcategory ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
              </h3>
              <p className="text-xs text-slate-500">{targetCategory.name}</p>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="form-label">Nombre</label>
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
                  const generalItem = items.find(i => i.name?.toLowerCase().includes('general'));
                  const generalWeight = generalItem?.weight || 0;
                  
                  // Si estamos editando, el máximo es: lo que tiene General + lo que ya tiene este subitem
                  const currentItemWeight = editingSubcategory?.weight || 0;
                  const maxAvailable = editingSubcategory 
                    ? generalWeight + currentItemWeight 
                    : generalWeight;
                  
                  return (
                    <div className="space-y-3">
                      {/* Info de General */}
                      <div className="p-3 bg-slate-100 rounded-lg">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-600">"{targetCategory.name} General" tiene:</span>
                          <span className="font-bold text-primary-600">{generalWeight}%</span>
                        </div>
                        {editingSubcategory && (
                          <p className="text-xs text-slate-500 mt-1">
                            + {currentItemWeight}% de este subitem = {maxAvailable}% máximo
                          </p>
                        )}
                      </div>

                      {/* Slider */}
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max={maxAvailable || 1}
                          value={Math.min(subcategoryForm.weight, maxAvailable || 1)}
                          onChange={(e) => setSubcategoryForm(prev => ({ ...prev, weight: parseInt(e.target.value) }))}
                          disabled={maxAvailable <= 0}
                          className="flex-1 h-2 accent-primary-500"
                        />
                        <input
                          type="number"
                          min="1"
                          max={maxAvailable}
                          value={subcategoryForm.weight}
                          onChange={(e) => setSubcategoryForm(prev => ({ ...prev, weight: Math.min(parseInt(e.target.value) || 1, maxAvailable) }))}
                          className="w-16 px-2 py-1 text-center border border-slate-200 rounded text-sm font-medium"
                        />
                        <span className="text-slate-400 text-sm">%</span>
                      </div>
                      
                      {/* Preview del resultado */}
                      <div className="text-xs text-slate-500 p-2 bg-slate-50 rounded">
                        {editingSubcategory ? (
                          <>
                            Al guardar: "General" quedará en <strong>{maxAvailable - subcategoryForm.weight}%</strong>
                          </>
                        ) : (
                          <>
                            Al agregar: "General" bajará a <strong>{generalWeight - subcategoryForm.weight}%</strong>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
              <button 
                onClick={() => setShowSubcategoryModal(false)} 
                disabled={saving}
                className="btn-secondary text-sm py-2 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSubcategory} 
                disabled={saving || !subcategoryForm.name.trim()} 
                className="btn-primary text-sm py-2 inline-flex items-center gap-2 min-w-[100px] justify-center disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingSubcategory ? 'Guardar' : 'Agregar'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                ¿Eliminar departamento?
              </h3>
              <p className="text-sm text-slate-600 text-center mb-4">
                Estás por eliminar <strong>{unit.unit_code}</strong> ({unit.unit_name || 'Sin nombre'}).
                Esta acción no se puede deshacer.
              </p>
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                Se eliminarán también todos los datos de progreso y documentos asociados.
              </div>
            </div>
            <div className="flex border-t border-slate-200">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 text-slate-700 hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUnit}
                disabled={deleting}
                className="flex-1 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors font-medium border-l border-slate-200 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitDetailModal;
