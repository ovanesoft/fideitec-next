import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// ---------------------------------------------------------------------------
// URL del backend
// ---------------------------------------------------------------------------
const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!envUrl) return 'https://fideitec-api.onrender.com/api';
  if (envUrl.startsWith('http')) return `${envUrl}/api`;
  return `https://${envUrl}/api`;
};

export const API_URL = getApiUrl();

// ---------------------------------------------------------------------------
// Instancia de Axios
// ---------------------------------------------------------------------------
export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ---------------------------------------------------------------------------
// Callback de sesión expirada
// El AuthContext registra un listener para enterarse cuando el interceptor
// detecta que la sesión murió (refresh falló). Sin esto, el interceptor
// limpia SecureStore pero el estado de React sigue mostrando al usuario
// como autenticado → la app queda en un estado roto.
// ---------------------------------------------------------------------------
type SessionExpiredListener = () => void;
let _onSessionExpired: SessionExpiredListener | null = null;

export function registerSessionExpiredListener(fn: SessionExpiredListener) {
  _onSessionExpired = fn;
}

export function unregisterSessionExpiredListener() {
  _onSessionExpired = null;
}

// ---------------------------------------------------------------------------
// Request interceptor: inyecta token en cada request
// ---------------------------------------------------------------------------
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('clientAccessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor: refresh automático con cola para requests concurrentes
//
// Sin la cola, si 3 requests reciben 401 al mismo tiempo, cada una intenta
// refrescar el token por separado. Si el backend invalida el refresh token
// tras un uso, la 2ª y 3ª fallan → sesión perdida innecesariamente.
//
// Con la cola: la 1ª hace refresh, las demás esperan su resultado.
// ---------------------------------------------------------------------------
type OriginalRequest = InternalAxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let refreshRejectSubscribers: Array<(err: unknown) => void> = [];

function subscribeToRefresh(resolve: (token: string) => void, reject: (err: unknown) => void) {
  refreshSubscribers.push(resolve);
  refreshRejectSubscribers.push(reject);
}

function onRefreshSuccess(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
  refreshRejectSubscribers = [];
}

function onRefreshFailure(err: unknown) {
  refreshRejectSubscribers.forEach((cb) => cb(err));
  refreshSubscribers = [];
  refreshRejectSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as OriginalRequest | undefined;
    if (!originalRequest) return Promise.reject(error);

    // Solo intentar refresh en 401 y si no lo intentamos ya
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Si ya hay un refresh en curso, encolar esta request
    if (isRefreshing) {
      return new Promise<typeof error>((resolve, reject) => {
        subscribeToRefresh(
          (newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest) as never);
          },
          (refreshErr: unknown) => reject(refreshErr),
        );
      });
    }

    // Soy el primero: hacer refresh
    isRefreshing = true;

    try {
      const refreshToken = await SecureStore.getItemAsync('clientRefreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      // Usar axios crudo (no la instancia `api`) para evitar loops del interceptor
      const res = await axios.post(`${API_URL}/portal/client/refresh`, { refreshToken });
      const accessToken: string | undefined = res.data?.data?.accessToken;

      if (!accessToken) {
        throw new Error('Refresh response missing accessToken');
      }

      await SecureStore.setItemAsync('clientAccessToken', accessToken);

      // Notificar a las requests encoladas
      onRefreshSuccess(accessToken);

      // Reintentar la request original
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshErr) {
      // Refresh falló → sesión muerta
      onRefreshFailure(refreshErr);
      await clearClientSession();
      _onSessionExpired?.();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

// ---------------------------------------------------------------------------
// Limpiar SecureStore
// ---------------------------------------------------------------------------
export async function clearClientSession() {
  await Promise.all([
    SecureStore.deleteItemAsync('clientAccessToken').catch(() => {}),
    SecureStore.deleteItemAsync('clientRefreshToken').catch(() => {}),
    SecureStore.deleteItemAsync('portalTenant').catch(() => {}),
    SecureStore.deleteItemAsync('portalToken').catch(() => {}),
  ]);
}
