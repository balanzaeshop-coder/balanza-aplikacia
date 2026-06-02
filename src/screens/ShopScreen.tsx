import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';
import { colors, fonts } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const API = 'https://www.balanza.sk/api/app';

interface Product {
  id: string;
  category: 'pad' | 'desk' | 'accessory';
  name: string;
  subtitle: string;
  price: number;
  priceLabel?: string;
  image: string;
  images: string[];
  url: string;
  configurable?: boolean;
  specs?: { label: string; value: string }[];
}

interface CartItem { product: Product; qty: number; }

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Všetko',
  bundle: 'Sety',
  pad: 'Chodiacie pásy',
  desk: 'Stoly',
  accessory: 'Doplnky',
};

function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <BlurView intensity={24} tint="dark" style={[s.glassOuter, style]}>
      <View style={s.glassInner}>{children}</View>
    </BlurView>
  );
}

export default function ShopScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState<'stripe' | 'transfer' | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', street: '', city: '', zip: '' });
  const [ordering, setOrdering] = useState(false);
  const [orderDone, setOrderDone] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/products`)
      .then(r => r.json())
      .then(data => { setProducts(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = category === 'all' ? products : products.filter(p => p.category === category);
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(product: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.product.id === product.id);
      if (ex) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
    setSelected(null);
    Alert.alert('Pridané do košíka', product.name);
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(i => i.product.id !== id));
  }

  async function placeOrder() {
    if (!form.name || !form.email || !form.street || !form.city || !form.zip) {
      Alert.alert('Chýbajúce údaje', 'Vyplň všetky povinné polia.');
      return;
    }
    setOrdering(true);
    try {
      const items = cart.map(i => ({ name: i.product.name, price: i.product.price, qty: i.qty }));
      const res = await fetch(`${API}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: checkoutMethod, items, customer: form }),
      });
      const data = await res.json();

      if (checkoutMethod === 'stripe' && data.url) {
        setOrdering(false);
        setShowCheckout(false);
        await WebBrowser.openBrowserAsync(data.url);
        setCart([]);
      } else if (checkoutMethod === 'transfer' && data.invoiceNumber) {
        setCart([]);
        setShowCheckout(false);
        setOrderDone(data.invoiceNumber);
      } else {
        Alert.alert('Chyba', data.error ?? 'Skús znovu.');
      }
    } catch {
      Alert.alert('Chyba', 'Skontroluj internetové pripojenie.');
    }
    setOrdering(false);
  }

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Obchod</Text>
        {cartCount > 0 && (
          <TouchableOpacity style={s.cartBtn} onPress={() => setShowCart(true)}>
            <Text style={s.cartBtnText}>🛒 {cartCount}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {Object.keys(CATEGORY_LABELS).map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.filterBtn, category === cat && s.filterBtnActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[s.filterBtnText, category === cat && s.filterBtnTextActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Product grid */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        numColumns={2}
        contentContainerStyle={s.grid}
        columnWrapperStyle={{ gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.productCard} onPress={() => setSelected(item)}>
            <Image source={{ uri: item.image }} style={s.productImage} resizeMode="contain" />
            <View style={s.productInfo}>
              <Text style={s.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={s.productPrice}>{item.priceLabel ?? `${item.price.toFixed(0)} €`}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Product detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
              <Image source={{ uri: selected.image }} style={s.detailImage} resizeMode="contain" />
              <View style={s.detailContent}>
                <Text style={s.detailName}>{selected.name}</Text>
                <Text style={s.detailSubtitle}>{selected.subtitle}</Text>
                <Text style={s.detailPrice}>{selected.priceLabel ?? `${selected.price.toFixed(0)} €`}</Text>

                {selected.specs && (
                  <GlassCard style={{ marginTop: 20 }}>
                    {selected.specs.map((sp, i) => (
                      <View key={i} style={[s.specRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 }]}>
                        <Text style={s.specLabel}>{sp.label}</Text>
                        <Text style={s.specValue}>{sp.value}</Text>
                      </View>
                    ))}
                  </GlassCard>
                )}

                {selected.configurable && (
                  <GlassCard style={{ marginTop: 12 }}>
                    <Text style={s.configNote}>Tento produkt je konfigurovateľný (rám, doska, veľkosť). Po kliknutí na objednanie budeš presmerovaný na konfigurátor.</Text>
                  </GlassCard>
                )}
              </View>
            </ScrollView>

            <View style={s.detailFooter}>
              <TouchableOpacity style={s.btnSecondary} onPress={() => setSelected(null)}>
                <Text style={s.btnSecondaryText}>Späť</Text>
              </TouchableOpacity>
              {selected.configurable ? (
                <TouchableOpacity style={s.btnPrimary} onPress={() => { setSelected(null); WebBrowser.openBrowserAsync(selected.url); }}>
                  <Text style={s.btnPrimaryText}>Konfigurovať</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.btnPrimary} onPress={() => addToCart(selected)}>
                  <Text style={s.btnPrimaryText}>Pridať do košíka</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </Modal>

      {/* Cart modal */}
      <Modal visible={showCart} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCart(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
          <Text style={s.modalTitle}>Košík</Text>
          {cart.length === 0 ? (
            <Text style={s.emptyText}>Košík je prázdny</Text>
          ) : (
            <>
              <FlatList
                data={cart}
                keyExtractor={i => i.product.id}
                renderItem={({ item }) => (
                  <View style={s.cartRow}>
                    <Image source={{ uri: item.product.image }} style={s.cartImage} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.cartItemName}>{item.product.name}</Text>
                      <Text style={s.cartItemPrice}>{(item.product.price * item.qty).toFixed(2)} €</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeFromCart(item.product.id)}>
                      <Text style={{ color: colors.danger, fontSize: 20 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
              <View style={s.cartTotal}>
                <Text style={s.cartTotalLabel}>Spolu</Text>
                <Text style={s.cartTotalValue}>{cartTotal.toFixed(2)} €</Text>
              </View>
              <TouchableOpacity style={s.btnPrimary} onPress={() => { setShowCart(false); setShowCheckout(true); }}>
                <Text style={s.btnPrimaryText}>Objednať</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={s.btnGhost} onPress={() => setShowCart(false)}>
            <Text style={s.btnGhostText}>Zatvoriť</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Checkout modal */}
      <Modal visible={showCheckout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCheckout(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
            <Text style={s.modalTitle}>Doručovacie údaje</Text>

            {[
              { key: 'name', label: 'Meno a priezvisko *', placeholder: 'Ján Novák' },
              { key: 'email', label: 'E-mail *', placeholder: 'jan@email.sk' },
              { key: 'phone', label: 'Telefón', placeholder: '+421 900 000 000' },
              { key: 'street', label: 'Ulica a číslo *', placeholder: 'Hlavná 1' },
              { key: 'city', label: 'Mesto *', placeholder: 'Bratislava' },
              { key: 'zip', label: 'PSČ *', placeholder: '811 01' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 12 }}>
                <Text style={s.inputLabel}>{f.label}</Text>
                <TextInput
                  style={s.input}
                  value={(form as any)[f.key]}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={f.key === 'email' ? 'email-address' : f.key === 'phone' ? 'phone-pad' : 'default'}
                  autoCapitalize={f.key === 'email' ? 'none' : 'words'}
                />
              </View>
            ))}

            <Text style={[s.inputLabel, { marginTop: 8, marginBottom: 12 }]}>Spôsob platby</Text>
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[s.paymentBtn, checkoutMethod === 'stripe' && s.paymentBtnActive]}
                onPress={() => setCheckoutMethod('stripe')}
              >
                <Text style={s.paymentBtnText}>💳  Platba kartou / Apple Pay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.paymentBtn, checkoutMethod === 'transfer' && s.paymentBtnActive]}
                onPress={() => setCheckoutMethod('transfer')}
              >
                <Text style={s.paymentBtnText}>🏦  Bankový prevod</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, { marginTop: 24 }, (!checkoutMethod || ordering) && { opacity: 0.5 }]}
              onPress={placeOrder}
              disabled={!checkoutMethod || ordering}
            >
              {ordering
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={s.btnPrimaryText}>Potvrdiť objednávku</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={() => setShowCheckout(false)}>
              <Text style={s.btnGhostText}>Späť</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Order success modal */}
      <Modal visible={!!orderDone} animationType="fade" transparent>
        <View style={s.successOverlay}>
          <GlassCard style={{ margin: 24 }}>
            <Text style={[s.modalTitle, { textAlign: 'center' }]}>Objednávka prijatá</Text>
            <Text style={[s.emptyText, { textAlign: 'center', marginTop: 8 }]}>Faktúra č. {orderDone} bola odoslaná na tvoj e-mail.</Text>
            <TouchableOpacity style={[s.btnPrimary, { marginTop: 20 }]} onPress={() => setOrderDone(null)}>
              <Text style={s.btnPrimaryText}>Zatvoriť</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 32, color: colors.textPrimary },
  cartBtn: { backgroundColor: colors.accentLight, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  cartBtnText: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 14 },

  filterRow: { maxHeight: 48, marginBottom: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  filterBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterBtnText: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 13 },
  filterBtnTextActive: { color: colors.bg },

  grid: { padding: 20, gap: 12 },
  productCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  productImage: { width: '100%', height: 140, backgroundColor: 'rgba(255,255,255,0.05)' },
  productInfo: { padding: 12 },
  productName: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 14, marginBottom: 4 },
  productPrice: { fontFamily: fonts.bold, color: colors.accent, fontSize: 16 },

  detailImage: { width: SCREEN_W, height: 280, backgroundColor: 'rgba(255,255,255,0.05)' },
  detailContent: { padding: 24 },
  detailName: { fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary },
  detailSubtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  detailPrice: { fontFamily: fonts.bold, fontSize: 32, color: colors.accent, marginTop: 8 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between' },
  specLabel: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 14 },
  specValue: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 14 },
  configNote: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  detailFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, padding: 20, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },

  cartRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  cartImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: colors.bgCardAlt },
  cartItemName: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 14 },
  cartItemPrice: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  cartTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 },
  cartTotalLabel: { fontFamily: fonts.semiBold, color: colors.textSecondary, fontSize: 16 },
  cartTotalValue: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 24 },

  inputLabel: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: colors.bgCardAlt, borderRadius: 12, padding: 14, fontSize: 16, fontFamily: fonts.regular, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  paymentBtn: { padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard },
  paymentBtnActive: { borderColor: colors.accent, backgroundColor: colors.accentLight },
  paymentBtnText: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 15 },

  modalTitle: { fontFamily: fonts.bold, color: colors.textPrimary, fontSize: 24, marginBottom: 16 },
  emptyText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 15 },

  btnPrimary: { backgroundColor: colors.accent, paddingVertical: 16, borderRadius: 50, alignItems: 'center', flex: 1 },
  btnPrimaryText: { fontFamily: fonts.semiBold, color: colors.bg, fontSize: 16 },
  btnSecondary: { backgroundColor: colors.bgCard, paddingVertical: 16, borderRadius: 50, alignItems: 'center', flex: 1, borderWidth: 1, borderColor: colors.border },
  btnSecondaryText: { fontFamily: fonts.semiBold, color: colors.textPrimary, fontSize: 16 },
  btnGhost: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  btnGhostText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 14 },

  glassOuter: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  glassInner: { backgroundColor: 'rgba(13,12,20,0.35)', padding: 20 },

  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' },
});
