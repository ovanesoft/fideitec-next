import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';

const SupplierAuthContext = createContext();

export const SupplierAuthProvider = ({ children }) => {
  const [supplier, setSupplier] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [currentPortalToken, setCurrentPortalToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Verificar si hay sesión guardada
  useEffect(() => {
    const storedSupplier = localStorage.getItem('supplierData');
    const storedToken = localStorage.getItem('supplierToken');
    const storedPortalToken = localStorage.getItem('supplierPortalToken');
    
    if (storedSupplier && storedToken) {
      try {
        setSupplier(JSON.parse(storedSupplier));
        if (storedPortalToken) {
          setCurrentPortalToken(storedPortalToken);
        }
      } catch (e) {
        localStorage.removeItem('supplierData');
        localStorage.removeItem('supplierToken');
        localStorage.removeItem('supplierPortalToken');
      }
    }
    setLoading(false);
  }, []);

  // Cargar información del tenant
  const loadTenantInfo = async (portalToken) => {
    if (!portalToken) return null;
    
    try {
      const response = await axios.get(`/supplier-portal/${portalToken}`);
      if (response.data.success) {
        setTenant(response.data.data.tenant);
        setCurrentPortalToken(portalToken);
        return response.data.data.tenant;
      }
    } catch (err) {
      console.error('Error cargando tenant:', err);
      setError(err.response?.data?.message || 'Portal no disponible');
    }
    return null;
  };

  // Login de proveedor
  const loginSupplier = async (portalToken, email, password) => {
    try {
      setError(null);
      const response = await axios.post(`/supplier-portal/${portalToken}/login`, {
        email,
        password
      });

      if (response.data.success) {
        const { supplier: supplierData, accessToken } = response.data.data;
        setSupplier(supplierData);
        setCurrentPortalToken(portalToken);
        localStorage.setItem('supplierData', JSON.stringify(supplierData));
        localStorage.setItem('supplierToken', accessToken);
        localStorage.setItem('supplierPortalToken', portalToken);
        return { success: true };
      }

      return { success: false, message: response.data.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al iniciar sesión';
      setError(message);
      return { success: false, message };
    }
  };

  // Setup de contraseña (primera vez)
  const setupPassword = async (portalToken, inviteToken, password) => {
    try {
      setError(null);
      const response = await axios.post(`/supplier-portal/${portalToken}/setup/${inviteToken}`, {
        password
      });

      if (response.data.success) {
        const { supplier: supplierData, accessToken } = response.data.data;
        setSupplier(supplierData);
        setCurrentPortalToken(portalToken);
        localStorage.setItem('supplierData', JSON.stringify(supplierData));
        localStorage.setItem('supplierToken', accessToken);
        localStorage.setItem('supplierPortalToken', portalToken);
        return { success: true };
      }

      return { success: false, message: response.data.message };
    } catch (err) {
      const message = err.response?.data?.message || 'Error al configurar contraseña';
      setError(message);
      return { success: false, message };
    }
  };

  // Logout
  const logoutSupplier = async (portalToken) => {
    const token = portalToken || currentPortalToken;
    try {
      await axios.post('/supplier-portal/logout');
    } catch (err) {
      console.error('Error en logout:', err);
    } finally {
      setSupplier(null);
      setTenant(null);
      localStorage.removeItem('supplierData');
      localStorage.removeItem('supplierToken');
      localStorage.removeItem('supplierPortalToken');
      if (token) {
        navigate(`/supplier-portal/${token}/login`);
      }
    }
  };

  const value = {
    supplier,
    tenant,
    loading,
    error,
    setError,
    loadTenantInfo,
    loginSupplier,
    setupPassword,
    logoutSupplier,
    isAuthenticated: !!supplier,
    portalToken: currentPortalToken
  };

  return (
    <SupplierAuthContext.Provider value={value}>
      {children}
    </SupplierAuthContext.Provider>
  );
};

export const useSupplierAuth = () => {
  const context = useContext(SupplierAuthContext);
  if (!context) {
    throw new Error('useSupplierAuth debe usarse dentro de SupplierAuthProvider');
  }
  return context;
};

