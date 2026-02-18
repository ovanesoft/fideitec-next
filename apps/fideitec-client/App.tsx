import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ClientAuthProvider, useClientAuth } from './src/context/ClientAuthContext';
import PortalTokenScreen from './src/screens/PortalTokenScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import MarketplaceScreen from './src/screens/MarketplaceScreen';
import PortfolioScreen from './src/screens/PortfolioScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { Colors } from './src/theme/colors';
import type { AuthStackParamList, MainTabParamList } from './src/types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------
type EBState = { hasError: boolean; error?: Error };
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { hasError: false };
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color={Colors.error} />
        <Text style={styles.errorTitle}>Algo salió mal</Text>
        <Text style={styles.errorMessage}>{this.state.error?.message}</Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => this.setState({ hasError: false })}>
          <Text style={styles.errorButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
}

// ---------------------------------------------------------------------------
// Tab icons map
// ---------------------------------------------------------------------------
const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  Inicio: { active: 'grid', inactive: 'grid-outline' },
  Marketplace: { active: 'cart', inactive: 'cart-outline' },
  Portfolio: { active: 'wallet', inactive: 'wallet-outline' },
  Ordenes: { active: 'time', inactive: 'time-outline' },
  Perfil: { active: 'person', inactive: 'person-outline' },
};

// ---------------------------------------------------------------------------
// Main Tabs (authenticated)
// ---------------------------------------------------------------------------
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: { borderTopColor: Colors.border, backgroundColor: Colors.surface },
        headerStyle: { backgroundColor: Colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', color: Colors.textPrimary },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = TAB_ICONS[route.name] ?? TAB_ICONS.Inicio;
          return <Ionicons name={(focused ? icons.active : icons.inactive) as never} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: 'Comprar' }} />
      <Tab.Screen name="Portfolio" component={PortfolioScreen} options={{ title: 'Portfolio' }} />
      <Tab.Screen name="Ordenes" component={OrdersScreen} options={{ title: 'Órdenes' }} />
      <Tab.Screen name="Perfil" component={ProfileScreen} options={{ title: 'Mi cuenta' }} />
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Auth flow (not authenticated)
// ---------------------------------------------------------------------------
function AuthFlow() {
  const { portalToken } = useClientAuth();
  return (
    <Stack.Navigator
      initialRouteName={portalToken ? 'Login' : 'PortalToken'}
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="PortalToken" options={{ headerShown: false }}>
        {({ navigation }) => <PortalTokenScreen onNext={() => navigation.replace('Login')} />}
      </Stack.Screen>
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión', headerBackVisible: true, headerBackTitle: 'Atrás' }} />
    </Stack.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
function RootNavigator() {
  const { isAuthenticated, loading } = useClientAuth();
  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </SafeAreaView>
    );
  }
  return isAuthenticated ? <MainTabs /> : <AuthFlow />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClientAuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="dark" />
        </ClientAuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 15 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 32, gap: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  errorMessage: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  errorButton: { marginTop: 16, backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14 },
  errorButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
