/**
 * Storage Service - Abstracción para almacenamiento de archivos
 * Actualmente usa Cloudinary, pero se puede cambiar a S3, etc.
 */

const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Carpeta raíz para esta aplicación
const APP_FOLDER = 'fideitec';

/**
 * Subir archivo a Cloudinary
 * @param {Buffer|string} file - Buffer del archivo o path local
 * @param {object} options - Opciones de subida
 * @returns {Promise<object>} - Resultado con url, public_id, etc.
 */
const uploadFile = async (file, options = {}) => {
  const {
    folder = '',
    resourceType = 'auto', // auto, image, video, raw (para PDFs)
    fileName = null,
    tags = []
  } = options;

  // Construir path completo
  const fullFolder = folder ? `${APP_FOLDER}/${folder}` : APP_FOLDER;

  try {
    // Si es un buffer, convertir a base64
    const uploadSource = Buffer.isBuffer(file) 
      ? `data:application/octet-stream;base64,${file.toString('base64')}`
      : file;

    const result = await cloudinary.uploader.upload(uploadSource, {
      folder: fullFolder,
      resource_type: resourceType,
      public_id: fileName,
      tags: ['fideitec', ...tags],
      // Opciones para imágenes
      transformation: resourceType === 'image' ? [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ] : undefined
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes,
      width: result.width,
      height: result.height,
      resourceType: result.resource_type
    };
  } catch (error) {
    console.error('Error subiendo archivo a Cloudinary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Eliminar archivo de Cloudinary
 * @param {string} publicId - ID público del archivo
 * @param {string} resourceType - Tipo de recurso (image, video, raw)
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return { success: result.result === 'ok' };
  } catch (error) {
    console.error('Error eliminando archivo:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Generar URL de thumbnail para una imagen
 * @param {string} url - URL original de Cloudinary
 * @param {object} options - Opciones de transformación
 */
const getThumbnailUrl = (url, options = {}) => {
  const { width = 200, height = 200, crop = 'fill' } = options;
  
  // Insertar transformación en la URL de Cloudinary
  // URL format: https://res.cloudinary.com/cloud/image/upload/v123/folder/file.jpg
  // Transformed: https://res.cloudinary.com/cloud/image/upload/w_200,h_200,c_fill/v123/folder/file.jpg
  
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  return `${parts[0]}/upload/w_${width},h_${height},c_${crop}/${parts[1]}`;
};

/**
 * Obtener URL optimizada para una imagen
 * @param {string} url - URL original
 * @param {object} options - Opciones
 */
const getOptimizedUrl = (url, options = {}) => {
  const { width, quality = 'auto' } = options;
  
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  let transformation = `q_${quality},f_auto`;
  if (width) transformation += `,w_${width}`;

  return `${parts[0]}/upload/${transformation}/${parts[1]}`;
};

module.exports = {
  uploadFile,
  deleteFile,
  getThumbnailUrl,
  getOptimizedUrl,
  cloudinary // Exportar instancia por si se necesita acceso directo
};

