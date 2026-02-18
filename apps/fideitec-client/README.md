# FIDEITEC – App Cliente (iOS y Android)

App móvil del **portal de clientes** de FIDEITEC.  
Un mismo código para **iOS** y **Android** (React Native + Expo SDK 54).

## Qué hace la app

| Pantalla | Función |
|----------|---------|
| Portal token | El usuario ingresa el código de portal que le dio su administrador |
| Login | Email y contraseña contra la API del portal de clientes |
| Dashboard | Valor del portafolio, tokens, certificados y órdenes recientes (pull-to-refresh) |
| Perfil | Datos del cliente, estado KYC y cerrar sesión |

La API es la misma que usa el portal web (`/api/portal/...`).

## Arquitectura

```
apps/fideitec-client/
├── App.tsx                          # Navegación, ErrorBoundary, SafeAreaProvider
├── app.json                         # Config Expo (bundle IDs, splash)
├── src/
│   ├── api/
│   │   └── client.ts                # Axios con refresh queue + sesión expirada
│   ├── context/
│   │   └── ClientAuthContext.tsx     # Estado de auth + listener de sesión expirada
│   ├── screens/
│   │   ├── PortalTokenScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   └── ProfileScreen.tsx
│   ├── theme/
│   │   └── colors.ts                # Paleta centralizada
│   └── types/
│       ├── index.ts                 # Modelos de datos
│       └── navigation.ts            # Tipos de React Navigation
└── .env.example
```

### Decisiones clave

- **Refresh token con cola**: si 3 requests reciben 401 al mismo tiempo, solo la primera hace refresh; las demás esperan el resultado. Evita race conditions que invaliden la sesión.
- **Session expired listener**: cuando el refresh falla, el interceptor de Axios notifica al AuthContext vía callback para que el estado de React se sincronice (sin esto, la UI queda "autenticada" pero sin token válido).
- **Formateo seguro**: `Intl.NumberFormat` con fallback manual para dispositivos Android con soporte ICU limitado.
- **ErrorBoundary**: un crash en cualquier componente muestra pantalla de error recuperable en vez de cerrar la app.
- **SafeAreaProvider**: soporta correctamente iPhone con notch/Dynamic Island.

## Requisitos

- Node.js 18+
- **iOS**: Mac con Xcode (solo en Mac se puede buildear iOS)
- **Android**: Android Studio con SDK, o probar en Expo Go
- Cuenta [Expo](https://expo.dev) (opcional, para EAS Build)

## Configuración

```bash
cd apps/fideitec-client
npm install
cp .env.example .env
```

Editar `.env`:
- Producción: `EXPO_PUBLIC_API_URL=https://fideitec-api.onrender.com`
- Local (emulador): `EXPO_PUBLIC_API_URL=http://localhost:3000`
- Dispositivo físico: `EXPO_PUBLIC_API_URL=http://TU_IP:3000`

## Ejecutar en desarrollo

```bash
npm start        # Abre Expo DevTools
npm run ios      # iOS Simulator (solo Mac)
npm run android  # Android Emulator
```

O escanear el QR con **Expo Go** en el dispositivo físico.

## Build para producción

### EAS Build (recomendado)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all    # iOS + Android
```

Para **iOS** se necesita Apple Developer Program.
Para **Android** EAS genera el keystore automáticamente.

### Build local

```bash
npx expo prebuild
npx expo run:ios --configuration Release     # iOS (Mac)
npx expo run:android --variant release       # Android
```

## Bundle identifiers

| Plataforma | ID |
|------------|----|
| iOS | `com.fideitec.client` |
| Android | `com.fideitec.client` |

Cambiar en `app.json` → `ios.bundleIdentifier` / `android.package`.
