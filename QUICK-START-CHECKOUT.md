# 🚀 Quick Start: Dynamic Checkout Buttons

**5-Minuten Setup für automatische Checkout-Integration**

---

## 1️⃣ Dateien prüfen

```bash
# Checkout Library vorhanden?
ls lib/checkout.js
ls public/lib/checkout.js

# ✅ Beide sollten existieren (8.4 KB)
```

---

## 2️⃣ In HTML einbinden

```html
<!-- In <head> -->
<script src="lib/checkout.js" type="module" defer></script>
```

---

## 3️⃣ Buttons erstellen

### Standard-Produkt
```html
<button 
  data-checkout="standard" 
  data-sku="UO-GLASS-01">
  Jetzt kaufen
</button>
```

### Bundle
```html
<button 
  data-checkout="bundle" 
  data-bundle-id="uuid-bundle-id">
  Bundle kaufen
</button>
```

### Preset
```html
<button 
  data-checkout="preset" 
  data-preset-id="uuid-preset-id">
  Preset kaufen
</button>
```

---

## 4️⃣ Fertig! 🎉

checkout.js bindet automatisch Events an alle Buttons mit `data-checkout` Attribut.

**Kein JavaScript-Code nötig.**

---

## 🧪 Testen

1. **Demo öffnen:**
   ```
   http://localhost:3000/checkout-demo.html
   ```

2. **Shop öffnen:**
   ```
   http://localhost:3000/shop.html
   ```

3. **Button klicken** → Stripe Checkout öffnet sich ✅

---

## 📚 Vollständige Doku

**Alle Details:**  
[CHECKOUT-INTEGRATION.md](./CHECKOUT-INTEGRATION.md)

**Katalog-System:**  
[CATALOG-IMPLEMENTATION.md](./CATALOG-IMPLEMENTATION.md)

---

## 💡 Neue Produkte kaufbar machen

```sql
-- Einfach in Supabase einfügen
INSERT INTO products (
  sku, 
  name_de, 
  base_price_cents, 
  active
) VALUES (
  'UO-NEW-PRODUCT',
  'Neues Produkt',
  8900,
  true
);
```

**Shop-Seite lädt** → Produkt erscheint mit funktionierendem Checkout-Button!

**KEIN Code-Ändern nötig.** ✨
