import axios from 'axios';

// En producción, VITE_API_URL será la URL del backend
// Puede ser solo el hostname (fideitec-api.onrender.com) o la URL completa
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  
  // Si ya tiene protocolo, usarlo directamente
  if (envUrl.startsWith('http')) {
    return `${envUrl}/api`;
  }
  // Si no tiene protocolo, agregar https
  return `https://${envUrl}/api`;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Detectar si estamos en el portal de clientes
const isClientPortal = () => {
  // Primero verificar por URL
  const byUrl = window.location.pathname.includes('/portal/') && 
                !window.location.pathname.includes('/supplier-portal/');
  
  // También verificar si hay tokens de cliente guardados (más confiable)
  const hasClientToken = !!localStorage.getItem('clientAccessToken');
  const hasCompanyToken = !!localStorage.getItem('accessToken');
  
  // Si la URL indica portal Y hay token de cliente, es portal
  if (byUrl && hasClientToken) return true;
  // Si la URL indica portal pero no hay token de cliente, aún así es portal
  if (byUrl && !hasCompanyToken) return true;
  
  return false;
};

// Obtener el token correcto según el contexto
const getToken = () => {
  // Si estamos en el portal de clientes, usar clientAccessToken
  if (isClientPortal()) {
    const clientToken = localStorage.getItem('clientAccessToken');
    if (clientToken) return clientToken;
  }
  // Si no, usar el token de empresa
  return localStorage.getItem('accessToken');
};

// Interceptor para agregar token a las requests
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Rutas públicas donde no se debe redirigir al login
const publicPaths = ['/reset-password', '/forgot-password', '/verify-email', '/register', '/login', '/privacy', '/terms', '/data-deletion', '/portal', '/supplier-portal'];

const isPublicPath = () => {
  const currentPath = window.location.pathname;
  return publicPaths.some(path => currentPath.startsWith(path));
};

// Interceptor para manejar respuestas y refresh de token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si no hay respuesta (error de red), no hacer nada especial
    if (!error.response) {
      console.error('Error de red:', error.message);
      return Promise.reject(error);
    }

    // Si el error es 401 y no hemos intentado refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Determinar qué tipo de refresh hacer
        const isClient = isClientPortal();
        const refreshToken = isClient 
          ? localStorage.getItem('clientRefreshToken')
          : null;
        
        // Endpoint de refresh según el tipo de usuario
        const refreshUrl = isClient 
          ? `${API_URL}/portal/client/refresh`
          : `${API_URL}/auth/refresh`;
        
        const response = await axios.post(refreshUrl, 
          isClient ? { refreshToken } : {},
          { withCredentials: true }
        );

        const { accessToken } = response.data.data;
        
        // Guardar nuevo token en el storage correcto
        if (isClient) {
          localStorage.setItem('clientAccessToken', accessToken);
        } else {
          localStorage.setItem('accessToken', accessToken);
        }
        
        // Reintentar request original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Si falla el refresh, limpiar tokens
        if (isClientPortal()) {
          localStorage.removeItem('clientAccessToken');
          localStorage.removeItem('clientRefreshToken');
          localStorage.removeItem('portalTenant');
        } else {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
        
        // Solo redirigir al login si NO estamos en una ruta pública
        if (!isPublicPath()) {
          // Redirigir al login correcto
          if (isClientPortal()) {
            // Extraer el portal token de la URL
            const match = window.location.pathname.match(/\/portal\/([^/]+)/);
            if (match) {
              window.location.href = `/portal/${match[1]}/login`;
            }
          } else {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshError);
      }
    }

    // Para errores 403, 404, 500, etc. - NO redirigir, solo propagar el error
    return Promise.reject(error);
  }
);

export default api;

