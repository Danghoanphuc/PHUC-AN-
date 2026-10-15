import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, Icon, s } from './ui';
import { useApp, managerRole } from '../lib/context';
import { money } from '../lib/format';
import {
  editPackagePrice,
  packageLabel,
  packagePrice,
  type PackageUnit,
} from '../lib/packagePrices';

export function CustomerPackagePrices({
  customerId,
  disabled = false,
}: {
  customerId: string;
  disabled?: boolean;
}) {
  const a = useApp();
  const canEdit = managerRole(a.role);
  return (
    <View
      style={{
        backgroundColor: C.paper,
        borderWidth: 1,
        borderColor: C.line,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={s.between}>
        <Text style={s.h3}>Giá riêng bì / hộp</Text>
        <Icon name="pricetag-outline" size={18} />
      </View>
      {(['bi', 'hop'] as PackageUnit[]).map((unit) => {
        const rate = packagePrice(a.data, customerId, unit);
        return (
          <View key={unit} style={[s.between, { minHeight: 44 }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.text}>
                {unit === 'bi' ? 'Bì' : 'Hộp'} ·{' '}
                <Text style={{ fontWeight: '700' }}>
                  {rate ? money(rate.amount) : 'Chưa có giá'}
                </Text>
              </Text>
              <Text style={{ fontSize: 11, color: C.muted }}>
                {rate
                  ? rate.customer_id
                    ? 'Giá riêng của khách'
                    : 'Đang dùng giá chung'
                  : 'Chưa thiết lập giá'}
                {rate ? ` · ${rate.pieces_per_package} cái` : ''}
              </Text>
            </View>
            {canEdit && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sửa giá riêng ${packageLabel(unit)}`}
                disabled={disabled || a.busy}
                onPress={() => editPackagePrice(a, customerId, unit)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 9,
                  backgroundColor: C.soft,
                }}
              >
                <Icon name="create-outline" size={16} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: C.green }}>Sửa</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      <Text style={{ fontSize: 11, color: C.muted, lineHeight: 16 }}>
        {canEdit
          ? 'Giá riêng ưu tiên trước giá chung, chỉ áp dụng cho lần bán mới.'
          : 'Tài khoản nhân viên chỉ được xem. Chủ hoặc quản lý có quyền sửa giá.'}
      </Text>
    </View>
  );
}
