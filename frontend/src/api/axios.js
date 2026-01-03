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

// Interceptor para agregar token a las requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
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
        // Intentar refresh del token
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
          withCredentials: true
        });

        const { accessToken } = response.data.data;
        
        // Guardar nuevo token
        localStorage.setItem('accessToken', accessToken);
        
        // Reintentar request original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Si falla el refresh, limpiar tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        
        // Solo redirigir al login si NO estamos en una ruta pública
        if (!isPublicPath()) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Para errores 403, 404, 500, etc. - NO redirigir, solo propagar el error
    return Promise.reject(error);
  }
);

export default api;

