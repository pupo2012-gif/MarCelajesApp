"use client";

import React, { useEffect, useMemo, useState } from "react";

const WHATSAPP_NUMBER = "50689695381";

function pad2(x) {
  return String(x).padStart(2, "0");
}

function addDaysISO(baseDate, daysToAdd) {
  var d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + daysToAdd);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function minDeliveryISO() {
  var now = new Date();
  var hour = now.getHours();
  var addDays = hour >= 14 ? 2 : 1;
  return addDaysISO(now, addDays);
}

function formatCRC(n) {
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      maximumFractionDigits: 0
    }).format(n);
  } catch (e) {
    return "CRC " + Math.round(n).toLocaleString("es-CR");
  }
}

export default function Page() {
  // Datos restaurante
  const [restaurant, setRestaurant] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(minDeliveryISO());
  const [deliveryWindow, setDeliveryWindow] = useState("Antes de 11:00 a.m.");
  const [notes, setNotes] = useState("");

  // UI
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null); // {type:'ok'|'err', text:''}
  const [cartOpen, setCartOpen] = useState(false);

  // Min date rule
  const minDate = minDeliveryISO();

  useEffect(
    function () {
      if (deliveryDate < minDate) setDeliveryDate(minDate);
    },
    [minDate]
  );

  // Catalogo (ajusta precios/productos)
  const products = useMemo(function () {
    return [
      { id: "corvina_pp_entera", name: "Corvina PP entera", desc: "Fresca", price: 7000, unit: "kg" },
      { id: "corvina_pp_filete", name: "Corvina PP Filete", desc: "Fresca, fileteada", price: 11200, unit: "kg" },
      { id: "corvina_clase_entera", name: "Corvina Clase Entera", desc: "Fresca", price: 5600, unit: "kg" },
      { id: "corvina_clase_filete", name: "Corvina Clase Filete", desc: "Fresca, fileteada", price: 9100, unit: "kg" },
      { id: "pargo_entero", name: "Pargo Entero para Plato", desc: "Fresco", price: 8400, unit: "kg" },
      { id: "camaron_grande_entero", name: "Camarón Grande Entero", desc: "Fresco", price: 14000, unit: "kg" }
    ];
  }, []);

  // Carrito: { [id]: qty }
  const [cart, setCart] = useState({});

  const filtered = useMemo(
    function () {
      var q = String(query || "").trim().toLowerCase();
      if (!q) return products;
      return products.filter(function (p) {
        var t = (p.name + " " + (p.desc || "")).toLowerCase();
        return t.indexOf(q) >= 0;
      });
    },
    [query, products]
  );

  const cartLines = useMemo(
    function () {
      var map = new Map(products.map(function (p) { return [p.id, p]; }));
      return Object.keys(cart)
        .map(function (id) {
          var p = map.get(id);
          var qty = cart[id];
          if (!p || !qty) return null;
          return {
            id: p.id,
            name: p.name,
            unit: p.unit,
            qty: Number(qty || 0),
            price: Number(p.price || 0),
            line_total: Number(qty || 0) * Number(p.price || 0)
          };
        })
        .filter(Boolean);
    },
    [cart, products]
  );

  const totalItems = useMemo(
    function () {
      return cartLines.reduce(function (s, it) { return s + Number(it.qty || 0); }, 0);
    },
    [cartLines]
  );

  const total = useMemo(
    function () {
      return cartLines.reduce(function (s, it) { return s + Number(it.line_total || 0); }, 0);
    },
    [cartLines]
  );

  function addQty(id) {
    setCart(function (prev) {
      var next = Object.assign({}, prev);
      next[id] = (next[id] || 0) + 1;
      return next;
    });
  }

  function subQty(id) {
    setCart(function (prev) {
      var next = Object.assign({}, prev);
      var v = (next[id] || 0) - 1;
      if (v <= 0) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  function removeItem(id) {
    setCart(function (prev) {
      var next = Object.assign({}, prev);
      delete next[id];
      return next;
    });
  }

  function clearCart() {
    setCart({});
  }

  function buildWhatsAppMessage(orderId) {
    var msg = "Pedido - Mar Celajes\n";
    if (orderId) msg += "ID: " + orderId + "\n";
    msg += "Restaurante: " + restaurant + "\n";
    if (contactName) msg += "Contacto: " + contactName + "\n";
    if (address) msg += "Dirección: " + address + "\n";
    if (phone) msg += "Tel: " + phone + "\n";
    msg += "Entrega: " + deliveryDate + " (" + deliveryWindow + ")\n\n";

    cartLines.forEach(function (it) {
      msg += "- " + it.name + " x " + it.qty + " " + (it.unit || "") + "\n";
    });

    msg += "\nTotal aprox.: " + formatCRC(total) + "\n";
    if (notes) msg += "\nNotas: " + notes + "\n";
    msg += "\nPor favor confirmar disponibilidad. Gracias.";
    return msg;
  }

  // SEND ORDER (proxy + WhatsApp placeholder)
  async function sendOrder() {
    setStatusMsg(null);

    // Open WhatsApp window immediately to avoid popup blocking
    var waWindow = null;
    try {
      waWindow = window.open("about:blank", "_blank");
    } catch (e) {
      waWindow = null;
    }

    // Validations
    if (!restaurant || !restaurant.trim()) {
      if (waWindow && waWindow.close) waWindow.close();
      setStatusMsg({ type: "err", text: "Falta el nombre del restaurante." });
      return;
    }
    if (!deliveryDate) {
      if (waWindow && waWindow.close) waWindow.close();
      setStatusMsg({ type: "err", text: "Falta la fecha de entrega." });
      return;
    }
    if (deliveryDate < minDate) {
      if (waWindow && waWindow.close) waWindow.close();
      setStatusMsg({ type: "err", text: "Fecha mínima permitida: " + minDate });
      return;
    }
    if (!cartLines || cartLines.length === 0) {
      if (waWindow && waWindow.close) waWindow.close();
      setStatusMsg({ type: "err", text: "El carrito esta vacío." });
      return;
    }

    var payload = {
      restaurant_name: String(restaurant).trim(),
      contact_name: contactName ? String(contactName).trim() : "",
      address: address ? String(address).trim() : "",
      restaurant_phone: phone ? String(phone).trim() : "",
      delivery_date: String(deliveryDate),
      delivery_window: deliveryWindow ? String(deliveryWindow).trim() : "",
      notes: notes ? String(notes) : "",
      total_crc: Number(total || 0),
      total_items: Number(totalItems || 0),
      items: cartLines.map(function (it) {
        return {
          id: it.id ? String(it.id) : "",
          name: it.name ? String(it.name) : "",
          unit: it.unit ? String(it.unit) : "",
          qty: Number(it.qty || 0),
          price: Number(it.price || 0),
          line_total: Number(it.line_total || 0)
        };
      })
    };

    setSending(true);

    try {
      var res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      var data = await res.json().catch(function () { return null; });

      if (!res.ok || !data || data.ok !== true) {
        var errText = (data && data.error) ? String(data.error) : ("Error enviando (HTTP " + res.status + ")");
        if (waWindow && waWindow.close) waWindow.close();
        setStatusMsg({ type: "err", text: errText });
        return;
      }

      var orderId = data.order_id ? String(data.order_id) : "";
      var extra = "";
      if (data.items_written !== undefined && data.items_written !== null) {
        extra = " Items: " + String(data.items_written) + ".";
      }

      setStatusMsg({ type: "ok", text: "Pedido guardado correctamente. ID: " + (orderId || "OK") + "." + extra });

      // Close drawer on success (optional)
      setCartOpen(false);

      var waMsg = buildWhatsAppMessage(orderId);
      var waUrl = "https://wa.me/" + String(WHATSAPP_NUMBER) + "?text=" + encodeURIComponent(waMsg);

      if (waWindow && waWindow.location) {
        waWindow.location.href = waUrl;
      } else {
        window.location.href = waUrl;
      }
    } catch (err) {
      if (waWindow && waWindow.close) waWindow.close();
      setStatusMsg({ type: "err", text: "Network error enviando pedido. Revisa /api/orders y Apps Script." });
    } finally {
      setSending(false);
    }
  }

  function openCart() {
    if (cartLines.length === 0) {
      setStatusMsg({ type: "err", text: "El carrito esta vacío." });
      return;
    }
    setCartOpen(true);
  }

  function closeCart() {
    setCartOpen(false);
  }

  return (
    <div>
      {/* Sticky header + search */}
      <div className="topbar">
        <div className="topbar-inner">
          <img className="logo" src="/logo-mar-celajes.png" alt="Mar Celajes" />
          <div className="brand">
            <h1>Mar Celajes</h1>
            <p>Sabores frescos del</p>
            <p>Golfo de Nicoya</p>
          </div>
        </div>
        <div className="search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto (corvina, pargo, camarón...)"
          />
        </div>
      </div>

      <div className="container">
        {/* Status */}
        {statusMsg ? (
          <div className={"alert " + (statusMsg.type === "ok" ? "ok" : "err")}>
            {statusMsg.text}
          </div>
        ) : null}

        {/* Datos */}
        <div className="card">
          <div className="section-title">Datos del restaurante</div>

          <div className="grid2">
            <input
              className="input"
              placeholder="Restaurante (requerido)"
              value={restaurant}
              onChange={(e) => setRestaurant(e.target.value)}
            />
            <input
              className="input"
              placeholder="Contacto (chef/compras)"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
             <input
              className="input"
              placeholder="Dirección"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ gridColumn: "1 / -1" }}
            />
            <input
              className="input"
              type="date"
              min={minDate}
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
            <input
              className="input"
              placeholder="Ventana de entrega (ej: antes de 11am)"
              value={deliveryWindow}
              onChange={(e) => setDeliveryWindow(e.target.value)}
              style={{ gridColumn: "1 / -1" }}
            />
            <textarea
              className="textarea"
              placeholder="Notas (cortes, sustitutos, pago, etc.)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ gridColumn: "1 / -1" }}
            />
          </div>

          <div className="helper">
            Regla: antes de 2pm minimo manana; despues de 2pm minimo pasado manana.
          </div>
        </div>

        {/* Productos */}
        <div style={{ height: 12 }} />

        <div className="list">
          {filtered.map(function (p) {
            var qty = cart[p.id] || 0;

            return (
              <div className="card" key={p.id}>
                <div className="product">
                  <div className="meta">
                    <p className="name">{p.name}</p>
                    <p className="desc">{p.desc}</p>
                    <div className="price">
                      {formatCRC(p.price)} / {p.unit}
                    </div>
                  </div>

                  <div>
                    <div className="qty">
                      <button className="circle" onClick={() => subQty(p.id)} aria-label="Menos">
                        -
                      </button>
                      <div className="count">{qty}</div>
                      <button className="circle dark" onClick={() => addQty(p.id)} aria-label="Mas">
                        +
                      </button>
                    </div>

                    {qty > 0 ? (
                      <button className="link" onClick={() => removeItem(p.id)}>
                        Quitar del carrito
                      </button>
                    ) : null}
                  </div>
                </div>

                {qty > 0 ? (
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: 13 }}>
                    <div>Subtotal</div>
                    <div style={{ fontWeight: 700, color: "#111827" }}>{formatCRC(qty * p.price)}</div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bottombar">
        <div className="bottombar-inner">
          <div className="total">
            <div className="label">Total ({totalItems} items)</div>
            <div className="value">{formatCRC(total)}</div>
          </div>

          <button className="secondary" onClick={openCart} disabled={cartLines.length === 0}>
            Ver carrito
          </button>

          <button className="primary" onClick={sendOrder} disabled={sending || cartLines.length === 0}>
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>

      {/* Drawer */}
      <div className={"drawer-overlay" + (cartOpen ? " show" : "")} onClick={closeCart} />

      <div className={"drawer" + (cartOpen ? " show" : "")} role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div className="drawer-title">Tu carrito</div>
          <button className="drawer-close" onClick={closeCart} aria-label="Cerrar">
            X
          </button>
        </div>

        <div className="drawer-body">
          {cartLines.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>Carrito vacio.</div>
          ) : (
            <div className="drawer-list">
              {cartLines.map(function (it) {
                return (
                  <div key={it.id} className="drawer-item">
                    <div className="drawer-item-meta">
                      <div className="drawer-item-name">{it.name}</div>
                      <div className="drawer-item-sub">
                        {formatCRC(it.price)} / {it.unit}
                      </div>
                    </div>

                    <div className="drawer-item-actions">
                      <button className="circle" onClick={() => subQty(it.id)} aria-label="Menos">
                        -
                      </button>
                      <div className="count">{it.qty}</div>
                      <button className="circle dark" onClick={() => addQty(it.id)} aria-label="Mas">
                        +
                      </button>
                    </div>

                    <div className="drawer-item-total">{formatCRC(it.line_total)}</div>

                    <button className="drawer-remove" onClick={() => removeItem(it.id)}>
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="drawer-summary">
            <div className="drawer-summary-row">
              <div className="muted">Items</div>
              <div className="bold">{totalItems}</div>
            </div>
            <div className="drawer-summary-row">
              <div className="muted">Total</div>
              <div className="bold">{formatCRC(total)}</div>
            </div>
          </div>

          <div className="drawer-actions">
            <button className="ghost" onClick={clearCart} disabled={cartLines.length === 0 || sending}>
              Vaciar carrito
            </button>
            <button className="primary big" onClick={sendOrder} disabled={sending || cartLines.length === 0}>
              {sending ? "Enviando..." : "Enviar pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}