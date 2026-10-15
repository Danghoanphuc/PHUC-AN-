import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, Icon } from './ui';

export function DetailDisclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={d.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={d.row}
      >
        <Text style={d.name}>{title}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
      </Pressable>
      {open && <View style={{ padding: 12, paddingTop: 0, gap: 10 }}>{children}</View>}
    </View>
  );
}

export const d = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 24 },
  header: { gap: 4 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: C.ink, flex: 1 },
  meta: { fontSize: 12, lineHeight: 18, color: C.muted },
  summary: { backgroundColor: C.soft, borderRadius: 12, padding: 12, gap: 5 },
  total: { fontSize: 24, fontWeight: '700', color: C.green },
  group: {
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  divided: { borderTopWidth: 1, borderTopColor: C.line },
  name: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: C.ink },
  amount: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: C.ink },
  section: { fontSize: 12, fontWeight: '600', color: C.muted },
  link: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 6 },
  linkText: { fontSize: 12, color: C.green, fontWeight: '600' },
});
