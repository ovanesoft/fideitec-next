import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useClientAuth } from '../context/ClientAuthContext';
import { Colors } from '../theme/colors';
import { formatCurrency, formatNumber, formatDateLong } from '../utils/format';
import type { Order } from '../types';

const STATUS: Record<string, { label: string; bg: string; fg: string; icon: string }> = {
  pending_approval: { label: 'Pendiente', bg: '#fef3c7', fg: '#d97706', icon: 'time' },
  approved: { label: 'Aprobada', bg: '#dbeafe', fg: '#2563eb', icon: 'checkmark-circle' },
  completed: { label: 'Completada', bg: '#dcfce7', fg: '#16a34a', icon: 'checkmark-circle' },
  rejected: { label: 'Rechazada', bg: '#fee2e2', fg: '#dc2626', icon: 'close-circle' },
  cancelled: { label: 'Cancelada', bg: '#f1f5f9', fg: '#64748b', icon: 'ban' },
};

export default function OrdersScreen() {
  const { client } = useClientAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/portal/client/orders');
      setOrders(res.data?.data?.orders ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
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

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      {/* Header */}
      <View style={s.header}>
        <Ionicons name="time-outline" size={28} color="#fff" />
        <View style={{ marginLeft: 12 }}>
          <Text style={s.headerTitle}>Mis Órdenes</Text>
          <Text style={s.headerSub}>Seguí el estado de tus solicitudes de compra.</Text>
        </View>
      </View>

      {orders.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons name="receipt-outline" size={40} color={Colors.textMuted} />
          <Text style={s.emptyTitle}>Sin órdenes</Text>
          <Text style={s.emptyText}>Aún no realizaste ninguna solicitud de compra.</Text>
        </View>
      ) : (
        orders.map((o) => {
          const st = STATUS[o.status] ?? STATUS.pending_approval;
          return (
            <View key={o.id} style={s.card}>
              {/* Top */}
              <View style={s.cardTop}>
                <View style={[s.stIcon, { backgroundColor: st.bg }]}>
                  <Ionicons name={st.icon as never} size={22} color={st.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.orderNum}>{o.order_number}</Text>
                  <Text style={s.orderDate}>{formatDateLong(o.created_at)}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
              </View>

              {/* Details */}
              <View style={s.detailGrid}>
                <View style={s.detailItem}><Text style={s.dLabel}>Token</Text><Text style={s.dVal}>{o.token_name}</Text></View>
                <View style={s.detailItem}><Text style={s.dLabel}>Cantidad</Text><Text style={s.dVal}>{formatNumber(o.token_amount)} {o.token_symbol}</Text></View>
                <View style={s.detailItem}><Text style={s.dLabel}>Total</Text><Text style={[s.dVal, { color: Colors.success }]}>{formatCurrency(o.total_amount, o.currency)}</Text></View>
                <View style={s.detailItem}><Text style={s.dLabel}>Tipo</Text><Text style={s.dVal}>{o.order_type === 'buy' ? 'Compra' : 'Venta'}</Text></View>
              </View>

              {/* Status-specific messages */}
              {o.status === 'rejected' && o.rejection_reason && (
                <View style={s.alertBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.error} />
                  <Text style={s.alertText}><Text style={{ fontWeight: '600' }}>Motivo: </Text>{o.rejection_reason}</Text>
                </View>
              )}
              {o.status === 'completed' && o.certificate_number && (
                <View style={[s.alertBox, { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }]}>
                  <Ionicons name="document-text" size={16} color={Colors.success} />
                  <Text style={[s.alertText, { color: '#166534' }]}>Certificado: {o.certificate_number}</Text>
                </View>
              )}
              {o.status === 'pending_approval' && (
                <View style={[s.alertBox, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                  <Ionicons name="time" size={16} color={Colors.warning} />
                  <Text style={[s.alertText, { color: '#92400e' }]}>Tu solicitud está siendo revisada.</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: '#d97706', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  orderNum: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, fontFamily: 'Courier' },
  orderDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  detailItem: { width: '47%', marginBottom: 4 },
  dLabel: { fontSize: 11, color: Colors.textSecondary },
  dVal: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginTop: 1 },
  alertBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 12 },
  alertText: { flex: 1, fontSize: 13, color: '#991b1b', lineHeight: 18 },
});
