"use client";

import React, { useMemo, useState } from "react";

const WHATSAPP_NUMBER = "50689695381";

function todayISO() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function addDaysISO(baseDate, daysToAdd) {
  var d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + daysToAdd);
  var pad = function (x) { return String(x).padStart(2, "0"); };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function minDeliveryISO() {
  var now = new Date();
  var hour = now.getHours();
  var addDays = hour >= 14 ? 2 : 1; // despues de 2pm -> pasado manana
  return addDaysISO(now, addDays);
}

function formatCRC(n) {
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      maximumFractionDigits: 0,
    }).format(n);
  } catch (e) {
    return "CRC " + Math.round(n).toLocaleString("es-CR");
  }
}

export default function Page() {
  var minDate = minDeliveryISO();
  const [restaurant, setRestaurant] = useState("");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(minDeliveryISO());
  const [deliveryWindow, setDeliveryWindow] = useState("Antes de 11:00 a.m.");
  const [notes, setNotes] = useState("");

  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const products = useMemo(function () {
    return [
      { id: "corvina_pp_entera", name: "Corvina PP Entera", price: 7000 },
      { id: "corvina_pp_fileteada", name: "Corvina PP Fileteada", price: 11200 },
      { id: "corvina_clase_entera", name: "Corvina Clase Entera", price: 5600 },
      { id: "corvina_clase_fileteada", name: "Corvina Clase Fileteada", price: 9100 },
      { id: "pargo_entero_plato", name: "Pargo Entero para Plato", price: 8400 },
      { id: "camaron_grande_entero", name: "Camaron Grande Entero", price: 14000 },
    ];
  }, []);

  const [cart, setCart] = useState({});

  const cartLines = useMemo(
    function () {
      const map = new Map(products.map((p) => [p.id, p]));
      return Object.keys(cart)
        .map(function (id) {
          const qty = cart[id];
          const p = map.get(id);
          if (!p || !qty) return null;
          return { id: p.id, name: p.name, price: p.price, qty: qty };
        })
        .filter(Boolean);
    },
    [cart, products]
  );

  const total = useMemo(
    function () {
      return cartLines.reduce(function (s, it) {
        return s + it.price * it.qty;
      }, 0);
    },
    [cartLines]
  );

  function addQty(id) {
    setCart(function (prev) {
      const next = Object.assign({}, prev);
      next[id] = (next[id] || 0) + 1;
      return next;
    });
  }

  function removeQty(id) {
    setCart(function (prev) {
      const next = Object.assign({}, prev);
      const v = (next[id] || 0) - 1;
      if (v <= 0) delete next[id];
      else next[id] = v;
      return next;
    });
  }

  function deleteItem(id) {
    setCart(function (prev) {
      const next = Object.assign({}, prev);
      delete next[id];
      return next;
    });
  }

  function buildWhatsAppMessage() {
    var msg = "Pedido - Mar Celajes\n";
    msg += "Restaurante: " + restaurant + "\n";
    if (contactName) msg += "Contacto: " + contactName + "\n";
    if (address) msg += "Dirección: " + address + "\n";
    if (phone) msg += "Tel: " + phone + "\n";
    msg += "Entrega: " + deliveryDate + " (" + deliveryWindow + ")\n\n";

    cartLines.forEach(function (it) {
      msg += "- " + it.name + " x " + it.qty + "\n";
    });

    msg += "\nTotal aprox.: " + formatCRC(total) + "\n";
    if (notes) msg += "\nNotas: " + notes + "\n";
    msg += "\nPor favor confirmar disponibilidad y hora exacta. Gracias.";
    return msg;
  }

async function sendOrder() {
  setStatusMsg(null);

  // Open WhatsApp window immediately to avoid popup blocking
  var waWindow = null;
  try {
    waWindow = window.open("about:blank", "_blank");
  } catch (e) {
    waWindow = null;
  }

  // Basic validations
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
  if (typeof minDate === "string" && deliveryDate < minDate) {
    if (waWindow && waWindow.close) waWindow.close();
    setStatusMsg({ type: "err", text: "Fecha minima permitida: " + minDate });
    return;
  }
  if (!cartLines || cartLines.length === 0) {
    if (waWindow && waWindow.close) waWindow.close();
    setStatusMsg({ type: "err", text: "El carrito esta vacio." });
    return;
  }

  // Build payload for proxy
  var payload = {
    restaurant_name: String(restaurant).trim(),
    contact_name: contactName ? String(contactName).trim() : "",
    restaurant_phone: phone ? String(phone).trim() : "",
    delivery_date: String(deliveryDate),
    delivery_window: deliveryWindow ? String(deliveryWindow).trim() : "",
    notes: notes ? String(notes) : "",
    total_crc: Number(total || 0),
    total_items: cartLines.reduce(function (s, it) {
      return s + Number(it.qty || 0);
    }, 0),
    items: cartLines.map(function (it) {
      return {
        id: it.id ? String(it.id) : "",
        name: it.name ? String(it.name) : "",
        unit: it.unit ? String(it.unit) : "",
        qty: Number(it.qty || 0),
        price: Number(it.price || 0),
        line_total: Number(it.line_total || (Number(it.qty || 0) * Number(it.price || 0)) || 0)
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

    var data = await res.json().catch(function () {
      return null;
    });

    if (!res.ok || !data || data.ok !== true) {
      var errText = (data && data.error) ? String(data.error) : ("Error enviando (HTTP " + res.status + ")");
      if (waWindow && waWindow.close) waWindow.close();
      setStatusMsg({ type: "err", text: errText });
      return;
    }

    var orderId = data.order_id ? String(data.order_id) : "";
    setStatusMsg({ type: "ok", text: "Pedido guardado correctamente. ID: " + (orderId || "OK") });

    // Build WhatsApp URL after successful save
    var waMsg = "";
    try {
      waMsg = buildWhatsAppMessage(orderId);
    } catch (e2) {
      waMsg = "Pedido - Mar Celajes";
    }

    var waUrl = "https://wa.me/" + String(WHATSAPP_NUMBER) + "?text=" + encodeURIComponent(waMsg);

    // Redirect the already-opened window to WhatsApp
    if (waWindow && waWindow.location) {
      waWindow.location.href = waUrl;
    } else {
      // Fallback: navigate current tab if popup blocked
      window.location.href = waUrl;
    }
  } catch (err) {
    if (waWindow && waWindow.close) waWindow.close();
    setStatusMsg({ type: "err", text: "Network error enviando pedido. Revisa /api/orders y Apps Script." });
  } finally {
    setSending(false);
  }
}


  return (
    <div style={{ padding: 24, fontFamily: "Arial", maxWidth: 820, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <img
          src="/logo-mar-celajes.png"
          alt="Mar Celajes"
          style={{ width: 150, height: 150, objectFit: "contain" }}
        />
        <div>
          <h1 style={{ margin: 0 }}>Mar Celajes - Pedidos</h1>
          <div style={{ color: "#555", fontSize: 18 }}>Sabores frescos del Golfo de Nicoya</div>
        </div>
      </div>

      {statusMsg ? (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            margin: "12px 0",
            background: statusMsg.type === "ok" ? "#e8fff1" : "#ffecec",
            border: "1px solid " + (statusMsg.type === "ok" ? "#9be3b5" : "#ffb3b3"),
          }}
        >
          {statusMsg.text}
        </div>
      ) : null}

      <h3>Datos</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input
          placeholder="Restaurante (requerido)"
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          placeholder="Contacto (chef/compras)"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <input
          placeholder="Telefono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <input
          type="date"
          value={deliveryDate}
          min={minDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <input
          placeholder="Dirección"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{gridColumn: "1 / -1", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />

        <input
          placeholder="Ventana de entrega (ej: antes de 11am)"
          value={deliveryWindow}
          onChange={(e) => setDeliveryWindow(e.target.value)}
          style={{ gridColumn: "1 / -1", padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
        />
        <textarea
          placeholder="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ gridColumn: "1 / -1", padding: 10, borderRadius: 10, border: "1px solid #ddd", minHeight: 40 }}
        />
      </div>

      <hr style={{ margin: "18px 0" }} />

      <h3>Productos (No incluye IVA)</h3>
      {products.map(function (p) {
        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              border: "1px solid #eee",
              borderRadius: 12,
              marginBottom: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{p.name}</div>
              <div style={{ color: "#555" }}>{formatCRC(p.price)} / kilo</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => removeQty(p.id)} style={{ padding: "8px 12px" }}>
                -
              </button>
              <div style={{ minWidth: 26, textAlign: "center" }}>{cart[p.id] || 0}</div>
              <button onClick={() => addQty(p.id)} style={{ padding: "8px 12px" }}>
                +
              </button>
              <button onClick={() => deleteItem(p.id)} style={{ padding: "8px 12px", background: "#f6f6f6" }}>
                Eliminar
              </button>
            </div>
          </div>
        );
      })}

      <hr style={{ margin: "18px 0" }} />

      <h3>Resumen</h3>
      {cartLines.length === 0 ? (
        <div style={{ color: "#777" }}>(carrito vacio)</div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {cartLines.map(function (it) {
            return (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  {it.name} x {it.qty}
                </div>
                <div>{formatCRC(it.qty * it.price)}</div>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ marginTop: 14 }}>Total: {formatCRC(total)}</h2>

      <button
        onClick={sendOrder}
        disabled={sending || cartLines.length === 0}
        style={{
          padding: "12px 16px",
          borderRadius: 12,
          border: "none",
          background: sending ? "#999" : "#0b5fff",
          color: "white",
          fontWeight: 700,
          cursor: sending ? "not-allowed" : "pointer",
        }}
      >
        {sending ? "Enviando..." : "Enviar Pedido"}
      </button>
    </div>
  );
}