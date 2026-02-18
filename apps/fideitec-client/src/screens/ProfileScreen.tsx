import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientAuth } from '../context/ClientAuthContext';
import { Colors } from '../theme/colors';

export default function ProfileScreen() {
  const { client, tenant, logout } = useClientAuth();

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Querés salir de la app?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const kycMap: Record<string, { text: string; color: string; bg: string; icon: string }> = {
    approved: { text: 'Verificado', color: Colors.success, bg: '#dcfce7', icon: 'checkmark-circle' },
    in_review: { text: 'En revisión', color: Colors.warning, bg: '#fef3c7', icon: 'time' },
    rejected: { text: 'Rechazado', color: Colors.error, bg: '#fee2e2', icon: 'close-circle' },
  };
  const kyc = kycMap[client?.kyc_status ?? ''] ?? { text: 'Pendiente', color: Colors.textMuted, bg: Colors.borderLight, icon: 'alert-circle' };

  const rows: { label: string; value: string | undefined; icon: string }[] = [
    { label: 'Email', value: client?.email, icon: 'mail-outline' },
    { label: 'Teléfono', value: client?.phone || client?.mobile || 'No registrado', icon: 'call-outline' },
    { label: 'Documento', value: client?.document_type && client?.document_number ? `${client.document_type}: ${client.document_number}` : 'No registrado', icon: 'card-outline' },
    { label: 'Organización', value: tenant?.name, icon: 'business-outline' },
    { label: 'Ciudad', value: client?.address_city || 'No registrada', icon: 'location-outline' },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Avatar header */}
      <View style={s.avatarCard}>
        <View style={s.avatar}>
          <Text style={s.avatarInitials}>
            {(client?.first_name?.[0] ?? '')}{(client?.last_name?.[0] ?? '')}
          </Text>
        </View>
        <Text style={s.name}>
          {[client?.first_name, client?.last_name].filter(Boolean).join(' ') || '-'}
        </Text>
        <Text style={s.email}>{client?.email}</Text>
      </View>

      {/* KYC card */}
      <View style={[s.kycCard, { backgroundColor: kyc.bg }]}>
        <Ionicons name={kyc.icon as never} size={22} color={kyc.color} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: kyc.color }}>KYC: {kyc.text}</Text>
          <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>
            Nivel {client?.kyc_level ?? 0}
          </Text>
        </View>
      </View>

      {/* Info rows */}
      <View style={s.infoCard}>
        {rows.map((r, i) => (
          <View key={r.label} style={[s.infoRow, i < rows.length - 1 && s.infoRowBorder]}>
            <Ionicons name={r.icon as never} size={18} color={Colors.textSecondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.infoLabel}>{r.label}</Text>
              <Text style={s.infoVal}>{r.value || '-'}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Account status */}
      <View style={s.statusCard}>
        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
        <Text style={s.statusText}>Cuenta activa</Text>
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
        <Text style={s.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 32 },
  avatarCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarInitials: { fontSize: 24, fontWeight: '700', color: '#fff' },
  name: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  email: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  kycCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 12 },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 4, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoLabel: { fontSize: 12, color: Colors.textSecondary },
  infoVal: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary, marginTop: 1 },
  statusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 14, padding: 16, marginBottom: 12, gap: 10 },
  statusText: { fontSize: 15, fontWeight: '600', color: Colors.success },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 16, gap: 8, marginTop: 12 },
  logoutText: { fontSize: 16, fontWeight: '600', color: Colors.error },
});
