import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClientAuth } from '../context/ClientAuthContext';
import { Colors } from '../theme/colors';

export default function PortalTokenScreen({ onNext }: { onNext: () => void }) {
  const { setPortalToken, getTenantInfo } = useClientAuth();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleContinue = async () => {
    const t = token.trim().toLowerCase();
    if (!t) {
      setErr('Ingresá el código de tu portal');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      const result = await getTenantInfo(t);
      if (result.success) {
        await setPortalToken(t);
        onNext();
      } else {
        setErr(result.message || 'Portal no encontrado');
      }
    } catch {
      setErr('No se pudo conectar. Revisá tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.iconRow}>
          <Ionicons name="business-outline" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Portal de clientes</Text>
        <Text style={styles.subtitle}>
          Ingresá el código de portal que te envió tu administrador.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Código del portal (ej: abc123)"
          placeholderTextColor={Colors.textMuted}
          value={token}
          onChangeText={(text) => {
            setToken(text);
            setErr('');
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleContinue}
          editable={!loading}
        />
        {err ? <Text style={styles.error}>{err}</Text> : null}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  iconRow: { marginBottom: 12 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  error: {
    color: Colors.error,
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
