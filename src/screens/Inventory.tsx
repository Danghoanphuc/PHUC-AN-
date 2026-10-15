import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, Empty, Icon, Search, Sheet, s } from '../components/ui';
import { useApp } from '../lib/context';
import { money, today } from '../lib/format';
import { searchText } from '../lib/pos';

export function Inventory() {
  const a = useApp();
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [filterOpen, setFilterOpen] = useState(false);
  const products = a.data.products.filter((p) => p.is_active);
  const categories = [
    ...new Set(products.map((p) => p.category).filter((c): c is string => !!c)),
  ].sort((a, b) => a.localeCompare(b, 'vi'));
  const day = today();
  const rates = a.data.prices
    .filter(
      (p) =>
        p.customer_id === null &&
        p.effective_from <= day &&
        (!p.effective_to || p.effective_to >= day),
    )
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from) || a.id.localeCompare(b.id));
  const price = (productId: string, tier: string) =>
    rates.find((p) => p.product_id === productId && p.price_tier === tier);
  const visible = products
    .filter(
      (p) =>
        (!category || p.category === category) &&
        searchText(`${p.name} ${p.sku} ${p.category || ''}`).includes(searchText(search.trim())),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const categoryName = (name: string) => (name === 'BOM legacy' ? 'Danh mục khác' : name);
  return (
    <View style={styles.page}>
      <View style={s.between}>
        <View style={[s.row, { flex: 1, gap: 10 }]}>
          <Text style={s.h2}>Kho</Text>
          <Text style={styles.sku}>{products.length} sản phẩm đang bán</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bảng giá chi tiết"
          onPress={() => a.go('prices')}
          style={styles.tool}
        >
          <Icon name="pricetag-outline" size={19} />
        </Pressable>
      </View>
      <View style={[s.row, { gap: 8 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Search value={search} onChange={setSearch} placeholder="Tìm sản phẩm, mã hoặc nhóm…" />
        </View>
        {!!categories.length && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nhóm sản phẩm"
            accessibilityState={{ expanded: filterOpen }}
            onPress={() => setFilterOpen(true)}
            style={[styles.tool, { backgroundColor: category ? C.green : C.paper }]}
          >
            <Icon name="options-outline" size={20} color={category ? C.paper : C.green} />
          </Pressable>
        )}
      </View>
      {(!!category || !!search.trim()) && (
        <View style={s.between}>
          <Text style={styles.sku}>
            {visible.length}/{products.length} sản phẩm
            {category ? ` · ${categoryName(category)}` : ''}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa bộ lọc Kho"
            onPress={() => {
              setCategory('');
              setSearch('');
            }}
            style={{ paddingVertical: 6, paddingHorizontal: 8 }}
          >
            <Text style={styles.sku}>Bỏ lọc ×</Text>
          </Pressable>
        </View>
      )}
      <View style={{ gap: 8 }}>
        {visible.map((p) => (
          <View key={p.id} testID="inventory-product" style={styles.product}>
            <View style={[s.row, { alignItems: 'flex-start', gap: 10 }]}>
              <View style={styles.productMark}>
                <Icon name="fast-food-outline" size={20} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.h3}>{p.name}</Text>
                <Text style={styles.sku}>
                  {p.sku}
                  {p.category ? ` · ${categoryName(p.category)}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.prices}>
              {[
                { tier: 'wholesale', label: 'Giá sỉ' },
                { tier: 'retail', label: 'Giá lẻ' },
              ].map(({ tier, label }) => {
                const rate = price(p.id, tier);
                return (
                  <View key={tier} style={styles.priceCell}>
                    <Text style={styles.sku}>{label}</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'baseline',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Text style={[styles.amount, !rate && { color: C.muted, fontSize: 12 }]}>
                        {rate ? money(rate.amount) : 'Chưa có giá'}
                      </Text>
                      {rate && <Text style={styles.sku}>/ {rate.price_unit}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </View>
      {!visible.length && (
        <Empty
          icon="cube-outline"
          title={products.length ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm đang bán'}
          body={products.length ? 'Thử tên, mã khác hoặc chọn tất cả nhóm.' : undefined}
        />
      )}
      {filterOpen && (
        <Sheet title="Nhóm sản phẩm" onClose={() => setFilterOpen(false)}>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {[
              { value: '', label: 'Tất cả nhóm' },
              ...categories.map((c) => ({ value: c, label: categoryName(c) })),
            ].map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: category === option.value }}
                onPress={() => {
                  setCategory(option.value);
                  setFilterOpen(false);
                }}
                style={[
                  s.between,
                  {
                    padding: 14,
                    minHeight: 48,
                    borderRadius: 12,
                    backgroundColor: category === option.value ? C.soft : C.paper,
                  },
                ]}
              >
                <Text style={s.text}>{option.label}</Text>
                {category === option.value && <Icon name="checkmark" size={19} />}
              </Pressable>
            ))}
          </ScrollView>
        </Sheet>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  page: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 24, gap: 8 },
  tool: {
    width: 44,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  product: {
    padding: 12,
    gap: 8,
    backgroundColor: C.paper,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  sku: { fontSize: 11, color: C.muted, lineHeight: 17 },
  prices: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
    gap: 12,
  },
  priceCell: { flex: 1, minWidth: 0, gap: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: C.green },
});
