import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useClientAuth } from '../context/ClientAuthContext';
import { Colors } from '../theme/colors';
import { formatCurrency, formatNumber } from '../utils/format';
import type { AvailableToken } from '../types';

export default function MarketplaceScreen() {
  const { client } = useClientAuth();
  const [tokens, setTokens] = useState<AvailableToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyToken, setBuyToken] = useState<AvailableToken | null>(null);
  const [buyAmount, setBuyAmount] = useState(1);
  const [purchasing, setPurchasing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/portal/client/tokens/available');
      setTokens(res.data?.data?.tokens ?? []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (client?.id) load(); }, [client?.id, load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleBuy = async () => {
    if (!buyToken) return;
    setPurchasing(true);
    try {
      const res = await api.post('/portal/client/tokens/buy', {
        tokenizedAssetId: buyToken.id,
        tokenAmount: buyAmount,
      });
      if (res.data.success) {
        Alert.alert(
          'Solicitud enviada',
          `Orden ${res.data.data.order.order_number} creada.\nEstá pendiente de aprobación.`,
          [{ text: 'OK', onPress: () => { setBuyToken(null); setBuyAmount(1); load(); } }],
        );
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Error al procesar';
      Alert.alert('Error', msg);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {/* Header */}
        <View style={s.header}>
          <Ionicons name="cart-outline" size={28} color="#fff" />
          <View style={{ marginLeft: 12 }}>
            <Text style={s.headerTitle}>Comprar Tokens</Text>
            <Text style={s.headerSub}>Seleccioná un activo y enviá tu solicitud.</Text>
          </View>
        </View>

        {tokens.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="pricetags-outline" size={40} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>No hay tokens disponibles</Text>
            <Text style={s.emptyText}>Por el momento no hay tokens a la venta.</Text>
          </View>
        ) : (
          tokens.map((t) => (
            <View key={t.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.tokenIcon}>
                  <Ionicons name="diamond-outline" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.tokenName}>{t.token_name}</Text>
                  <Text style={s.tokenAsset}>{t.asset_name}</Text>
                </View>
                <View style={s.availBadge}>
                  <Text style={s.availText}>{formatNumber(t.available)} disp.</Text>
                </View>
              </View>
              <View style={s.cardRow}>
                <View>
                  <Text style={s.labelSm}>Precio por token</Text>
                  <Text style={s.valueBold}>{formatCurrency(t.token_price, t.currency)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.labelSm}>Símbolo</Text>
                  <Text style={[s.valueBold, { color: Colors.primary }]}>{t.token_symbol}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={s.buyBtn}
                activeOpacity={0.8}
                onPress={() => { setBuyToken(t); setBuyAmount(1); }}
              >
                <Ionicons name="cart" size={18} color="#fff" />
                <Text style={s.buyBtnText}>Comprar</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal de compra */}
      <Modal visible={!!buyToken} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Comprar {buyToken?.token_name}</Text>
              <TouchableOpacity onPress={() => { setBuyToken(null); setBuyAmount(1); }}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={s.modalBody}>
              <Text style={s.labelSm}>Activo</Text>
              <Text style={[s.valueBold, { marginBottom: 16 }]}>{buyToken?.asset_name}</Text>

              <View style={s.modalRow}>
                <View style={s.modalStat}>
                  <Text style={s.labelSm}>Precio</Text>
                  <Text style={s.valueBold}>{formatCurrency(buyToken?.token_price ?? 0, buyToken?.currency)}</Text>
                </View>
                <View style={s.modalStat}>
                  <Text style={s.labelSm}>Disponibles</Text>
                  <Text style={[s.valueBold, { color: Colors.success }]}>{formatNumber(buyToken?.available ?? 0)}</Text>
                </View>
              </View>

              <Text style={[s.labelSm, { marginTop: 16, marginBottom: 8 }]}>Cantidad de tokens</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setBuyAmount(Math.max(1, buyAmount - 1))}>
                  <Ionicons name="remove" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
                <TextInput
                  style={s.qtyInput}
                  value={String(buyAmount)}
                  onChangeText={(v) => {
                    const n = parseInt(v) || 1;
                    setBuyAmount(Math.max(1, Math.min(buyToken?.available ?? 1, n)));
                  }}
                  keyboardType="number-pad"
                />
                <TouchableOpacity style={s.qtyBtn} onPress={() => setBuyAmount(Math.min(buyToken?.available ?? 1, buyAmount + 1))}>
                  <Ionicons name="add" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={s.totalBox}>
                <Text style={s.totalLabel}>Total a pagar:</Text>
                <Text style={s.totalValue}>
                  {formatCurrency((buyToken?.token_price ?? 0) * buyAmount, buyToken?.currency)}
                </Text>
              </View>

              <TouchableOpacity
                style={[s.confirmBtn, purchasing && { opacity: 0.6 }]}
                onPress={handleBuy}
                disabled={purchasing}
                activeOpacity={0.8}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={s.confirmBtnText}>Confirmar Compra</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={s.disclaimer}>
                <Ionicons name="sparkles" size={14} color={Colors.warning} />
                <Text style={s.disclaimerText}>Tu solicitud será revisada antes de registrarse en blockchain</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { backgroundColor: '#16a34a', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  tokenIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  tokenName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  tokenAsset: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  availBadge: { backgroundColor: '#dcfce7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  availText: { fontSize: 12, fontWeight: '600', color: Colors.success },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  labelSm: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  valueBold: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, gap: 8 },
  buyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#16a34a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalBody: { padding: 20 },
  modalRow: { flexDirection: 'row', gap: 12 },
  modalStat: { flex: 1, backgroundColor: Colors.background, borderRadius: 12, padding: 12 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  qtyBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  qtyInput: { flex: 1, height: 48, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 12, padding: 16, marginBottom: 16 },
  totalLabel: { fontSize: 15, color: Colors.textSecondary },
  totalValue: { fontSize: 22, fontWeight: '700', color: Colors.success },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 16, gap: 8, marginBottom: 12 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  disclaimerText: { fontSize: 12, color: Colors.textMuted },
});
