import { useSignIn } from '@clerk/expo';
import { Link, Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

export default function SignInScreen() {
  const colors = useColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  if (signIn.status === 'complete') return <Redirect href="/" />;

  const handleSubmit = async () => {
    setMessage('');
    const result = await signIn.password({ emailAddress: emailAddress.trim(), password });
    if (result.error) {
      setMessage(result.error.message ?? 'เข้าสู่ระบบไม่สำเร็จ');
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => router.replace(decorateUrl('/') as never),
      });
    }
  };

  const loading = fetchStatus === 'fetching';
  const errorText = message || errors.fields.identifier?.message || errors.fields.password?.message;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.primary }]}>FIRE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>เข้าสู่ระบบ</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          เข้าถึงบทสนทนาและความจำส่วนบุคคลของคุณ
        </Text>
        <Text style={[styles.label, { color: colors.foreground }]}>อีเมล</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmailAddress}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          value={emailAddress}
        />
        <Text style={[styles.label, { color: colors.foreground }]}>รหัสผ่าน</Text>
        <TextInput
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="รหัสผ่าน"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          value={password}
        />
        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
        <Pressable
          disabled={!emailAddress || !password || loading}
          onPress={handleSubmit}
          style={[styles.primaryButton, { backgroundColor: colors.primary }, (!emailAddress || !password || loading) && styles.disabled]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>เข้าสู่ระบบ</Text>}
        </Pressable>
        <View style={styles.linkRow}>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>ยังไม่มีบัญชี? </Text>
          <Link href={"/sign-up" as never} asChild>
            <Pressable><Text style={[styles.link, { color: colors.primary }]}>สมัครสมาชิก</Text></Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: { flex: 1, justifyContent: 'center', padding: 20 },
    card: { width: '100%', maxWidth: 440, alignSelf: 'center', borderWidth: 1, borderRadius: 20, padding: 24 },
    kicker: { fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },
    title: { fontSize: 28, fontWeight: '700', marginTop: 8 },
    subtitle: { fontSize: 13, lineHeight: 20 },
    label: { fontSize: 13, fontWeight: '600', marginTop: 18, marginBottom: 7 },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15 },
    primaryButton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    disabled: { opacity: 0.5 },
    error: { color: '#dc2626', fontSize: 12, marginTop: 10, lineHeight: 18 },
    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
    link: { fontSize: 13, fontWeight: '700' },
  });
}