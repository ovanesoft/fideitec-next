import { useState, useEffect } from 'react';
import { 
  Globe, X, Loader2, CheckCircle2, AlertTriangle, 
  Image, Type, FileText, Star, ArrowRight, ExternalLink,
  Building2, Info
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const PublishModal = ({ asset, onClose, onPublished }) => {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [status, setStatus] = useState(null);

  // Form data for publishing
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState('');
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [asset?.id]);

  const loadStatus = async () => {
    if (!asset?.id) return;
    setLoading(true);
    try {
      const response = await api.get(`/assets/${asset.id}/publish-status`);
      if (response.data.success) {
        const d = response.data.data;
        setStatus(d);
        setTitle(d.marketplace_title || '');
        setDescription(d.marketplace_description || '');
        setImages((d.marketplace_images || []).join('\n'));
        setFeatured(d.marketplace_featured || false);
      }
    } catch (err) {
      toast.error('Error al cargar estado de publicación');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const response = await api.post(`/assets/${asset.id}/publish`, {
        marketplace_title: title || null,
        marketplace_description: description || null,
        marketplace_images: images.split('\n').map(u => u.trim()).filter(Boolean),
        marketplace_featured: featured
      });

      if (response.data.success) {
        const actions = response.data.data.actions;
        let msg = '¡Publicado en el marketplace!';
        if (actions.status_changed) msg += ' El estado pasó a "Activo".';
        if (actions.tenant_marketplace_enabled === 'Se habilitó automáticamente') {
          msg += ' Se habilitó tu empresa en el marketplace.';
        }
        toast.success(msg, { duration: 5000 });
        onPublished?.();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al publicar');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    try {
      const response = await api.post(`/assets/${asset.id}/unpublish`);
      if (response.data.success) {
        toast.success('Retirado del marketplace');
        onPublished?.();
        onClose();
      }
    } catch (err) {
      toast.error('Error al retirar del marketplace');
    } finally {
      setUnpublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl p-8 max-w-md w-full animate-fade-in">
          <div className="flex justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  const isPublished = status?.is_published;
  const canPublish = status?.can_publish;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className={`px-6 py-4 rounded-t-2xl ${isPublished ? 'bg-green-50 border-b border-green-200' : 'bg-blue-50 border-b border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPublished ? 'bg-green-100' : 'bg-blue-100'}`}>
                <Globe className={`w-5 h-5 ${isPublished ? 'text-green-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">
                  {isPublished ? 'Publicado en Marketplace' : 'Publicar en Marketplace'}
                </h2>
                <p className="text-xs text-slate-500">{asset.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Warnings */}
          {status?.warnings?.length > 0 && !isPublished && (
            <div className="space-y-2">
              {status.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-800">{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* Already published */}
          {isPublished && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-800">Este activo está publicado</p>
                <p className="text-sm text-green-600 mt-1">
                  Visible en el marketplace desde {status.published_at ? new Date(status.published_at).toLocaleDateString('es-AR') : 'hoy'}
                </p>
                <a 
                  href={`/marketplace/project/${asset.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2"
                >
                  Ver en marketplace <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1.5">
                <Type className="w-4 h-4 text-slate-400" />
                Título para el marketplace
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={asset.name || 'Título atractivo del proyecto...'}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Si se deja vacío, se usa el nombre del activo</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                Descripción para inversores
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción atractiva del proyecto que verán los inversores en el marketplace..."
                rows="3"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1.5">
                <Image className="w-4 h-4 text-slate-400" />
                Fotos del proyecto (URLs)
              </label>
              <textarea
                value={images}
                onChange={(e) => setImages(e.target.value)}
                placeholder={"https://tu-imagen.com/foto1.jpg\nhttps://tu-imagen.com/foto2.jpg"}
                rows="3"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono text-xs"
              />
              <p className="text-xs text-slate-400 mt-1">Una URL por línea. Podés subir fotos a Cloudinary y pegar las URLs.</p>
            </div>

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <input
                type="checkbox"
                id="pub-featured"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="pub-featured" className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <Star className="w-4 h-4 text-amber-500" />
                Marcar como proyecto destacado
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            {!isPublished ? (
              <button
                onClick={handlePublish}
                disabled={publishing || !canPublish}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Globe className="w-5 h-5" />
                )}
                {publishing ? 'Publicando...' : 'Publicar en el Marketplace'}
              </button>
            ) : (
              <>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {publishing ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button
                  onClick={handleUnpublish}
                  disabled={unpublishing}
                  className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 py-2.5 px-6 rounded-xl font-medium hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  {unpublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {unpublishing ? 'Retirando...' : 'Retirar del marketplace'}
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublishModal;
