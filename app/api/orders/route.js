export const runtime = "nodejs";

const SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbz8V9GSKCOcDPj01ixJCWeTYOYAdOdQVQmjq2PSWvQH9zStQeiW5yMLgjTFQKtfMiUp/exec";
const API_KEY = "MI_LLAVE_CELAJES_98765";

export async function POST(req) {
  var body = null;
  try {
    body = await req.json();
  } catch (e) {
    return Response.json(
      { ok: false, error: "Invalid JSON received by proxy", details: String(e) },
      { status: 400 }
    );
  }

  try {
    var payload = Object.assign({}, body);
    payload.api_key = API_KEY;

    var url = SHEETS_API_URL + "?action=create";

    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    var text = await res.text();

    var data = null;
    try {
      data = JSON.parse(text);
    } catch (e2) {
      return Response.json(
        {
          ok: false,
          error: "Apps Script did not return JSON",
          http_status: res.status,
          content_type: res.headers.get("content-type") || "",
          sample: String(text).slice(0, 400)
        },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return Response.json(
        { ok: false, error: "Apps Script HTTP error", http_status: res.status, data: data },
        { status: 502 }
      );
    }

    if (!data || data.ok !== true) {
      return Response.json(
        { ok: false, error: "Apps Script returned ok=false", data: data },
        { status: 200 }
      );
    }

    return Response.json(data, { status: 200 });
  } catch (err) {
    return Response.json(
      { ok: false, error: "Server proxy error", details: String(err) },
      { status: 500 }
    );
  }
}