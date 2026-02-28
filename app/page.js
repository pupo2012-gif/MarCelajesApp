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
      { id: "corvina_pp_entera", name: "Corvina PP Entera", price: 10000 },
      { id: "corvina_pp_fileteada", name: "Corvina PP Fileteada", price: 13300 },
      { id: "corvina_clase_entera", name: "Corvina Clase Entera", price: 23300 },
      { id: "corvina_clase_fileteada", name: "Corvina Clase Fileteada", price: 23300 },
      { id: "pargo_entero_plato", name: "Pargo Entero para Plato", price: 23300 },
      { id: "camaron_grande_entero", name: "Carmaron Grande Entero", price: 23300 },
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
    var min = minDeliveryISO();
    if (deliveryDate < min) {
      setStatusMsg({
        type: "err",
        text: "La fecha de entrega minima es " + min + " (regla: despues de 2pm es pasado manana)."
    });
    return;
    }


    if (!restaurant.trim()) {
      setStatusMsg({ type: "err", text: "Falta el nombre del restaurante." });
      return;
    }
    if (!deliveryDate) {
      setStatusMsg({ type: "err", text: "Falta la fecha de entrega." });
      return;
    }
    if (cartLines.length === 0) {
      setStatusMsg({ type: "err", text: "El carrito esta vacio." });
      return;
    }

    const payload = {
      restaurant_name: restaurant.trim(),
      contact_name: contactName.trim(),
      restaurant_phone: phone.trim(),
      address: address.trim(),
      delivery_date: deliveryDate + 2,
      delivery_window: deliveryWindow.trim(),
      notes: notes,
      total_crc: total,
      total_items: cartLines.reduce(function (s, it) {
        return s + it.qty;
      }, 0),
      items: cartLines.map(function (it) {
        return {
          id: it.id,
          name: it.name,
          qty: it.qty,
          price: it.price,
          line_total: it.qty * it.price,
        };
      }),
    };

    setSending(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(function () {
        return null;
      });

      if (!res.ok || !data || !data.ok) {
        const errText = (data && data.error) ? data.error : ("Error enviando pedido (HTTP " + res.status + ")");
        setStatusMsg({ type: "err", text: errText });
        return;
      }

      setStatusMsg({ type: "ok", text: "Pedido enviado correctamente. ID: " + (data.order_id || "OK") });

      const waMsg = buildWhatsAppMessage();
      const waUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(waMsg);
      window.open(waUrl, "_blank");
    } catch (e) {
      setStatusMsg({ type: "err", text: "NetworkError: no se pudo enviar. Revisar /api/orders y Apps Script." });
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