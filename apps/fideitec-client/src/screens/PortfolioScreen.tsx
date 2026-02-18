import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, Linking, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useClientAuth } from '../context/ClientAuthContext';
import { Colors } from '../theme/colors';
import { formatCurrency, formatNumber, formatDate } from '../utils/format';
import type { TokenHolder, Certificate } from '../types';

export default function PortfolioScreen() {
  const { client } = useClientAuth();
  const [tab, setTab] = useState<'tokens' | 'certs'>('tokens');
  const [tokens, setTokens] = useState<TokenHolder[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tRes, cRes] = await Promise.all([
        api.get('/portal/client/tokens'),
        api.get('/portal/client/certificates'),
      ]);
      setTokens(tRes.data?.data?.tokens ?? []);
      setCerts(cRes.data?.data?.certificates ?? []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (client?.id) load(); }, [client?.id, load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const copyCode = async (code?: string) => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copiado', 'Código de verificación copiado al portapapeles');
  };

  if (loading) return <View style={s.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
    >
      {/* Tabs */}
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabBtn, tab === 'tokens' && s.tabActive]} onPress={() => setTab('tokens')}>
          <Text style={[s.tabText, tab === 'tokens' && s.tabTextActive]}>Mis Tokens ({tokens.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'certs' && s.tabActive]} onPress={() => setTab('certs')}>
          <Text style={[s.tabText, tab === 'certs' && s.tabTextActive]}>Certificados ({certs.length})</Text>
        </TouchableOpacity>
      </View>

      {/* ---- TOKENS ---- */}
      {tab === 'tokens' && (
        tokens.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="wallet-outline" size={40} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>Sin tokens aún</Text>
            <Text style={s.emptyText}>Cuando adquieras tokens, aparecerán aquí.</Text>
          </View>
        ) : tokens.map((t) => (
          <View key={t.holder_id} style={s.card}>
            <View style={s.cardTop}>
              <View style={s.iconCircle}><Ionicons name="diamond" size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{t.token_name}</Text>
                <Text style={s.sub}>{t.token_symbol}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.bigNum}>{formatNumber(t.balance)}</Text>
                <Text style={s.sub}>cuotas partes</Text>
              </View>
            </View>
            <View style={s.divider} />
            <View style={s.statsRow}>
              <View style={s.stat}><Text style={s.statLabel}>Valor/token</Text><Text style={s.statVal}>{formatCurrency(t.balance > 0 ? t.balance_value / t.balance : 0, t.currency)}</Text></View>
              <View style={s.stat}><Text style={s.statLabel}>Valor total</Text><Text style={[s.statVal, { color: Colors.success }]}>{formatCurrency(Number(t.balance_value), t.currency)}</Text></View>
              <View style={s.stat}><Text style={s.statLabel}>Moneda</Text><Text style={s.statVal}>{t.currency}</Text></View>
            </View>
          </View>
        ))
      )}

      {/* ---- CERTIFICADOS ---- */}
      {tab === 'certs' && (
        certs.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
            <Text style={s.emptyTitle}>Sin certificados</Text>
            <Text style={s.emptyText}>Los certificados se generan al adquirir tokens.</Text>
          </View>
        ) : certs.map((c) => (
          <View key={c.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={[s.iconCircle, c.is_blockchain_certified && { backgroundColor: Colors.success }]}>
                <Ionicons name={c.is_blockchain_certified ? 'shield-checkmark' : 'document-text'} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{c.certificate_number}</Text>
                <Text style={s.sub}>{formatDate(c.issued_at)}</Text>
              </View>
              {c.is_blockchain_certified && (
                <View style={s.bcBadge}><Text style={s.bcBadgeText}>Blockchain</Text></View>
              )}
            </View>
            <View style={s.divider} />
            <View style={s.statsRow}>
              <View style={s.stat}><Text style={s.statLabel}>Token</Text><Text style={s.statVal}>{c.token_name}</Text></View>
              <View style={s.stat}><Text style={s.statLabel}>Cantidad</Text><Text style={s.statVal}>{formatNumber(c.token_amount)}</Text></View>
              <View style={s.stat}><Text style={s.statLabel}>Valor</Text><Text style={[s.statVal, { color: Colors.success }]}>{formatCurrency(c.total_value_at_issue, c.currency)}</Text></View>
            </View>

            {c.verification_code && (
              <TouchableOpacity style={s.verifyRow} onPress={() => copyCode(c.verification_code)}>
                <Ionicons name="qr-code-outline" size={14} color={Colors.textSecondary} />
                <Text style={s.verifyCode} numberOfLines={1}>{c.verification_code.slice(0, 28)}...</Text>
                <Ionicons name="copy-outline" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            {c.is_blockchain_certified && c.blockchain_tx_hash && (
              <TouchableOpacity
                style={s.linkBtn}
                onPress={() => Linking.openURL(`https://basescan.org/tx/${c.blockchain_tx_hash}`)}
              >
                <Ionicons name="open-outline" size={16} color={Colors.primary} />
                <Text style={s.linkBtnText}>Ver en Blockchain</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 40, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  sub: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  bigNum: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  statVal: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  bcBadge: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  bcBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.success },
  verifyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 10, padding: 10, marginTop: 12, gap: 6 },
  verifyCode: { flex: 1, fontSize: 11, fontFamily: 'Courier', color: Colors.textSecondary },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingVertical: 10, marginTop: 8, gap: 6 },
  linkBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
});
