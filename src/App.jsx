import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://aqxfhfivulakvyfhfuxd.supabase.co";
const SUPABASE_KEY = "sb_publishable_ey7OxNNuNZGZ9X05HhyHrQ_lt-c1aZD";

const USERS = { Markus: "1337", Anders: "1337" };

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

async function dbGetAll() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mules?order=created_at.desc`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbInsert(mule) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mules`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      name: mule.name, location: mule.location, date: mule.date || null,
      rating: mule.rating, rating_taste: mule.ratingTaste, rating_looks: mule.ratingLooks,
      added_by: mule.addedBy, notes: mule.notes, tags: mule.tags,
      price: mule.price ? parseInt(mule.price) : null, image: mule.image || null,

    })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbDelete(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mules?id=eq.${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(await res.text());
}

function rowToMule(row) {
  return {
    id: row.id, name: row.name, location: row.location, date: row.date,
    rating: row.rating, ratingTaste: row.rating_taste, ratingLooks: row.rating_looks,
    addedBy: row.added_by, tastedBy: row.tasted_by || [],
    notes: row.notes, tags: row.tags || [], price: row.price,
    image: row.image, createdAt: row.created_at,

  };
}

function getAvg(mule) {
  if (mule.ratingTaste != null && mule.ratingLooks != null) return (mule.ratingTaste + mule.ratingLooks) / 2;
  return mule.rating || 0;
}
function fmtAvg(v) { return v % 1 === 0 ? String(v) : v.toFixed(1); }

// ── Map Picker ────────────────────────────────────────────────────────────────
function MapPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [pin, setPin] = useState(null);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }
    // Load Leaflet JS
    const loadMap = () => {
      if (mapInstanceRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current).setView([48, 15], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(map);
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = L.marker([lat, lng]).addTo(map);
        // Reverse geocode
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await res.json();
        const loc = data.display_name?.split(",").slice(0, 3).join(", ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setPin({ lat, lng, location: loc });
      });
      mapInstanceRef.current = map;
    };

    if (window.L) {
      loadMap();
    } else {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = loadMap;
      document.head.appendChild(script);
    }
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
    const data = await res.json();
    setResults(data);
    setSearching(false);
  };

  const selectResult = (r) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    const L = window.L;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([lat, lng]).addTo(mapInstanceRef.current);
    mapInstanceRef.current.setView([lat, lng], 15);
    const loc = r.display_name.split(",").slice(0, 3).join(", ");
    setPin({ lat, lng, location: loc });
    setResults([]);
    setQuery(loc);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16 }}>
      <div style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 20, width: "100%", maxWidth: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #2a1f0e" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#C8923A", marginBottom: 12 }}>📍 Drop a pin</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
              placeholder="Search for a bar or city..." style={{ flex: 1, background: "#0f0b06", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 14px", color: "#e8d5b0", fontSize: 14, outline: "none" }} />
            <button onClick={search} style={{ background: "#C8923A", border: "none", borderRadius: 10, padding: "10px 16px", color: "#0f0b06", fontWeight: 700, cursor: "pointer" }}>
              {searching ? "..." : "Search"}
            </button>
          </div>
          {results.length > 0 && (
            <div style={{ marginTop: 8, background: "#0f0b06", borderRadius: 10, border: "1px solid #2a1f0e", overflow: "hidden" }}>
              {results.map((r, i) => (
                <div key={i} onClick={() => selectResult(r)} style={{ padding: "10px 14px", color: "#e8d5b0", fontSize: 13, cursor: "pointer", borderBottom: i < results.length - 1 ? "1px solid #2a1f0e" : "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1a1208"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  📍 {r.display_name.split(",").slice(0, 3).join(", ")}
                </div>
              ))}
            </div>
          )}
        </div>
        <div ref={mapRef} style={{ flex: 1, minHeight: 300 }} />
        {pin && (
          <div style={{ padding: 12, borderTop: "1px solid #2a1f0e", background: "#0f0b06" }}>
            <div style={{ color: "#C8923A", fontSize: 13, marginBottom: 10 }}>📍 {pin.location}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid #3a2e1a", color: "#7a6a52", borderRadius: 10, padding: 10, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => onSelect(pin)} style={{ flex: 2, background: "linear-gradient(135deg, #C8923A, #a06820)", border: "none", color: "#0f0b06", borderRadius: 10, padding: 10, fontWeight: 700, cursor: "pointer" }}>
                Use this location
              </button>
            </div>
          </div>
        )}
        {!pin && (
          <div style={{ padding: 12, borderTop: "1px solid #2a1f0e", textAlign: "center" }}>
            <div style={{ color: "#5a4a32", fontSize: 13 }}>Search for a place or tap the map to drop a pin</div>
            <button onClick={onClose} style={{ marginTop: 8, background: "transparent", border: "1px solid #3a2e1a", color: "#7a6a52", borderRadius: 10, padding: "8px 20px", cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handlePin = (digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (USERS[selected] === next) { onLogin(selected); }
        else {
          setShake(true); setError("Wrong PIN");
          setTimeout(() => { setPin(""); setShake(false); setError(""); }, 800);
        }
      }, 150);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0703", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 56, marginBottom: 12 }}>🍺</div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900, color: "#C8923A", margin: 0, marginBottom: 6 }}>The Mule Log</h1>
      <p style={{ color: "#5a4a32", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 40 }}>Who's drinking tonight?</p>
      {!selected ? (
        <div style={{ display: "flex", gap: 16 }}>
          {["Markus", "Anders"].map(name => (
            <button key={name} onClick={() => { setSelected(name); setPin(""); setError(""); }}
              style={{ background: "linear-gradient(135deg, #1a1208, #231a0d)", border: "2px solid #3a2e1a", borderRadius: 20, padding: "28px 36px", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#C8923A"; e.currentTarget.style.transform = "translateY(-4px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#3a2e1a"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>{name === "Markus" ? "🧔" : "👨"}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8d5b0", fontWeight: 700 }}>{name}</div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { setSelected(null); setPin(""); }} style={{ background: "none", border: "none", color: "#5a4a32", cursor: "pointer", fontSize: 20 }}>←</button>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#e8d5b0" }}>Hey {selected}! Enter your PIN</div>
          </div>
          <div style={{ display: "flex", gap: 16, animation: shake ? "shake 0.4s ease" : "none" }}>
            <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
            {[0,1,2,3].map(i => <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: i < pin.length ? "#C8923A" : "#2a1f0e", border: "2px solid", borderColor: i < pin.length ? "#C8923A" : "#3a2e1a", transition: "all 0.15s" }} />)}
          </div>
          {error && <div style={{ color: "#c87a7a", fontSize: 14 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d, i) => (
              <button key={i} onClick={() => d === "⌫" ? setPin(p => p.slice(0,-1)) : d !== "" && handlePin(String(d))} disabled={d === ""}
                style={{ width: 70, height: 70, borderRadius: 14, background: d === "" ? "transparent" : "#1a1208", border: d === "" ? "none" : "1px solid #3a2e1a", color: "#e8d5b0", fontSize: d === "⌫" ? 20 : 24, cursor: d === "" ? "default" : "pointer", fontFamily: "'Playfair Display', serif" }}
                onMouseEnter={e => { if (d !== "") e.currentTarget.style.background = "#2a1f0e"; }}
                onMouseLeave={e => { if (d !== "") e.currentTarget.style.background = "#1a1208"; }}>
                {d}
              </button>
            ))}
          </div>
          <div style={{ color: "#3a2e1a", fontSize: 12 }}>Default PIN is 1337</div>
        </div>
      )}
    </div>
  );
}

function StarRating({ value, onChange, size = 24 }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(s => {
        const full = display >= s, half = !full && display >= s - 0.5;
        return (
          <span key={s} onClick={() => onChange && onChange(s)} onMouseEnter={() => onChange && setHover(s)} onMouseLeave={() => onChange && setHover(0)}
            style={{ position: "relative", fontSize: size, cursor: onChange ? "pointer" : "default", lineHeight: 1, display: "inline-block" }}>
            <span style={{ color: "#3a2e22" }}>&#9733;</span>
            {(full || half) && <span style={{ position: "absolute", left: 0, top: 0, overflow: "hidden", width: full ? "100%" : "50%", color: "#C8923A" }}>&#9733;</span>}
          </span>
        );
      })}
    </div>
  );
}

function TastedByPicker({ value, onChange }) {
  const options = [{ key: "both", label: "Both", icon: "🧔👨" }, { key: "Markus", label: "Markus", icon: "🧔" }, { key: "Anders", label: "Anders", icon: "👨" }];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)}
          style={{ flex: 1, background: value === o.key ? "#2a1a06" : "#0f0b06", border: `2px solid ${value === o.key ? "#C8923A" : "#3a2e1a"}`, borderRadius: 12, padding: "10px 6px", cursor: "pointer", textAlign: "center" }}>
          <div style={{ fontSize: 20 }}>{o.icon}</div>
          <div style={{ color: value === o.key ? "#C8923A" : "#5a4a32", fontSize: 11, marginTop: 4, fontWeight: value === o.key ? 700 : 400 }}>{o.label}</div>
        </button>
      ))}
    </div>
  );
}

function MuleCard({ mule, onClick }) {
  const avg = getAvg(mule);
  const tastedBy = Array.isArray(mule.tastedBy) ? mule.tastedBy : mule.tastedBy ? [mule.tastedBy] : [];
  const bothTasted = tastedBy.length === 2 || tastedBy.includes("both");
  return (
    <div onClick={() => onClick(mule)}
      style={{ background: "linear-gradient(135deg, #1a1208 0%, #231a0d 100%)", border: "1px solid #3a2e1a", borderRadius: 16, overflow: "hidden", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(200,146,58,0.2)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)"; }}>
      <div style={{ position: "relative", height: 180, background: "#0f0b06", overflow: "hidden" }}>
        {mule.image ? <img src={mule.image} alt={mule.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🍺</div>}
        <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 10px", fontSize: 13, border: "1px solid #3a2e1a" }}>
          {bothTasted ? "🧔👨" : tastedBy.includes("Markus") ? "🧔" : "👨"}
        </div>
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 10px", color: "#5a4a32", fontSize: 11, border: "1px solid #3a2e1a" }}>
          {mule.addedBy}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#e8d5b0", fontWeight: 700, marginBottom: 4 }}>{mule.name}</div>
        <div style={{ color: "#7a6a52", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          📍 {mule.location || "Unknown"}
          {mule.lat && <a href={`https://www.google.com/maps?q=${mule.lat},${mule.lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: "#C8923A", fontSize: 11, marginLeft: 4 }}>View map →</a>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StarRating value={avg} size={18} />
            <span style={{ color: "#C8923A", fontSize: 13, fontWeight: 700 }}>{fmtAvg(avg)}</span>
          </div>
          <div style={{ color: "#5a7a5a", fontSize: 12, fontStyle: "italic" }}>{mule.price ? `${mule.price} SEK` : ""}</div>
        </div>
        {mule.tags && mule.tags.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {mule.tags.map(t => <span key={t} style={{ background: "#2a1f0e", color: "#C8923A", fontSize: 11, padding: "2px 8px", borderRadius: 10, border: "1px solid #3a2a12" }}>{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({ mule, onClose, onDelete }) {
  if (!mule) return null;
  const avg = getAvg(mule);
  const tastedBy = Array.isArray(mule.tastedBy) ? mule.tastedBy : mule.tastedBy ? [mule.tastedBy] : [];
  const bothTasted = tastedBy.length === 2 || tastedBy.includes("both");
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(135deg, #1a1208 0%, #231a0d 100%)", border: "1px solid #3a2e1a", borderRadius: 20, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.8)" }}>
        {mule.image && <div style={{ height: 260, overflow: "hidden", borderRadius: "20px 20px 0 0" }}><img src={mule.image} alt={mule.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
        <div style={{ padding: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#e8d5b0", fontWeight: 700, marginBottom: 8 }}>{mule.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <StarRating value={avg} size={22} />
            <span style={{ color: "#C8923A", fontWeight: 700, fontSize: 18 }}>{fmtAvg(avg)}/5</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Location", value: mule.location || "—" },
              { label: "Date", value: mule.date ? new Date(mule.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—" },
              { label: "Tasted by", value: bothTasted ? "🧔 Markus & 👨 Anders" : tastedBy.includes("Markus") ? "🧔 Markus" : "👨 Anders" },
              { label: "Logged by", value: mule.addedBy || "—" },
              mule.price && { label: "Price", value: `💰 ${mule.price} SEK` },
              (mule.ratingTaste != null && mule.ratingLooks != null) && { label: "Taste / Looks", value: `👅 ${mule.ratingTaste}/5  👁️ ${mule.ratingLooks}/5` },
            ].filter(Boolean).map(item => (
              <div key={item.label} style={{ background: "#0f0b06", borderRadius: 10, padding: 12, border: "1px solid #2a1f0e" }}>
                <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
                <div style={{ color: "#e8d5b0", fontSize: 14, marginTop: 4 }}>{item.value}</div>
              </div>
            ))}
          </div>
          {mule.lat && (
            <a href={`https://www.google.com/maps?q=${mule.lat},${mule.lng}`} target="_blank" rel="noreferrer"
              style={{ display: "block", background: "#0f0b06", border: "1px solid #2a1f0e", borderRadius: 10, padding: 12, color: "#C8923A", textDecoration: "none", textAlign: "center", fontSize: 14, marginBottom: 16 }}>
              🗺️ Open in Google Maps
            </a>
          )}
          {mule.notes && (
            <div style={{ background: "#0f0b06", borderRadius: 10, padding: 16, marginBottom: 16, border: "1px solid #2a1f0e" }}>
              <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Notes</div>
              <div style={{ color: "#c8b89a", fontSize: 14, lineHeight: 1.6 }}>{mule.notes}</div>
            </div>
          )}
          {mule.tags && mule.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {mule.tags.map(t => <span key={t} style={{ background: "#2a1f0e", color: "#C8923A", fontSize: 12, padding: "4px 12px", borderRadius: 12, border: "1px solid #3a2a12" }}>{t}</span>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid #3a2e1a", color: "#7a6a52", borderRadius: 10, padding: 10, cursor: "pointer", fontSize: 14 }}>Close</button>
            <button onClick={() => { onDelete(mule.id); onClose(); }} style={{ background: "#3a1010", border: "1px solid #5a2020", color: "#c87a7a", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddMuleForm({ onSave, onClose, currentUser }) {
  const [form, setForm] = useState({ name: "", location: "", ratingTaste: 3, ratingLooks: 3, date: new Date().toISOString().split("T")[0], notes: "", tags: [], image: null, price: "", tastedBy: "both", lat: null, lng: null });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const fileRef = useRef();
  const TAGS = ["Spicy", "Smoky", "Classic", "Fruity", "Strong", "Weak", "Sweet", "Sour", "Fancy", "Dive bar"];
  const inputStyle = { width: "100%", background: "#0f0b06", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 14px", color: "#e8d5b0", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "block" };

  const handleImage = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = evt => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800; let w = img.width, h = img.height;
        if (w > h && w > MAX) { h = h * MAX / w; w = MAX; } else if (h > MAX) { w = w * MAX / h; h = MAX; }
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        setForm(p => ({ ...p, image: canvas.toDataURL("image/jpeg", 0.7) }));
      };
      img.src = evt.target.result;
    };
    r.readAsDataURL(f);
  };

  const addTag = tag => { if (!tag.trim() || form.tags.includes(tag.trim())) return; setForm(f => ({ ...f, tags: [...f.tags, tag.trim()] })); setTagInput(""); };
  const handleSubmit = async () => {
    if (!form.name || !form.location) return alert("Name and location are required!");
    setSaving(true);
    const tastedByArr = form.tastedBy === "both" ? ["Markus", "Anders"] : [form.tastedBy];
    await onSave({ ...form, rating: (form.ratingTaste + form.ratingLooks) / 2, addedBy: currentUser, tastedBy: tastedByArr });
    setSaving(false);
  };

  return (
    <>
      {showMap && <MapPicker onSelect={pin => { setForm(f => ({ ...f, location: pin.location, lat: pin.lat, lng: pin.lng })); setShowMap(false); }} onClose={() => setShowMap(false)} />}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(4px)" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(135deg, #1a1208 0%, #231a0d 100%)", border: "1px solid #3a2e1a", borderRadius: 20, maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.8)", padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#C8923A" }}>🍺 Log a New Mule</div>
            <div style={{ color: "#5a4a32", fontSize: 13 }}>as <span style={{ color: "#C8923A", fontWeight: 700 }}>{currentUser}</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={labelStyle}>Bar / Drink Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Copper Mule at The Alchemist" /></div>

            {/* Location with map pin */}
            <div>
              <label style={labelStyle}>Location *</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value, lat: null, lng: null }))} placeholder="e.g. New York, NY" />
                <button onClick={() => setShowMap(true)} style={{ background: form.lat ? "#2a1a06" : "#0f0b06", border: `1px solid ${form.lat ? "#C8923A" : "#3a2e1a"}`, borderRadius: 10, padding: "0 14px", color: form.lat ? "#C8923A" : "#7a6a52", cursor: "pointer", fontSize: 18, whiteSpace: "nowrap" }}>
                  {form.lat ? "📍✓" : "📍"}
                </button>
              </div>
              {form.lat && <div style={{ color: "#5a4a32", fontSize: 11, marginTop: 4 }}>Pin set ✓ — coords saved</div>}
            </div>

            <div><label style={labelStyle}>Date</label><input style={inputStyle} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label style={labelStyle}>Who tasted it?</label><TastedByPicker value={form.tastedBy} onChange={v => setForm(f => ({ ...f, tastedBy: v }))} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={labelStyle}>Taste 👅</label><StarRating value={form.ratingTaste} onChange={r => setForm(f => ({ ...f, ratingTaste: r }))} size={24} /></div>
              <div><label style={labelStyle}>Looks 👁️</label><StarRating value={form.ratingLooks} onChange={r => setForm(f => ({ ...f, ratingLooks: r }))} size={24} /></div>
            </div>
            <div style={{ background: "#0f0b06", borderRadius: 10, padding: "10px 14px", border: "1px solid #2a1f0e", textAlign: "center" }}>
              <span style={{ color: "#5a4a32", fontSize: 12 }}>Overall: </span>
              <span style={{ color: "#C8923A", fontWeight: 700, fontSize: 16 }}>{fmtAvg((form.ratingTaste + form.ratingLooks) / 2)} / 5</span>
            </div>
            <div><label style={labelStyle}>Price (SEK)</label><input style={inputStyle} type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 150" /></div>
            <div>
              <label style={labelStyle}>Photo</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
              <button onClick={() => fileRef.current.click()} style={{ background: "#0f0b06", border: "1px dashed #3a2e1a", borderRadius: 10, padding: "10px 20px", color: "#7a6a52", cursor: "pointer", fontSize: 14, width: "100%" }}>
                {form.image ? "✅ Photo added — click to change" : "📷 Upload a photo"}
              </button>
            </div>
            <div>
              <label style={labelStyle}>Tags</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {TAGS.map(t => <button key={t} onClick={() => addTag(t)} style={{ background: form.tags.includes(t) ? "#C8923A" : "#0f0b06", color: form.tags.includes(t) ? "#0f0b06" : "#7a6a52", border: "1px solid #3a2e1a", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>{t}</button>)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag(tagInput)} placeholder="Custom tag..." />
                <button onClick={() => addTag(tagInput)} style={{ background: "#2a1f0e", border: "1px solid #3a2e1a", color: "#C8923A", borderRadius: 10, padding: "0 16px", cursor: "pointer" }}>+</button>
              </div>
              {form.tags.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>{form.tags.map(t => <span key={t} onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))} style={{ background: "#2a1f0e", color: "#C8923A", fontSize: 12, padding: "3px 10px", borderRadius: 10, border: "1px solid #3a2a12", cursor: "pointer" }}>{t} x</span>)}</div>}
            </div>
            <div><label style={labelStyle}>Notes</label><textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Was the ginger beer fresh? Copper mug or not?" /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid #3a2e1a", color: "#7a6a52", borderRadius: 10, padding: 12, cursor: "pointer", fontSize: 14 }}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, background: saving ? "#5a4a32" : "linear-gradient(135deg, #C8923A, #a06820)", border: "none", color: "#0f0b06", borderRadius: 10, padding: 12, cursor: saving ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>
              {saving ? "Saving..." : "Save Mule 🍺"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [mules, setMules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filterTag, setFilterTag] = useState("");
  const [filterWho, setFilterWho] = useState("");

  const load = async () => {
    try { setError(null); const rows = await dbGetAll(); setMules(rows.map(rowToMule)); }
    catch (e) { setError("Could not connect to database."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  const addMule = async mule => { await dbInsert(mule); await load(); setShowAdd(false); };
  const deleteMule = async id => { await dbDelete(id); setMules(p => p.filter(m => m.id !== id)); };

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;

  const allTags = [...new Set(mules.flatMap(m => m.tags || []))];
  const filtered = mules
    .filter(m => { const q = search.toLowerCase(); return !q || m.name?.toLowerCase().includes(q) || m.location?.toLowerCase().includes(q); })
    .filter(m => !filterTag || m.tags?.includes(filterTag))
    .filter(m => { if (!filterWho) return true; const tb = Array.isArray(m.tastedBy) ? m.tastedBy : [m.tastedBy]; return tb.includes(filterWho) || tb.includes("both"); })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "rating-high") return getAvg(b) - getAvg(a);
      if (sortBy === "rating-low") return getAvg(a) - getAvg(b);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price-low") return (a.price || 999) - (b.price || 999);
      if (sortBy === "price-high") return (b.price || 0) - (a.price || 0);
      return 0;
    });

  const avgRating = mules.length ? fmtAvg(mules.reduce((s, m) => s + getAvg(m), 0) / mules.length) : "—";
  const cities = new Set(mules.map(m => m.location?.split(",")[0]?.trim()).filter(Boolean));

  return (
    <div style={{ minHeight: "100vh", background: "#0a0703", fontFamily: "'Georgia', serif", color: "#e8d5b0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />
      <div style={{ background: "linear-gradient(180deg, #1a1006 0%, #0a0703 100%)", borderBottom: "1px solid #2a1f0e", padding: "32px 24px 24px", textAlign: "center", position: "relative" }}>
        <button onClick={() => setCurrentUser(null)} style={{ position: "absolute", top: 16, right: 16, background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "6px 14px", color: "#5a4a32", cursor: "pointer", fontSize: 13 }}>
          {currentUser === "Markus" ? "🧔" : "👨"} {currentUser} · Log out
        </button>
        <div style={{ fontSize: 44, marginBottom: 6 }}>🫚🍋🍺</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 5vw, 46px)", fontWeight: 900, color: "#C8923A", margin: 0, lineHeight: 1 }}>The Mule Log</h1>
        <p style={{ color: "#5a4a32", marginTop: 6, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>Anders &amp; Markus — on a quest for the perfect Moscow Mule</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 20, flexWrap: "wrap" }}>
          {[{ label: "Mules Tried", value: mules.length }, { label: "Avg Rating", value: avgRating }, { label: "Cities", value: cities.size || "—" }].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: "#C8923A" }}>{s.value}</div>
              <div style={{ color: "#5a4a32", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px 24px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", maxWidth: 1100, margin: "0 auto" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." style={{ flex: "1 1 180px", background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 16px", color: "#e8d5b0", fontSize: 14, outline: "none" }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 12px", color: "#e8d5b0", fontSize: 13, cursor: "pointer" }}>
          <option value="newest">Newest</option><option value="oldest">Oldest</option>
          <option value="rating-high">Top Rated</option><option value="rating-low">Lowest Rated</option>
          <option value="name">A-Z</option><option value="price-low">Cheapest</option><option value="price-high">Priciest</option>
        </select>
        <select value={filterWho} onChange={e => setFilterWho(e.target.value)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 12px", color: "#e8d5b0", fontSize: 13, cursor: "pointer" }}>
          <option value="">Everyone's mules</option><option value="Markus">🧔 Markus</option><option value="Anders">👨 Anders</option>
        </select>
        {allTags.length > 0 && <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 12px", color: "#e8d5b0", fontSize: 13, cursor: "pointer" }}><option value="">All Tags</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select>}
        <button onClick={() => setShowAdd(true)} style={{ background: "linear-gradient(135deg, #C8923A, #a06820)", border: "none", color: "#0f0b06", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "'Playfair Display', serif" }}>+ Log a Mule</button>
      </div>
      <div style={{ padding: "0 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
        {loading ? <div style={{ textAlign: "center", color: "#5a4a32", padding: 60, fontSize: 18 }}>Loading your mules...</div>
          : error ? <div style={{ textAlign: "center", padding: 60 }}><div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div><div style={{ color: "#c87a7a" }}>{error}</div></div>
          : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🍺</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#5a4a32" }}>{mules.length === 0 ? "No mules logged yet — go drink some!" : "No mules match your filters"}</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
              {filtered.map(mule => <MuleCard key={mule.id} mule={mule} onClick={setSelected} />)}
            </div>
          )}
      </div>
      {showAdd && <AddMuleForm onSave={addMule} onClose={() => setShowAdd(false)} currentUser={currentUser} />}
      {selected && <Modal mule={selected} onClose={() => setSelected(null)} onDelete={deleteMule} />}
    </div>
  );
}
