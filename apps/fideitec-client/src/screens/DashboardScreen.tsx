import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useClientAuth } from '../context/ClientAuthContext';
import { api } from '../api/client';
import { Colors } from '../theme/colors';
import { formatCurrency, formatNumber } from '../utils/format';
import type { TokenHolder, Order } from '../types';
import type { MainTabParamList } from '../types/navigation';

type Nav = BottomTabNavigationProp<MainTabParamList, 'Inicio'>;

export default function DashboardScreen() {
  const nav = useNavigation<Nav>();
  const { client, tenant } = useClientAuth();
  const [tokens, setTokens] = useState<TokenHolder[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [certCount, setCertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setErrorMsg(null);
    try {
      const [tRes, cRes, oRes] = await Promise.all([
        api.get('/portal/client/tokens'),
        api.get('/portal/client/certificates'),
        api.get('/portal/client/orders'),
      ]);
      const tList: TokenHolder[] = tRes.data?.data?.tokens ?? [];
      const oList: Order[] = oRes.data?.data?.orders ?? [];
      setTokens(tList);
      setCertCount((cRes.data?.data?.certificates ?? []).length);
      setOrders(oList);
      setTotalValue(tList.reduce((s, x) => s + (Number(x.balance_value) || 0), 0));
    } catch {
      setErrorMsg('Error al cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (client?.id) load(); }, [client?.id, load]);

  // Polling cuando hay órdenes pendientes
  useEffect(() => {
    const hasPending = orders.some((o) => o.status === 'pending_approval');
    if (hasPending) {
      pollRef.current = setInterval(load, 15000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orders, load]);

  const onRefresh = () => { setRefreshing(true); load(); };
  const pendingCount = orders.filter((o) => o.status === 'pending_approval').length;

  const kycMap: Record<string, { label: string; color: string; bg: string; icon: string; msg: string }> = {
    approved: { label: 'Verificado', color: Colors.success, bg: '#dcfce7', icon: 'checkmark-circle', msg: 'Tu identidad ha sido verificada.' },
    in_review: { label: 'En revisión', color: Colors.warning, bg: '#fef3c7', icon: 'time', msg: 'Tus documentos están siendo revisados.' },
    rejected: { label: 'Rechazado', color: Colors.error, bg: '#fee2e2', icon: 'close-circle', msg: 'Tu verificación fue rechazada. Contactá a soporte.' },
  };
  const kyc = kycMap[client?.kyc_status ?? ''];

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  if (errorMsg && tokens.length === 0) {
    return (
      <View style={s.centered}>
        <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
        <Text style={s.errorText}>{errorMsg}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={s.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.heroTitle}>¡Hola, {client?.first_name || 'Cliente'}!</Text>
        <Text style={s.heroSub}>Portal de {tenant?.name}</Text>
        <View style={s.heroBadges}>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeLabel}>KYC</Text>
            <Text style={s.heroBadgeVal}>{kyc?.label ?? 'Pendiente'}</Text>
          </View>
          <View style={s.heroBadge}>
            <Text style={s.heroBadgeLabel}>Nivel</Text>
            <Text style={s.heroBadgeVal}>{client?.kyc_level ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* KYC Alert */}
      {client?.kyc_status !== 'approved' && kyc && (
        <View style={[s.alert, { backgroundColor: kyc.bg }]}>
          <Ionicons name={kyc.icon as never} size={20} color={kyc.color} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontWeight: '600', color: Colors.textPrimary }}>KYC {kyc.label}</Text>
            <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>{kyc.msg}</Text>
          </View>
        </View>
      )}

      {/* Stats */}
      <View style={s.statsGrid}>
        <View style={s.statCard}>
          <Ionicons name="diamond" size={22} color="#3b82f6" />
          <Text style={s.statNum}>{tokens.length}</Text>
          <Text style={s.statLabel}>Tokens</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="wallet" size={22} color={Colors.success} />
          <Text style={s.statNum}>{formatCurrency(totalValue)}</Text>
          <Text style={s.statLabel}>Portfolio</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="document-text" size={22} color="#a855f7" />
          <Text style={s.statNum}>{certCount}</Text>
          <Text style={s.statLabel}>Certificados</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="shield" size={22} color={Colors.warning} />
          <Text style={[s.statNum, { fontSize: 13 }]}>{kyc?.label ?? 'Pendiente'}</Text>
          <Text style={s.statLabel}>KYC</Text>
        </View>
      </View>

      {/* Pending orders alert */}
      {pendingCount > 0 && (
        <TouchableOpacity style={s.pendingBox} activeOpacity={0.8} onPress={() => nav.navigate('Ordenes')}>
          <Ionicons name="time" size={22} color="#d97706" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontWeight: '600', color: '#92400e' }}>
              {pendingCount === 1 ? '1 orden pendiente' : `${pendingCount} órdenes pendientes`}
            </Text>
            <Text style={{ fontSize: 12, color: '#b45309' }}>Te notificaremos cuando sean procesadas</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#d97706" />
        </TouchableOpacity>
      )}

      {/* Token summary */}
      {tokens.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Mis Inversiones</Text>
          {tokens.slice(0, 3).map((t) => (
            <View key={t.holder_id} style={s.row}>
              <View style={s.rowIcon}><Ionicons name="diamond" size={18} color="#3b82f6" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{t.token_name}</Text>
                <Text style={s.rowSub}>{t.token_symbol}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.rowVal}>{formatNumber(t.balance)} tokens</Text>
                <Text style={[s.rowSub, { color: Colors.success }]}>{formatCurrency(Number(t.balance_value), t.currency)}</Text>
              </View>
            </View>
          ))}
          {tokens.length > 3 && (
            <TouchableOpacity onPress={() => nav.navigate('Portfolio')} style={s.seeAll}>
              <Text style={s.seeAllText}>Ver todos ({tokens.length})</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Client info */}
      <View style={s.infoCard}>
        <Text style={s.sectionTitle}>Mi Información</Text>
        <View style={s.infoGrid}>
          <View style={s.infoItem}><Text style={s.infoLabel}>Nombre</Text><Text style={s.infoVal}>{client?.first_name} {client?.last_name}</Text></View>
          <View style={s.infoItem}><Text style={s.infoLabel}>Email</Text><Text style={s.infoVal}>{client?.email}</Text></View>
          <View style={s.infoItem}><Text style={s.infoLabel}>Empresa</Text><Text style={s.infoVal}>{tenant?.name}</Text></View>
          <View style={s.infoItem}><Text style={s.infoLabel}>Cuenta</Text><View style={s.activeBadge}><Text style={s.activeBadgeText}>Activo</Text></View></View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: 12, padding: 32 },
  errorText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12, marginTop: 8 },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  hero: { backgroundColor: Colors.primary, borderRadius: 20, padding: 20, marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heroBadges: { flexDirection: 'row', gap: 10, marginTop: 14 },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  heroBadgeLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  heroBadgeVal: { fontSize: 14, fontWeight: '600', color: '#fff' },
  alert: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 14, marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  statNum: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 6 },
  statLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  pendingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', borderRadius: 14, padding: 14, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: 14, borderRadius: 12, marginBottom: 8 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  rowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  rowVal: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4, gap: 4 },
  seeAllText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoItem: { width: '47%', marginBottom: 8 },
  infoLabel: { fontSize: 12, color: Colors.textSecondary },
  infoVal: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary, marginTop: 2 },
  activeBadge: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
  activeBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.success },
});
