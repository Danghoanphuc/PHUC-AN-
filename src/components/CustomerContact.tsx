import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, s } from './ui';
import { useApp } from '../lib/context';
import { submitMutation } from '../lib/mutations';
import { d } from './OrderDetailLayout';
import type { Row } from '../lib/supabase';

export function CustomerContact({
  customer,
  compact = false,
}: {
  customer: Row<'customers'> | undefined;
  compact?: boolean;
}) {
  const a = useApp();
  if (!customer || customer.customer_type !== 'Khách lẻ') return null;
  const ContactButton = compact ? Pressable : Button;
  return (
    <View style={compact ? { flexDirection: 'row', alignItems: 'center', gap: 8 } : { gap: 8 }}>
      <Text style={compact ? d.meta : s.muted}>{customer.phone || 'Chưa có số điện thoại'}</Text>
      <ContactButton
        accessibilityRole="button"
        accessibilityLabel="Cập nhật thông tin khách"
        style={compact ? d.link : undefined}
        title="Cập nhật thông tin khách"
        secondary
        disabled={a.busy || !customer.is_active}
        icon="create-outline"
        onPress={() =>
          a.openForm({
            title: 'Cập nhật thông tin khách',
            description:
              'Cập nhật hồ sơ khách đang gắn với đơn. Các đơn khác của cùng khách cũng hiển thị tên và số điện thoại mới.',
            fields: [
              { name: 'name', label: 'Tên khách', value: customer.name, required: true },
              { name: 'phone', label: 'Số điện thoại', value: customer.phone || '' },
            ],
            submitLabel: 'Lưu thông tin khách',
            submit: async (v, key) => {
              await submitMutation(
                'update_retail_customer_contact',
                {
                  customer_id: customer.id,
                  name: (v.name || '').trim(),
                  phone: v.phone || null,
                  expected_name: customer.name,
                  expected_phone: customer.phone,
                },
                key,
              );
            },
          })
        }
      >
        {compact ? <Text style={d.linkText}>Sửa thông tin</Text> : undefined}
      </ContactButton>
    </View>
  );
}
