import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type Ionicons from '@expo/vector-icons/Ionicons';
import AppIcon from './AppIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { errorMessage, labels } from '../lib/format';

export const C = {
  bg: '#F5F4EE',
  paper: '#FFFFFF',
  ink: '#1D332C',
  green: '#244E3D',
  soft: '#E8EEE5',
  muted: '#647267',
  line: '#E4E7DE',
  orange: '#B96536',
  orangeSoft: '#FBEFE4',
  red: '#A74035',
};
const webFont = Platform.OS === 'web' ? { fontFamily: 'system-ui' } : {};
export const s = StyleSheet.create({
  page: { padding: 22, gap: 18, paddingBottom: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { ...webFont, fontSize: 29, fontWeight: '700', color: C.ink, letterSpacing: -0.8 },
  h2: { ...webFont, fontSize: 19, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  h3: { ...webFont, fontSize: 16, fontWeight: '600', color: C.ink },
  text: { ...webFont, fontSize: 14, color: C.ink, lineHeight: 21 },
  muted: { ...webFont, fontSize: 13, color: C.muted, lineHeight: 20 },
  label: {
    ...webFont,
    fontSize: 11,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: C.paper,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12,
  },
  input: {
    ...webFont,
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    backgroundColor: '#FAFBF8',
  },
  button: {
    minHeight: 48,
    borderRadius: 13,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.green,
  },
  buttonText: { ...webFont, fontSize: 14, fontWeight: '700', color: 'white' },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.soft },
  pillText: { ...webFont, fontSize: 11, fontWeight: '700', color: C.green },
  divider: { height: 1, backgroundColor: C.line },
  empty: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20, gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.orangeSoft,
    borderWidth: 1,
    borderColor: '#F1D8C1',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    gap: 10,
  },
  segment: {
    padding: 5,
    backgroundColor: '#E9EBE3',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 5,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  sheet: { flex: 1, backgroundColor: C.bg, maxWidth: 580, width: '100%', alignSelf: 'center' },
  sheetHeader: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.bg,
  },
});
export function Icon({
  name,
  size = 21,
  color = C.green,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
}) {
  return <AppIcon name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && { backgroundColor: C.soft },
        danger && { backgroundColor: C.red },
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      {icon && <Icon name={icon} size={18} color={secondary ? C.green : 'white'} />}
      <Text style={[s.buttonText, secondary && { color: C.green }]}>{title}</Text>
    </Pressable>
  );
}
export function Card({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={s.card}>{children}</View>
  );
}
export function Tag({ value }: { value: string }) {
  return (
    <View
      style={[
        s.pill,
        ['draft', 'submitted', 'unpaid', 'open', 'partial'].includes(value) && {
          backgroundColor: C.orangeSoft,
        },
        value === 'cancelled' && { backgroundColor: '#F5E6E2' },
      ]}
    >
      <Text
        style={[
          s.pillText,
          ['draft', 'submitted', 'unpaid', 'open', 'partial'].includes(value) && {
            color: C.orange,
          },
        ]}
      >
        {labels[value] ?? value}
      </Text>
    </View>
  );
}
export function Empty({
  title,
  body,
  icon = 'file-tray-outline',
}: {
  title: string;
  body?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={s.empty}>
      <View style={[s.avatar, { width: 56, height: 56, borderRadius: 18 }]}>
        <Icon name={icon} size={27} />
      </View>
      <Text style={s.h3}>{title}</Text>
      {body && <Text style={[s.muted, { textAlign: 'center' }]}>{body}</Text>}
    </View>
  );
}
export function Search({
  value,
  onChange,
  placeholder = 'Tìm kiếm…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={s.search}>
      <Icon name="search-outline" size={18} color={C.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        style={{ flex: 1, paddingVertical: 14, fontSize: 14, color: C.ink }}
      />
      {!!value && (
        <Pressable accessibilityLabel="Xóa tìm kiếm" onPress={() => onChange('')}>
          <Icon name="close-circle" size={18} color={C.muted} />
        </Pressable>
      )}
    </View>
  );
}
export function Segment({
  values,
  selected,
  onSelect,
  compact = false,
}: {
  values: { value: string; label: string }[];
  selected: string;
  onSelect: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <View style={[s.segment, compact && { padding: 3, borderRadius: 9 }]}>
      {values.map((v) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === v.value }}
          key={v.value}
          onPress={() => onSelect(v.value)}
          style={[
            s.segmentItem,
            compact && { paddingVertical: 4, minHeight: 30, borderRadius: 7 },
            selected === v.value && { backgroundColor: C.paper },
          ]}
        >
          <Text
            style={[
              s.muted,
              { fontWeight: '600' },
              compact && { fontSize: 12, lineHeight: 18 },
              selected === v.value && { color: C.green },
            ]}
          >
            {v.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: C.bg }}
      >
        <View style={[s.sheet, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={s.sheetHeader}>
            <Text style={s.h2}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              style={{ padding: 8 }}
            >
              <Icon name="close-outline" size={25} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export type Option = { value: string; label: string; detail?: string };
export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [show, setShow] = useState(false),
    [search, setSearch] = useState('');
  return (
    <View style={{ gap: 7 }}>
      {!compact && <Text style={s.muted}>{label}</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          setSearch('');
          setShow(true);
        }}
        style={[s.input, s.between, compact && { minHeight: 36, paddingVertical: 6 }]}
      >
        <Text style={[s.text, { flex: 1 }]}>
          {options.find((o) => o.value === value)?.label ?? 'Chọn…'}
        </Text>
        <Icon name="chevron-down-outline" size={17} />
      </Pressable>
      {show && (
        <Sheet title={label} onClose={() => setShow(false)}>
          <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
            <Search value={search} onChange={setSearch} />
            {options
              .filter((o) =>
                o.label.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
              )
              .map((o) => (
                <Pressable
                  accessibilityRole="button"
                  key={o.value}
                  onPress={() => {
                    onChange(o.value);
                    setShow(false);
                  }}
                  style={[s.card, s.between]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.h3}>{o.label}</Text>
                    {o.detail && <Text style={s.muted}>{o.detail}</Text>}
                  </View>
                  {o.value === value && <Icon name="checkmark-circle" />}
                </Pressable>
              ))}
            {options.length === 0 && <Empty title="Chưa có lựa chọn" />}
          </ScrollView>
        </Sheet>
      )}
    </View>
  );
}
export type Field = {
  name: string;
  label: string;
  value?: string;
  options?: Option[];
  numeric?: boolean;
  multiline?: boolean;
  required?: boolean;
  hint?: string;
  secure?: boolean;
};
export type FormSpec = {
  title: string;
  description?: string;
  fields: Field[];
  submitLabel?: string;
  submit: (values: Record<string, string>, key: string) => Promise<void>;
};
export function FormSheet({
  spec,
  onClose,
  onSuccess,
}: {
  spec: FormSpec;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(spec.fields.map((f) => [f.name, f.value ?? ''])),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef(Crypto.randomUUID());
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      for (const f of spec.fields)
        if (f.required && !values[f.name]?.trim())
          throw Error(`Vui lòng nhập ${f.label.toLowerCase()}.`);
      await spec.submit(values, key.current);
      onSuccess();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={spec.title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {spec.description && <Text style={s.muted}>{spec.description}</Text>}
        {spec.fields.map((f) => (
          <View key={f.name} style={{ gap: 7 }}>
            {f.options ? (
              <Select
                disabled={busy}
                label={f.label}
                value={values[f.name] ?? ''}
                options={f.options}
                onChange={(v) => setValues({ ...values, [f.name]: v })}
              />
            ) : (
              <>
                <Text style={s.muted}>
                  {f.label}
                  {f.required ? ' *' : ''}
                </Text>
                <TextInput
                  accessibilityLabel={f.label}
                  editable={!busy}
                  value={values[f.name] ?? ''}
                  onChangeText={(v) => setValues({ ...values, [f.name]: v })}
                  placeholder={f.hint}
                  placeholderTextColor={C.muted}
                  keyboardType={f.numeric ? 'decimal-pad' : 'default'}
                  autoCapitalize="none"
                  secureTextEntry={f.secure}
                  autoCorrect={!f.secure}
                  multiline={f.multiline}
                  style={[s.input, f.multiline && { minHeight: 96, textAlignVertical: 'top' }]}
                />
              </>
            )}
            {f.hint && f.options && <Text style={s.muted}>{f.hint}</Text>}
          </View>
        ))}
        {!!error && (
          <View accessibilityRole="alert" style={s.banner}>
            <Text style={[s.text, { color: C.red }]}>{error}</Text>
          </View>
        )}
        {busy ? (
          <ActivityIndicator color={C.green} />
        ) : (
          <Button title={spec.submitLabel ?? 'Lưu thông tin'} onPress={() => void submit()} />
        )}
      </ScrollView>
    </Sheet>
  );
}
