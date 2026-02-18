import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  api,
  clearClientSession,
  registerSessionExpiredListener,
  unregisterSessionExpiredListener,
} from '../api/client';
import type { Client, Tenant } from '../types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
type AuthContextType = {
  client: Client | null;
  tenant: Tenant | null;
  portalToken: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  setError: (e: string | null) => void;
  login: (portalToken: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  getTenantInfo: (portalToken: string) => Promise<{ success: boolean; tenant?: Tenant; message?: string }>;
  setPortalToken: (token: string | null) => Promise<void>;
};

const ClientAuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [portalToken, setPortalTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref para evitar updates en componente desmontado
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -----------------------------------------------------------------------
  // Listener de sesión expirada (registrado en el interceptor de Axios).
  // Cuando el refresh de token falla, el interceptor llama a este callback
  // para que el estado de React se sincronice con SecureStore ya limpio.
  // -----------------------------------------------------------------------
  useEffect(() => {
    registerSessionExpiredListener(() => {
      if (!mountedRef.current) return;
      setClient(null);
      setTenant(null);
    });
    return () => {
      unregisterSessionExpiredListener();
    };
  }, []);

  // -----------------------------------------------------------------------
  // Setter de portalToken persistente.
  // Devuelve Promise<void> para que quien lo llame pueda hacer `await`.
  // -----------------------------------------------------------------------
  const setPortalToken = useCallback(async (token: string | null): Promise<void> => {
    setPortalTokenState(token);
    if (token) {
      await SecureStore.setItemAsync('portalToken', token);
    } else {
      await SecureStore.deleteItemAsync('portalToken');
    }
  }, []);

  // -----------------------------------------------------------------------
  // Restaurar sesión al iniciar la app
  // -----------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [token, savedPortal, savedTenant] = await Promise.all([
          SecureStore.getItemAsync('clientAccessToken'),
          SecureStore.getItemAsync('portalToken'),
          SecureStore.getItemAsync('portalTenant'),
        ]);

        if (cancelled) return;

        if (savedPortal) setPortalTokenState(savedPortal);

        if (token) {
          try {
            const res = await api.get('/portal/client/me');
            if (res.data.success && !cancelled) {
              setClient(res.data.data.client);
              if (savedTenant) {
                setTenant(JSON.parse(savedTenant));
              } else if (res.data.data.tenant) {
                setTenant(res.data.data.tenant);
                await SecureStore.setItemAsync(
                  'portalTenant',
                  JSON.stringify(res.data.data.tenant),
                );
              }
            }
          } catch {
            if (!cancelled) {
              await clearClientSession();
              setClient(null);
              setTenant(null);
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------------
  const login = useCallback(async (pt: string, email: string, password: string) => {
    setError(null);
    try {
      const response = await api.post(`/portal/${pt}/login`, { email, password });
      if (!response.data.success) {
        return { success: false, message: response.data.message || 'Error al iniciar sesión' };
      }

      const {
        client: clientData,
        tenant: tenantData,
        accessToken,
        refreshToken,
      } = response.data.data;

      // Guardar todo en SecureStore en paralelo
      await Promise.all([
        SecureStore.setItemAsync('clientAccessToken', accessToken),
        SecureStore.setItemAsync('clientRefreshToken', refreshToken),
        SecureStore.setItemAsync('portalTenant', JSON.stringify(tenantData)),
        SecureStore.setItemAsync('portalToken', pt),
      ]);

      setClient(clientData);
      setTenant(tenantData);
      setPortalTokenState(pt);
      return { success: true };
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Error al iniciar sesión';
      setError(msg);
      return { success: false, message: msg };
    }
  }, []);

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('clientRefreshToken');
      if (refreshToken) {
        await api.post('/portal/client/logout', { refreshToken }).catch(() => {});
      }
    } catch {
      // Si falla el logout en el server, seguimos igual
    }
    await clearClientSession();
    setClient(null);
    setTenant(null);
  }, []);

  // -----------------------------------------------------------------------
  // Obtener info de tenant por portal token
  // -----------------------------------------------------------------------
  const getTenantInfo = useCallback(async (pt: string) => {
    try {
      const res = await api.get(`/portal/${pt}`);
      if (res.data.success) {
        return { success: true, tenant: res.data.data.tenant as Tenant };
      }
      return { success: false, message: res.data.message };
    } catch {
      return { success: false, message: 'Portal no disponible' };
    }
  }, []);

  // -----------------------------------------------------------------------
  // Value del context
  // -----------------------------------------------------------------------
  const value: AuthContextType = {
    client,
    tenant,
    portalToken,
    loading,
    error,
    isAuthenticated: !!client,
    setError,
    login,
    logout,
    getTenantInfo,
    setPortalToken,
  };

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth debe usarse dentro de ClientAuthProvider');
  return ctx;
}
