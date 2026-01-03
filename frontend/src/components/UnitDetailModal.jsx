import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import {
  X, Save, CheckCircle2, Circle, Clock, AlertTriangle,
  Building2, Ruler, DollarSign, Calendar, User, FileText,
  Image, Upload, Trash2, Plus, ChevronDown, ChevronUp,
  Zap, Droplets, Flame, PaintBucket, DoorOpen, Bath,
  Wrench, Sparkles, ClipboardCheck, Check, Loader2,
  Eye, Download, ExternalLink, Home, Layers, Ban
} from 'lucide-react';

// Iconos para categorías
const CATEGORY_ICONS = {
  masonry: Layers,
  plastering: Layers,
  electrical: Zap,
  plumbing: Droplets,
  gas: Flame,
  hvac: Zap,
  flooring: Home,
  tiling: Layers,
  painting: PaintBucket,
  carpentry: DoorOpen,
  metalwork: Wrench,
  fixtures: Droplets,
  sanitary: Bath,
  countertops: Home,
  windows: Home,
  main_door: DoorOpen,
  balcony: Home,
  final_cleaning: Sparkles,
  final_inspection: ClipboardCheck,
  documentation: FileText,
  default: Circle
};

// Estados de items
const ITEM_STATUS = {
  pending: { label: 'Pendiente', color: 'bg-slate-200 text-slate-700', icon: Circle },
  in_progress: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700', icon: Clock },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  blocked: { label: 'Bloqueado', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  not_applicable: { label: 'No Aplica', color: 'bg-gray-100 text-gray-500', icon: X }
};

// Estados de construcción
const CONSTRUCTION_STATUS = {
  not_started: { label: 'Sin Iniciar', color: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'En Construcción', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completado', color: 'bg-green-100 text-green-700' },
  delivered: { label: 'Entregado', color: 'bg-purple-100 text-purple-700' }
};

// Estados de venta
const SALE_STATUS = {
  available: { label: 'Disponible', color: 'bg-green-100 text-green-700' },
  reserved: { label: 'Reservado', color: 'bg-yellow-100 text-yellow-700' },
  sold: { label: 'Vendido', color: 'bg-blue-100 text-blue-700' },
  rented: { label: 'Alquilado', color: 'bg-purple-100 text-purple-700' },
  unavailable: { label: 'No Disponible', color: 'bg-red-100 text-red-700' }
};

const UnitDetailModal = ({ unitId, assetId, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState(null);
  const [activeTab, setActiveTab] = useState('info'); // info, progress, documents
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingInfo, setEditingInfo] = useState(false);
  const [categories, setCategories] = useState([]);
  
  // Form data para edición
  const [formData, setFormData] = useState({});
  
  // Refs para debounce de sliders
  const debounceTimers = useRef({});
  
  // Cargar detalle de unidad
  const loadUnit = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/units/${unitId}`);
      if (response.data.success) {
        setUnit(response.data.data.unit);
        setFormData({
          unit_code: response.data.data.unit.unit_code || '',
          unit_name: response.data.data.unit.unit_name || '',
          floor_number: response.data.data.unit.floor_number || '',
          total_area_m2: response.data.data.unit.total_area_m2 || '',
          covered_area_m2: response.data.data.unit.covered_area_m2 || '',
          rooms: response.data.data.unit.rooms || '',
          bedrooms: response.data.data.unit.bedrooms || '',
          bathrooms: response.data.data.unit.bathrooms || '',
          has_balcony: response.data.data.unit.has_balcony || false,
          has_terrace: response.data.data.unit.has_terrace || false,
          orientation: response.data.data.unit.orientation || '',
          list_price: response.data.data.unit.list_price || '',
          sale_price: response.data.data.unit.sale_price || '',
          rental_price: response.data.data.unit.rental_price || '',
          currency: response.data.data.unit.currency || 'USD',
          construction_status: response.data.data.unit.construction_status || 'not_started',
          sale_status: response.data.data.unit.sale_status || 'available',
          delivery_date: response.data.data.unit.delivery_date?.split('T')[0] || '',
          notes: response.data.data.unit.notes || ''
        });
      }
    } catch (error) {
      console.error('Error cargando unidad:', error);
      // Solo mostrar error si no es 401 (que ya maneja el interceptor)
      if (error.response?.status !== 401) {
        toast.error('Error al cargar unidad. Intentá de nuevo.');
        onClose?.(); // Cerrar modal si hay error
      }
    } finally {
      setLoading(false);
    }
  }, [unitId, onClose]);

  // Cargar categorías de progreso
  const loadCategories = useCallback(async () => {
    try {
      const response = await api.get('/units/progress-categories');
      if (response.data.success) {
        setCategories(response.data.data.categories);
      }
    } catch (error) {
      // Ignorar errores de categorías - no es crítico
      console.error('Error cargando categorías:', error);
    }
  }, []);

  useEffect(() => {
    loadUnit();
    loadCategories();
  }, [loadUnit, loadCategories]);

  // Handler para cambios en form
  const handleFormChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  // Guardar información
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

  // Inicializar checklist
  const handleInitializeProgress = async () => {
    try {
      setSaving(true);
      const response = await api.post(`/units/${unitId}/progress/initialize`, {
        categories: 'all'
      });
      if (response.data.success) {
        toast.success(`${response.data.data.items.length} items creados`);
        loadUnit();
      }
    } catch (error) {
      toast.error('Error al inicializar');
    } finally {
      setSaving(false);
    }
  };

  // Actualizar item de progreso (sin recargar toda la página)
  const handleUpdateProgressItem = useCallback((itemId, updates) => {
    // Actualizar localmente INMEDIATAMENTE para evitar parpadeo
    setUnit(prev => {
      if (!prev) return prev;
      const updatedItems = prev.progress_items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      
      // Recalcular stats localmente
      const total = updatedItems.filter(i => i.status !== 'not_applicable').length;
      const completed = updatedItems.filter(i => i.status === 'completed').length;
      const inProgress = updatedItems.filter(i => i.status === 'in_progress').length;
      const pending = updatedItems.filter(i => i.status === 'pending').length;
      const blocked = updatedItems.filter(i => i.status === 'blocked').length;
      const avgProgress = total > 0 
        ? Math.round(updatedItems.filter(i => i.status !== 'not_applicable')
            .reduce((sum, i) => sum + (i.progress_percentage || 0), 0) / total)
        : 0;
      const overallProgress = total > 0 ? Math.round((completed * 100) / total) : 0;

      return {
        ...prev,
        progress_items: updatedItems,
        overall_progress: overallProgress,
        progress_stats: {
          ...prev.progress_stats,
          total_items: total,
          completed,
          in_progress: inProgress,
          pending,
          blocked,
          avg_progress: avgProgress
        }
      };
    });

    // Cancelar timer anterior para este item
    if (debounceTimers.current[itemId]) {
      clearTimeout(debounceTimers.current[itemId]);
    }

    // Guardar en el servidor con debounce de 500ms
    debounceTimers.current[itemId] = setTimeout(async () => {
      try {
        await api.put(`/units/${unitId}/progress/${itemId}`, updates);
      } catch (error) {
        console.error('Error guardando progreso:', error);
        toast.error('Error al guardar cambio');
      }
    }, 500);
  }, [unitId]);

  // Agregar/Editar item personalizado
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // Para editar items existentes
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category_code: '',
    weight: 100, // Peso/incidencia sobre la categoría (1-100)
    notes: ''
  });
  
  // Obtener categorías únicas de los items existentes
  const availableCategories = unit?.progress_items 
    ? [...new Set(unit.progress_items.map(i => i.category_code).filter(Boolean))]
        .map(code => ({
          code,
          name: unit.progress_items.find(i => i.category_code === code)?.category_name || code
        }))
    : [];

  const openAddItemModal = (categoryCode = '') => {
    setEditingItem(null);
    setNewItemForm({
      name: '',
      category_code: categoryCode,
      weight: 100,
      notes: ''
    });
    setShowAddItemModal(true);
  };

  const openEditItemModal = (item) => {
    setEditingItem(item);
    setNewItemForm({
      name: item.name,
      category_code: item.category_code || '',
      weight: item.weight || 100,
      notes: item.notes || ''
    });
    setShowAddItemModal(true);
  };
  
  const handleSaveItem = async () => {
    if (!newItemForm.name.trim()) {
      toast.error('Ingresá un nombre para el item');
      return;
    }
    
    try {
      setSaving(true);
      
      if (editingItem) {
        // Actualizar item existente
        const response = await api.put(`/units/${unitId}/progress/${editingItem.id}`, {
          name: newItemForm.name,
          category_code: newItemForm.category_code,
          weight: newItemForm.weight,
          notes: newItemForm.notes
        });
        
        if (response.data.success) {
          setUnit(prev => ({
            ...prev,
            progress_items: prev.progress_items.map(item =>
              item.id === editingItem.id ? { ...item, ...response.data.data.item } : item
            )
          }));
          toast.success('Item actualizado');
        }
      } else {
        // Crear nuevo item
        const response = await api.post(`/units/${unitId}/progress`, {
          name: newItemForm.name,
          category_code: newItemForm.category_code,
          weight: newItemForm.weight,
          notes: newItemForm.notes,
          status: 'pending',
          progress_percentage: 0
        });
        
        if (response.data.success) {
          setUnit(prev => ({
            ...prev,
            progress_items: [...(prev.progress_items || []), response.data.data.item]
          }));
          toast.success('Item agregado');
        }
      }
      
      setShowAddItemModal(false);
      setEditingItem(null);
      setNewItemForm({ name: '', category_code: '', weight: 100, notes: '' });
    } catch (error) {
      toast.error('Error al guardar item');
    } finally {
      setSaving(false);
    }
  };

  // Marcar como 100% completo
  const handleMarkComplete = async () => {
    if (!window.confirm('¿Marcar esta unidad como 100% completada? Todos los items pendientes se marcarán como completados.')) {
      return;
    }
    
    try {
      setSaving(true);
      const response = await api.post(`/units/${unitId}/complete`);
      if (response.data.success) {
        toast.success('Unidad marcada como completada');
        loadUnit();
        onUpdate?.();
      }
    } catch (error) {
      toast.error('Error al completar');
    } finally {
      setSaving(false);
    }
  };

  // Agregar documento (placeholder - necesita integración con storage)
  const handleAddDocument = async (file) => {
    // Por ahora solo simulamos
    toast.error('Funcionalidad de subida en desarrollo');
  };

  // Toggle categoría expandida
  const toggleCategory = (categoryCode) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryCode]: !prev[categoryCode]
    }));
  };

  // Agrupar items por categoría
  const groupedItems = unit?.progress_items?.reduce((acc, item) => {
    const key = item.category_code || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {}) || {};

  const formatCurrency = (value, currency = 'USD') => {
    if (!value) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/50" />
        <div className="relative bg-white rounded-2xl shadow-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  if (!unit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {unit.unit_name || unit.unit_code || 'Unidad'}
            </h2>
            <p className="text-sm text-slate-500">
              {unit.asset_name} • Piso {unit.floor_number || '-'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Progreso circular */}
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="4"
                />
                <circle
                  cx="28" cy="28" r="24"
                  fill="none"
                  stroke={unit.overall_progress === 100 ? '#22c55e' : '#3b82f6'}
                  strokeWidth="4"
                  strokeDasharray={`${(unit.overall_progress || 0) * 1.51} 151`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {unit.overall_progress || 0}%
              </span>
            </div>
            
            <button
              onClick={handleMarkComplete}
              disabled={saving || unit.construction_status === 'completed'}
              className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              100% Completado
            </button>
            
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {[
            { id: 'info', label: 'Información', icon: Building2 },
            { id: 'progress', label: 'Checklist', icon: ClipboardCheck },
            { id: 'documents', label: 'Documentos', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
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
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Tab: Información */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Estado Construcción</p>
                  <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${CONSTRUCTION_STATUS[unit.construction_status]?.color || ''}`}>
                    {CONSTRUCTION_STATUS[unit.construction_status]?.label || unit.construction_status}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Estado Venta</p>
                  <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${SALE_STATUS[unit.sale_status]?.color || ''}`}>
                    {SALE_STATUS[unit.sale_status]?.label || unit.sale_status}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Superficie Total</p>
                  <p className="font-semibold text-slate-800">{unit.total_area_m2 || '-'} m²</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500">Precio Lista</p>
                  <p className="font-semibold text-slate-800">{formatCurrency(unit.list_price, unit.currency)}</p>
                </div>
              </div>

              {/* Form de edición */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">Datos de la Unidad</h3>
                  {!editingInfo ? (
                    <button 
                      onClick={() => setEditingInfo(true)}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      Editar
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingInfo(false)}
                        className="text-sm text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSaveInfo}
                        disabled={saving}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Guardar
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">Código (auto-generado)</label>
                    <input
                      type="text"
                      name="unit_code"
                      value={formData.unit_code}
                      disabled={true}
                      className="input-field bg-slate-100 text-slate-600 cursor-not-allowed"
                      title="El código se genera automáticamente y no puede editarse"
                    />
                  </div>
                  <div>
                    <label className="form-label">Nombre</label>
                    <input
                      type="text"
                      name="unit_name"
                      value={formData.unit_name}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Piso</label>
                    <input
                      type="number"
                      name="floor_number"
                      value={formData.floor_number}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Orientación</label>
                    <select
                      name="orientation"
                      value={formData.orientation}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="N">Norte</option>
                      <option value="S">Sur</option>
                      <option value="E">Este</option>
                      <option value="O">Oeste</option>
                      <option value="NE">Noreste</option>
                      <option value="NO">Noroeste</option>
                      <option value="SE">Sureste</option>
                      <option value="SO">Suroeste</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="form-label">Sup. Total (m²)</label>
                    <input
                      type="number"
                      name="total_area_m2"
                      value={formData.total_area_m2}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      step="0.01"
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Sup. Cubierta (m²)</label>
                    <input
                      type="number"
                      name="covered_area_m2"
                      value={formData.covered_area_m2}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      step="0.01"
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Ambientes</label>
                    <input
                      type="number"
                      name="rooms"
                      value={formData.rooms}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Dormitorios</label>
                    <input
                      type="number"
                      name="bedrooms"
                      value={formData.bedrooms}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Baños</label>
                    <input
                      type="number"
                      name="bathrooms"
                      value={formData.bathrooms}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>

                  <div className="flex items-center gap-4 col-span-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="has_balcony"
                        checked={formData.has_balcony}
                        onChange={handleFormChange}
                        disabled={!editingInfo}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-700">Balcón</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="has_terrace"
                        checked={formData.has_terrace}
                        onChange={handleFormChange}
                        disabled={!editingInfo}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-700">Terraza</span>
                    </label>
                  </div>
                </div>

                {/* Precios */}
                <h4 className="font-medium text-slate-700 mt-6 mb-3">Precios y Venta</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">Moneda</label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    >
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Precio Lista</label>
                    <input
                      type="number"
                      name="list_price"
                      value={formData.list_price}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      step="0.01"
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Precio Venta</label>
                    <input
                      type="number"
                      name="sale_price"
                      value={formData.sale_price}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      step="0.01"
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Precio Alquiler</label>
                    <input
                      type="number"
                      name="rental_price"
                      value={formData.rental_price}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      step="0.01"
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="form-label">Estado Construcción</label>
                    <select
                      name="construction_status"
                      value={formData.construction_status}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    >
                      {Object.entries(CONSTRUCTION_STATUS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Estado Venta</label>
                    <select
                      name="sale_status"
                      value={formData.sale_status}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    >
                      {Object.entries(SALE_STATUS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Fecha Entrega</label>
                    <input
                      type="date"
                      name="delivery_date"
                      value={formData.delivery_date}
                      onChange={handleFormChange}
                      disabled={!editingInfo}
                      className="input-field disabled:bg-slate-50"
                    />
                  </div>
                </div>

                {/* Notas */}
                <div className="mt-4">
                  <label className="form-label">Notas</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    disabled={!editingInfo}
                    rows="3"
                    className="input-field disabled:bg-slate-50"
                    placeholder="Notas adicionales..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab: Checklist de Progreso */}
          {activeTab === 'progress' && (
            <div className="space-y-4">
              {/* Stats de progreso */}
              {unit.progress_stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{unit.progress_stats.completed}</p>
                    <p className="text-xs text-green-700">Completados</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{unit.progress_stats.in_progress}</p>
                    <p className="text-xs text-blue-700">En Progreso</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-slate-600">{unit.progress_stats.pending}</p>
                    <p className="text-xs text-slate-700">Pendientes</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{unit.progress_stats.blocked}</p>
                    <p className="text-xs text-red-700">Bloqueados</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-purple-600">{unit.progress_stats.avg_progress}%</p>
                    <p className="text-xs text-purple-700">Promedio</p>
                  </div>
                </div>
              )}

              {/* Si no hay items, mostrar botón para inicializar */}
              {(!unit.progress_items || unit.progress_items.length === 0) ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">Sin checklist de terminaciones</h3>
                  <p className="text-slate-500 mb-6 max-w-md mx-auto">
                    Inicializa el checklist para hacer seguimiento de todas las terminaciones: electricidad, plomería, pintura, etc.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleInitializeProgress}
                      disabled={saving}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Inicializar Checklist Completo
                    </button>
                    <button
                      onClick={() => setShowAddItemModal(true)}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Item Manual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Botón para agregar item personalizado - MÁS VISIBLE */}
                  <div className="flex justify-between items-center mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm text-blue-700">
                      ¿Necesitás agregar un item especial? Podés configurar su incidencia sobre la categoría.
                    </span>
                    <button
                      onClick={() => openAddItemModal()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar Item
                    </button>
                  </div>
                  
                  {/* Items agrupados por categoría */}
                  {Object.entries(groupedItems).map(([categoryCode, items]) => {
                    const isExpanded = expandedCategories[categoryCode] !== false;
                    // Excluir items "No Aplica" del conteo
                    const applicableItems = items.filter(i => i.status !== 'not_applicable');
                    const completedCount = applicableItems.filter(i => i.status === 'completed').length;
                    const totalCount = applicableItems.length;
                    const CategoryIcon = CATEGORY_ICONS[categoryCode] || CATEGORY_ICONS.default;
                    
                    // Calcular progreso ponderado de la categoría
                    const totalWeight = applicableItems.reduce((sum, i) => sum + (i.weight || 100), 0);
                    const weightedProgress = totalWeight > 0 
                      ? applicableItems.reduce((sum, i) => {
                          const itemWeight = i.weight || 100;
                          const itemProgress = i.progress_percentage || 0;
                          return sum + (itemProgress * itemWeight / totalWeight);
                        }, 0)
                      : 0;
                    
                    return (
                      <div key={categoryCode} className="border border-slate-200 rounded-xl overflow-hidden">
                        {/* Header de categoría */}
                        <button
                          onClick={() => toggleCategory(categoryCode)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <CategoryIcon className="w-5 h-5 text-slate-500" />
                            <span className="font-medium text-slate-800">
                              {items[0]?.category_name || categoryCode}
                            </span>
                            <span className="text-sm text-slate-500">
                              ({completedCount}/{totalCount}) · {Math.round(weightedProgress)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Botón agregar item a esta categoría */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddItemModal(categoryCode);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Agregar item a esta categoría"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            {/* Mini barra de progreso ponderado */}
                            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${weightedProgress}%` }}
                              />
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </button>
                        
                        {/* Items de la categoría */}
                        {isExpanded && (
                          <div className="divide-y divide-slate-100">
                            {items.map(item => {
                              const statusInfo = ITEM_STATUS[item.status] || ITEM_STATUS.pending;
                              const StatusIcon = statusInfo.icon;
                              
                              return (
                                <div key={item.id} className={`p-4 flex items-center justify-between hover:bg-slate-50 group ${
                                  item.status === 'not_applicable' ? 'opacity-50 bg-slate-50' : ''
                                }`}>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => {
                                        if (item.status === 'not_applicable') return; // No hacer nada si es No Aplica
                                        const nextStatus = item.status === 'completed' ? 'pending' : 
                                                          item.status === 'pending' ? 'in_progress' : 
                                                          item.status === 'in_progress' ? 'completed' : item.status;
                                        handleUpdateProgressItem(item.id, { status: nextStatus });
                                      }}
                                      disabled={item.status === 'not_applicable'}
                                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                        item.status === 'completed' 
                                          ? 'bg-green-500 text-white' 
                                          : item.status === 'in_progress'
                                          ? 'bg-blue-500 text-white'
                                          : item.status === 'not_applicable'
                                          ? 'bg-slate-200 text-slate-400'
                                          : 'border-2 border-slate-300 text-slate-400 hover:border-slate-400'
                                      }`}
                                    >
                                      {item.status === 'completed' && <Check className="w-4 h-4" />}
                                      {item.status === 'in_progress' && <Clock className="w-4 h-4" />}
                                      {item.status === 'not_applicable' && <Ban className="w-4 h-4" />}
                                    </button>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className={`font-medium ${
                                          item.status === 'completed' || item.status === 'not_applicable' 
                                            ? 'text-slate-400 line-through' 
                                            : 'text-slate-800'
                                        }`}>
                                          {item.name}
                                        </p>
                                        {/* Mostrar peso si no es 100% */}
                                        {item.weight && item.weight !== 100 && (
                                          <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                            {item.weight}% incidencia
                                          </span>
                                        )}
                                        {/* Botón editar */}
                                        <button
                                          onClick={() => openEditItemModal(item)}
                                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Editar item"
                                        >
                                          <Wrench className="w-3 h-3" />
                                        </button>
                                      </div>
                                      {item.notes && (
                                        <p className="text-xs text-slate-500">{item.notes}</p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {/* Si está marcado como No Aplica, mostrar botón Restaurar */}
                                    {item.status === 'not_applicable' ? (
                                      <button
                                        onClick={() => handleUpdateProgressItem(item.id, { 
                                          status: 'pending', 
                                          progress_percentage: 0 
                                        })}
                                        className="px-3 py-1 rounded text-xs font-medium text-green-600 hover:text-white hover:bg-green-500 border border-green-300 hover:border-green-500 transition-colors flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" />
                                        Restaurar Item
                                      </button>
                                    ) : (
                                      <>
                                        {/* Slider de progreso */}
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="10"
                                            value={item.progress_percentage || 0}
                                            onChange={(e) => handleUpdateProgressItem(item.id, { 
                                              progress_percentage: parseInt(e.target.value),
                                              status: parseInt(e.target.value) === 100 ? 'completed' : 
                                                      parseInt(e.target.value) > 0 ? 'in_progress' : 'pending'
                                            })}
                                            className="w-20 h-2 accent-primary-500"
                                          />
                                          <span className="text-sm text-slate-600 w-10 text-right">
                                            {item.progress_percentage || 0}%
                                          </span>
                                        </div>
                                        
                                        {/* Botón No Aplica - MÁS VISIBLE */}
                                        <button
                                          onClick={() => handleUpdateProgressItem(item.id, { 
                                            status: 'not_applicable', 
                                            progress_percentage: 0 
                                          })}
                                          title="Marcar como No Aplica (excluir del cálculo)"
                                          className="px-2 py-1 rounded text-xs font-medium text-red-600 hover:text-white hover:bg-red-500 border border-red-300 hover:border-red-500 transition-colors flex items-center gap-1"
                                        >
                                          <Ban className="w-3 h-3" />
                                          No Aplica
                                        </button>
                                      </>
                                    )}
                                    
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.color}`}>
                                      {statusInfo.label}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Documentos */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {/* Botón para subir */}
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-slate-800">Documentos y Fotos</h3>
                <label className="btn-primary inline-flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Subir Archivo
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => handleAddDocument(e.target.files[0])}
                  />
                </label>
              </div>

              {/* Grid de documentos */}
              {unit.documents && unit.documents.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {unit.documents.map(doc => (
                    <div key={doc.id} className="border border-slate-200 rounded-xl overflow-hidden group">
                      {doc.document_type === 'photo' || doc.mime_type?.startsWith('image/') ? (
                        <div className="aspect-square bg-slate-100 relative">
                          <img 
                            src={doc.thumbnail_url || doc.file_url} 
                            alt={doc.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full">
                              <Eye className="w-4 h-4" />
                            </a>
                            <a href={doc.file_url} download className="p-2 bg-white rounded-full">
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-square bg-slate-100 flex items-center justify-center">
                          <FileText className="w-12 h-12 text-slate-400" />
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-sm font-medium text-slate-800 truncate">{doc.name}</p>
                        <p className="text-xs text-slate-500">{doc.document_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">Sin documentos</h3>
                  <p className="text-slate-500">
                    Sube fotos del progreso, planos, facturas y otros documentos
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal para agregar/editar item */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Editar Item' : 'Agregar Item'}
              </h3>
              <button 
                onClick={() => {
                  setShowAddItemModal(false);
                  setEditingItem(null);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Nombre del Item */}
              <div>
                <label className="form-label">Nombre del Item *</label>
                <input
                  type="text"
                  value={newItemForm.name}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Cableado balcón, Instalación jacuzzi, etc."
                  className="input-field"
                  autoFocus
                />
              </div>

              {/* Categoría */}
              <div>
                <label className="form-label">Categoría</label>
                <select
                  value={newItemForm.category_code}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, category_code: e.target.value }))}
                  className="input-field"
                >
                  <option value="">Sin categoría (item general)</option>
                  {availableCategories.map(cat => (
                    <option key={cat.code} value={cat.code}>{cat.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  El item se agrupará con otros de la misma categoría
                </p>
              </div>

              {/* Peso/Incidencia */}
              <div>
                <label className="form-label">
                  Incidencia sobre la categoría: <span className="font-bold text-primary-600">{newItemForm.weight}%</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={newItemForm.weight}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, weight: parseInt(e.target.value) }))}
                  className="w-full h-2 accent-primary-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>1% (poco impacto)</span>
                  <span>100% (impacto total)</span>
                </div>
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded">
                  💡 Ejemplo: Si "Cableado balcón" tiene 10% de incidencia en Electricidad, 
                  al completarlo solo sumará un 10% al progreso de Electricidad.
                </p>
              </div>

              {/* Notas */}
              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea
                  value={newItemForm.notes}
                  onChange={(e) => setNewItemForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Detalles adicionales..."
                  className="input-field"
                  rows="2"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setEditingItem(null);
                  setNewItemForm({ name: '', category_code: '', weight: 100, notes: '' });
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveItem}
                disabled={saving || !newItemForm.name.trim()}
                className="btn-primary inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingItem ? 'Guardar Cambios' : 'Agregar Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitDetailModal;

