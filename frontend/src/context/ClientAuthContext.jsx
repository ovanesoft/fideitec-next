import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const ClientAuthContext = createContext(null);

export const ClientAuthProvider = ({ children }) => {
  const [client, setClient] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar si hay una sesión activa al cargar
  useEffect(() => {
    const checkAuth = async () => {
      // Check for OAuth callback tokens in URL FIRST
      const params = new URLSearchParams(window.location.search);
      const oauthToken = params.get('token');
      const oauthRefresh = params.get('refresh');
      
      if (oauthToken) {
        console.log('Client OAuth token detected, saving...');
        localStorage.setItem('clientAccessToken', oauthToken);
        if (oauthRefresh) {
          console.log('Client OAuth refresh token detected, saving...');
          localStorage.setItem('clientRefreshToken', oauthRefresh);
        }
        // Limpiar sessionStorage del OAuth
        sessionStorage.removeItem('oauth_portal_token');
        // Limpiar URL (importante: hacer esto DESPUÉS de guardar los tokens)
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Esperar un tick para que localStorage se sincronice
      await new Promise(resolve => setTimeout(resolve, 50));

      const token = localStorage.getItem('clientAccessToken');
      const savedTenant = localStorage.getItem('portalTenant');
      
      if (token) {
        try {
          // El interceptor de axios ya lee el token de localStorage
          const response = await api.get('/portal/client/me');
          if (response.data.success) {
            setClient(response.data.data.client);
            // Si hay savedTenant, usar ese, si no, guardar el del response
            if (savedTenant) {
              setTenant(JSON.parse(savedTenant));
            } else if (response.data.data.tenant) {
              setTenant(response.data.data.tenant);
              localStorage.setItem('portalTenant', JSON.stringify(response.data.data.tenant));
            }
          }
        } catch (err) {
          console.error('Error verificando sesión de cliente:', err);
          localStorage.removeItem('clientAccessToken');
          localStorage.removeItem('clientRefreshToken');
          localStorage.removeItem('portalTenant');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Login de cliente
  const login = async (portalToken, email, password) => {
    try {
      setError(null);
      const response = await api.post(`/portal/${portalToken}/login`, {
        email,
        password
      });

      if (response.data.success) {
        const { client: clientData, tenant: tenantData, accessToken, refreshToken } = response.data.data;
        
        localStorage.setItem('clientAccessToken', accessToken);
        localStorage.setItem('clientRefreshToken', refreshToken);
        localStorage.setItem('portalTenant', JSON.stringify(tenantData));
        
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        
        setClient(clientData);
        setTenant(tenantData);
        
        return { success: true };
      }

      return { success: false, message: response.data.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al iniciar sesión';
      setError(message);
      return { success: false, message };
    }
  };

  // Registro de cliente
  const register = async (portalToken, data) => {
    try {
      setError(null);
      const response = await api.post(`/portal/${portalToken}/register`, data);

      if (response.data.success) {
        return { success: true, message: response.data.message };
      }

      return { success: false, message: response.data.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al registrar';
      setError(message);
      return { success: false, message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('clientRefreshToken');
      await api.post('/portal/client/logout', { refreshToken });
    } catch (err) {
      console.error('Error en logout:', err);
    } finally {
      localStorage.removeItem('clientAccessToken');
      localStorage.removeItem('clientRefreshToken');
      localStorage.removeItem('portalTenant');
      delete api.defaults.headers.common['Authorization'];
      setClient(null);
      setTenant(null);
    }
  };

  // Obtener información del tenant por token del portal
  const getTenantInfo = async (portalToken) => {
    try {
      const response = await api.get(`/portal/${portalToken}`);
      if (response.data.success) {
        return { success: true, tenant: response.data.data.tenant };
      }
      return { success: false, message: response.data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Portal no disponible' 
      };
    }
  };

  // Forgot password
  const forgotPassword = async (portalToken, email) => {
    try {
      const response = await api.post(`/portal/${portalToken}/forgot-password`, { email });
      return { success: true, message: response.data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Error al procesar solicitud' 
      };
    }
  };

  // Reset password
  const resetPassword = async (token, password) => {
    try {
      const response = await api.post('/portal/reset-password', { token, password });
      return { success: response.data.success, message: response.data.message };
    } catch (err) {
      return { 
        success: false, 
        message: err.response?.data?.message || 'Error al restablecer contraseña' 
      };
    }
  };

  // Google OAuth login
  const googleLogin = (portalToken) => {
    // Guardar el portalToken para recuperarlo después del callback
    sessionStorage.setItem('oauth_portal_token', portalToken);
    
    // Redirigir al mismo endpoint de Google que usa empresa
    // El callback detectará que es del portal por la cookie/sessionStorage
    const baseUrl = import.meta.env.VITE_API_URL || '';
    window.location.href = `${baseUrl}/api/portal/${portalToken}/auth/google`;
  };

  const value = {
    client,
    tenant,
    loading,
    error,
    setError,
    login,
    register,
    logout,
    getTenantInfo,
    forgotPassword,
    resetPassword,
    googleLogin,
    isAuthenticated: !!client
  };

  return (
    <ClientAuthContext.Provider value={value}>
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => {
  const context = useContext(ClientAuthContext);
  if (!context) {
    throw new Error('useClientAuth debe usarse dentro de ClientAuthProvider');
  }
  return context;
};

