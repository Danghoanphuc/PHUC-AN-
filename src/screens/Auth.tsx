import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { Button, C, Icon, s } from '../components/ui';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/format';
import { phoneIdentity } from '../lib/phone';
import { manageAccount } from '../lib/accounts';
export function Auth() {
  const [phone, setPhone] = useState(''),
    [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState(''),
    [setup, setSetup] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const accept = (url: string) => {
      const token = /[#&]owner_setup=([a-f0-9]{64})(?:&|$)/.exec(url)?.[1];
      if (token) {
        setSetup(token);
        if (Platform.OS === 'web') window.history.replaceState(null, '', window.location.pathname);
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) accept(url);
    });
    const listener = Linking.addEventListener('url', (e) => accept(e.url));
    return () => listener.remove();
  }, []);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const email = phoneIdentity(phone);
      if (setup) {
        if (password.length < 12) throw Error('Mật khẩu cần ít nhất 12 ký tự.');
        if (password !== confirm) throw Error('Hai mật khẩu chưa khớp.');
        await manageAccount({
          action: 'bootstrap',
          token: setup,
          phone,
          password,
          full_name: 'Chủ Phúc An',
        });
        setSetup('');
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw Error('Số điện thoại hoặc mật khẩu chưa đúng.');
      setPassword('');
      setConfirm('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          s.page,
          { flexGrow: 1, justifyContent: 'center', paddingVertical: 48 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 30 }}>
          <View style={[s.row, { gap: 12 }]}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: C.green,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 20, color: 'white', fontWeight: '800' }}>PA</Text>
            </View>
            <View>
              <Text style={[s.h2, { letterSpacing: 2 }]}>PHÚC AN</Text>
              <Text style={s.muted}>Cùng chăm chút mỗi ngày</Text>
            </View>
          </View>
          <View style={{ gap: 9 }}>
            <Text style={[s.label, { color: C.orange }]}>KHÔNG GIAN LÀM VIỆC</Text>
            <Text style={[s.title, { fontSize: 37, lineHeight: 43 }]}>
              Một ngày mới,{'\n'}mọi việc trong tay.
            </Text>
            <Text style={[s.muted, { fontSize: 15, lineHeight: 23 }]}>
              Đơn hàng, khách hàng và hoạt động kinh doanh của Phúc An, ngay trên điện thoại.
            </Text>
          </View>
          <View style={[s.card, { padding: 22, gap: 18 }]}>
            <Text style={s.h2}>
              {setup ? 'Đặt mật khẩu chủ doanh nghiệp' : 'Chào bạn, đăng nhập nhé'}
            </Text>
            {setup && (
              <Text style={s.muted}>
                Nhập số điện thoại đã đăng ký và đặt mật khẩu từ 12 ký tự. Bạn chỉ cần thiết lập một
                lần.
              </Text>
            )}
            <View style={{ gap: 7 }}>
              <Text style={s.muted}>Số điện thoại</Text>
              <TextInput
                accessibilityLabel="Số điện thoại"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="username"
                placeholder="Số điện thoại được cấp"
                style={s.input}
              />
            </View>
            <View style={{ gap: 7 }}>
              <Text style={s.muted}>Mật khẩu</Text>
              <TextInput
                accessibilityLabel="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType={setup ? 'newPassword' : 'password'}
                autoComplete={setup ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => void submit()}
                style={s.input}
              />
            </View>
            {!!setup && (
              <TextInput
                accessibilityLabel="Nhập lại mật khẩu"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                textContentType="newPassword"
                autoCapitalize="none"
                style={s.input}
                placeholder="Nhập lại mật khẩu"
              />
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={[s.text, { color: C.red }]}>
                {error}
              </Text>
            )}
            {busy ? (
              <ActivityIndicator color={C.green} />
            ) : (
              <Button
                title={setup ? 'Lưu mật khẩu & đăng nhập' : 'Đăng nhập'}
                disabled={!phone || !password}
                onPress={() => void submit()}
                icon="arrow-forward-outline"
              />
            )}
            {!setup && (
              <Text style={[s.muted, { textAlign: 'center' }]}>
                Dùng tài khoản do chủ doanh nghiệp cấp.{'\n'}Quên mật khẩu? Liên hệ chủ doanh nghiệp
                để đặt lại.
              </Text>
            )}
          </View>
          <View style={[s.row, { alignSelf: 'center' }]}>
            <Icon name="shield-checkmark-outline" size={17} color={C.muted} />
            <Text style={s.muted}>Chỉ dành cho đội ngũ Phúc An</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
