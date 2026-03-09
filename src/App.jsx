import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://aqxfhfivulakvyfhfuxd.supabase.co";
const GOOGLE_KEY = "AIzaSyAF5TBYdp44LkdpzYE8524GRu1syGvicYQ";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxeGZoZml2dWxha3Z5ZmhmdXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzkzNjIsImV4cCI6MjA4ODE1NTM2Mn0.1j3E5o_nyb61sRSNvdhofRPpeWaKvrnCDhXe7yuxqK0";
const USERS = { Markus: "1337", Anders: "1337" };

// ── City normalization ───────────────────────────────────────────────────────
function normalizeCity(city) {
  if (!city) return "";
  return city.trim()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents: á→a, ö→o etc
    .replace(/[^a-z0-9\s]/g, "") // remove special chars
    .trim();
}
function displayCity(city) {
  if (!city) return "";
  // capitalize first letter of each word
  return city.trim().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Country flags ─────────────────────────────────────────────────────────────
const COUNTRY_FLAGS = {
  albania: "🇦🇱", sweden: "🇸🇪", uk: "🇬🇧", "united kingdom": "🇬🇧", england: "🇬🇧",
  france: "🇫🇷", germany: "🇩🇪", italy: "🇮🇹", spain: "🇪🇸", portugal: "🇵🇹",
  netherlands: "🇳🇱", belgium: "🇧🇪", austria: "🇦🇹", switzerland: "🇨🇭",
  norway: "🇳🇴", denmark: "🇩🇰", finland: "🇫🇮", poland: "🇵🇱",
  croatia: "🇭🇷", serbia: "🇷🇸", greece: "🇬🇷", turkey: "🇹🇷",
  usa: "🇺🇸", "united states": "🇺🇸", canada: "🇨🇦", australia: "🇦🇺",
  japan: "🇯🇵", thailand: "🇹🇭", montenegro: "🇲🇪", "north macedonia": "🇲🇰",
  slovenia: "🇸🇮", czechia: "🇨🇿", hungary: "🇭🇺", romania: "🇷🇴",
  bulgaria: "🇧🇬", ukraine: "🇺🇦", russia: "🇷🇺", estonia: "🇪🇪",
  latvia: "🇱🇻", lithuania: "🇱🇹", ireland: "🇮🇪", scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  morocco: "🇲🇦", egypt: "🇪🇬", mexico: "🇲🇽", brazil: "🇧🇷",
  argentina: "🇦🇷", chile: "🇨🇱", colombia: "🇨🇴",
};
function getFlag(mule) {
  const loc = (mule.city || mule.location || "").toLowerCase();
  for (const [country, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (loc.includes(country)) return flag;
  }
  return "🌍";
}

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
      price: mule.price ? parseInt(mule.price) : null,
      image: (mule.images && mule.images.length > 0) ? mule.images[0] : null,
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbUpdate(id, mule) {
  const body = {
    name: mule.name, location: mule.location, date: mule.date || null,
    rating: mule.rating, rating_taste: mule.ratingTaste, rating_looks: mule.ratingLooks,
    added_by: mule.addedBy, notes: mule.notes, tags: mule.tags,
    price: mule.price ? parseInt(mule.price) : null,
  };
  if (mule.imageChanged) body.image = (mule.images && mule.images.length > 0) ? mule.images[0] : null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mules?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : {};
}
async function dbDelete(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mules?id=eq.${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(await res.text());
}

function rowToMule(row) {
  return {
    id: row.id, name: row.name, location: row.location, date: row.date,
    rating: row.rating, ratingTaste: row.rating_taste, ratingLooks: row.rating_looks,
    addedBy: row.added_by,
    tastedBy: (() => {
      if (Array.isArray(row.tasted_by) && row.tasted_by.length > 0) return row.tasted_by;
      if (row.tasted_by) return [row.tasted_by];
      // fallback: parse from notes
      const m = (row.notes || '').match(/\[tasted:([^\]]+)\]/);
      if (m) return m[1].split(',');
      return [];
    })(),
    notes: (row.notes || '').replace(/\[tasted:[^\]]+\]\s?/, '').replace(/\[city:[^\]]+\]\s?/, '').replace(/\[imgs:[^\]]+\]\s?/, ''),
    city: (() => { const m = (row.notes || '').match(/\[city:([^\]]+)\]/); return m ? m[1] : (row.location || '').split('|')[1]?.trim() || ''; })(),
    images: (() => { const m = (row.notes || '').match(/\[imgs:([^\]]+)\]/); const extra = m ? m[1].split('|||') : []; return row.image ? [row.image, ...extra] : extra; })(),
    tags: row.tags || [], price: row.price,
    image: row.image, createdAt: row.created_at, lat: row.lat, lng: row.lng,
  };
}

function getAvg(mule) {
  if (mule.ratingTaste != null && mule.ratingLooks != null) return (mule.ratingTaste + mule.ratingLooks) / 2;
  return mule.rating || 0;
}
function fmtAvg(v) { return v % 1 === 0 ? String(v) : v.toFixed(1); }

// Value score: rating quality per SEK spent. 100 SEK baseline.
function getValueScore(mule) {
  const avg = getAvg(mule);
  if (!mule.price || mule.price <= 0) return null;
  return (avg / 5) * (100 / mule.price) * 5;
}
function fmtValue(v) { return v == null ? "—" : v.toFixed(2); }

function getTastedLabel(tastedBy) {
  const tb = Array.isArray(tastedBy) ? tastedBy : tastedBy ? [tastedBy] : [];
  const both = tb.length >= 2 || tb.includes("both");
  if (both) return { badge: "🧔👨", full: "🧔 Markus & 👨 Anders" };
  if (tb.includes("Markus")) return { badge: "🧔", full: "🧔 Markus" };
  if (tb.includes("Anders")) return { badge: "👨", full: "👨 Anders" };
  return { badge: "?", full: "Unknown" };
}

// ── Logo SVG ──────────────────────────────────────────────────────────────────
function MuleLogo({ size = 60 }) {
  const s = size / 200;
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M55 60 L55 160 Q55 175 70 175 L130 175 Q145 175 145 160 L145 60 Z" fill="none" stroke="#C8923A" strokeWidth="2.5"/>
      <path d="M48 175 L152 175" stroke="#C8923A" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M48 60 L152 60" stroke="#C8923A" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M145 80 Q185 75 188 100 Q190 125 175 135 Q162 142 145 138" stroke="#C8923A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M145 138 Q155 150 148 162" stroke="#C8923A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M148 162 Q155 168 162 162" stroke="#C8923A" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <g transform="translate(72, 85)">
        <path d="M0 40 Q5 15 25 10 Q45 5 55 20 Q65 35 55 50 Q45 60 25 58 Q5 56 0 40 Z" fill="#C8923A" fillOpacity="0.15" stroke="#C8923A" strokeWidth="1.5"/>
        <path d="M40 10 L38 -5 L48 8 Z" fill="none" stroke="#C8923A" strokeWidth="1.5"/>
        <circle cx="42" cy="28" r="3" fill="none" stroke="#C8923A" strokeWidth="1.5"/>
        <path d="M52 38 Q55 36 57 38" stroke="#C8923A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </g>
      <circle cx="85" cy="100" r="3" fill="#C8923A" fillOpacity="0.4"/>
      <circle cx="100" cy="115" r="2" fill="#C8923A" fillOpacity="0.3"/>
      <circle cx="115" cy="95" r="2.5" fill="#C8923A" fillOpacity="0.35"/>
      <circle cx="95" cy="130" r="2" fill="#C8923A" fillOpacity="0.25"/>
    </svg>
  );
}

// ── Star Rating ───────────────────────────────────────────────────────────────
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

// ── Tasted By Picker ──────────────────────────────────────────────────────────
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

// ── Map View ──────────────────────────────────────────────────────────────────
function MapView({ mules, onSelectMule }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    const init = () => {
      if (mapInstanceRef.current) return;
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 48, lng: 15 }, zoom: 4,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a1208" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#C8923A" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0a0703" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0f1a" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a1f0e" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#3a2e1a" }] },
          { featureType: "poi", stylers: [{ visibility: "off" }] },
          { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3a2e1a" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0f0b06" }] },
        ]
      });
      mapInstanceRef.current = map;

      mules.forEach(async mule => {
        if (!mule.location && !mule.city) return;
        try {
          let lat, lng;
          if (mule.lat && mule.lng) {
            lat = mule.lat; lng = mule.lng;
          } else {
            const searchQ = mule.city || mule.location;
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQ)}&format=json&limit=1`);
            const data = await res.json();
            if (!data[0]) return;
            lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon);
            fetch(`${SUPABASE_URL}/rest/v1/mules?id=eq.${mule.id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ lat, lng }) }).catch(() => {});
          }
          const avg = getAvg(mule);
          const color = avg >= 4 ? '#C8923A' : avg >= 3 ? '#8a8a20' : '#c85050';
          const svgMug = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
            <rect x="6" y="8" width="18" height="22" rx="3" fill="${color}" stroke="white" stroke-width="1.5"/>
            <rect x="5" y="8" width="20" height="4" rx="2" fill="${color}" stroke="white" stroke-width="1"/>
            <path d="M24 13 Q31 13 31 19 Q31 25 24 25" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <line x1="11" y1="14" x2="11" y2="28" stroke="white" stroke-width="0.7" opacity="0.3"/>
            <line x1="15" y1="14" x2="15" y2="28" stroke="white" stroke-width="0.7" opacity="0.3"/>
          </svg>`;
          const marker = new window.google.maps.Marker({
            position: { lat, lng }, map,
            icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgMug), scaledSize: new window.google.maps.Size(36, 36), anchor: new window.google.maps.Point(18, 18) },
            title: mule.name
          });
          const infoWindow = new window.google.maps.InfoWindow({
            content: `<div style="font-family:Georgia,serif;padding:4px;min-width:140px"><b>${mule.name}</b><br><span style="color:#888;font-size:12px">📍 ${mule.city || mule.location}</span><br><span style="color:#C8923A;font-weight:bold">⭐ ${fmtAvg(avg)}/5</span>${mule.price ? `<br><span style="font-size:12px">💰 ${mule.price} SEK</span>` : ''}</div>`
          });
          marker.addListener('click', () => { infoWindow.open(map, marker); onSelectMule(mule); });
        } catch(e) {}
      });
    };

    if (window.google && window.google.maps) { init(); }
    else {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
      s.onload = init; document.head.appendChild(s);
    }
    return () => { mapInstanceRef.current = null; };
  }, [mules]);

  return (
    <div style={{ padding: "0 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #2a1f0e", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: "#C8923A" }}>🗺️ Mule Map</div>
          <div style={{ color: "#5a4a32", fontSize: 12 }}>{mules.length} mules — tap a pin to see details</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 11, color: "#5a4a32" }}>
            <span>🟠 Great (4+)</span><span>🟡 OK (3+)</span><span>🔴 Weak</span>
          </div>
        </div>
        <div ref={mapRef} style={{ height: "calc(100vh - 320px)", minHeight: 400 }} />
      </div>
    </div>
  );
}

// ── Map Picker ────────────────────────────────────────────────────────────────
function MapPicker({ onSelect, onClose }) {
  const [pin, setPin] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const searchBoxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const loadMap = () => {
      if (mapInstanceRef.current) return;
      const google = window.google;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 48, lng: 15 }, zoom: 4,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a1208" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#C8923A" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0a0703" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0f1a" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a1f0e" }] },
          { featureType: "poi", stylers: [{ visibility: "simplified" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0f0b06" }] },
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      mapInstanceRef.current = map;

      // Google Places Autocomplete on the search input
      const searchBox = new google.maps.places.SearchBox(inputRef.current);
      searchBoxRef.current = searchBox;
      map.addListener("bounds_changed", () => searchBox.setBounds(map.getBounds()));

      searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();
        if (!places || places.length === 0) return;
        const place = places[0];
        if (!place.geometry) return;
        if (markerRef.current) markerRef.current.setMap(null);
        markerRef.current = new google.maps.Marker({ position: place.geometry.location, map });
        map.setCenter(place.geometry.location);
        map.setZoom(16);
        const city = extractCity(place.address_components || []);
        const loc = place.name || place.formatted_address?.split(",").slice(0,2).join(", ") || "";
        setPin({ location: loc, city });
      });

      // Click on map to drop pin
      map.addListener("click", async (e) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        if (markerRef.current) markerRef.current.setMap(null);
        markerRef.current = new google.maps.Marker({ position: { lat, lng }, map });
        // Reverse geocode with Google
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === "OK" && results[0]) {
            const city = extractCity(results[0].address_components || []);
            const loc = results[0].address_components?.slice(0,2).map(c=>c.long_name).join(", ") || results[0].formatted_address?.split(",").slice(0,2).join(", ") || "";
            setPin({ location: loc, city });
            if (inputRef.current) inputRef.current.value = results[0].formatted_address?.split(",").slice(0,2).join(", ") || "";
          }
        });
      });

      // Try get user location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          map.setCenter({ lat, lng });
          map.setZoom(13);
        }, () => {});
      }
    };

    const loadScript = () => {
      if (window.google && window.google.maps && window.google.maps.places) { loadMap(); return; }
      if (document.getElementById("gmaps-script")) {
        document.getElementById("gmaps-script").addEventListener("load", loadMap);
        return;
      }
      const s = document.createElement("script");
      s.id = "gmaps-script";
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`;
      s.onload = loadMap;
      document.head.appendChild(s);
    };
    loadScript();
    return () => { mapInstanceRef.current = null; };
  }, []);

  function extractCity(components) {
    const types = ["locality", "postal_town", "administrative_area_level_2", "administrative_area_level_1"];
    for (const t of types) {
      const c = components.find(c => c.types.includes(t));
      if (c) return c.long_name;
    }
    return "";
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 20, margin: 16, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", maxHeight: "90vh" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #2a1f0e", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: "#C8923A", fontSize: 16 }}>📍</div>
          <input ref={inputRef} type="text" placeholder="Search for a bar or city..." defaultValue=""
            style={{ flex: 1, background: "#0f0b06", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 14px", color: "#e8d5b0", fontSize: 15, outline: "none" }} />
        </div>
        <div ref={mapRef} style={{ flex: 1, minHeight: 300 }} />
        <div style={{ padding: 12, borderTop: "1px solid #2a1f0e" }}>
          {pin ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#e8d5b0", fontSize: 14, fontWeight: 700 }}>{pin.city || pin.location}</div>
                {pin.location && pin.city && <div style={{ color: "#5a4a32", fontSize: 12 }}>{pin.location}</div>}
              </div>
              <button onClick={() => onSelect(pin)} style={{ background: "linear-gradient(135deg, #C8923A, #a06820)", border: "none", color: "#0f0b06", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer" }}>Use this location</button>
            </div>
          ) : (
            <div style={{ color: "#5a4a32", fontSize: 13, textAlign: "center" }}>Search or tap the map to drop a pin</div>
          )}
          <button onClick={onClose} style={{ width: "100%", marginTop: 8, background: "transparent", border: "1px solid #3a2e1a", color: "#5a4a32", borderRadius: 10, padding: 10, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const handlePin = (digit) => {
    if (pin.length >= 4) return;
    const next = pin + digit; setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (USERS[selected] === next) { onLogin(selected); }
        else { setShake(true); setError("Wrong PIN"); setTimeout(() => { setPin(""); setShake(false); setError(""); }, 800); }
      }, 150);
    }
  };
  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a0703", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <MuleLogo size={80} />
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: "#C8923A", margin: "12px 0 4px" }}>The Mule Hunt</h1>
      <p style={{ color: "#5a4a32", fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginBottom: 40 }}>Who's drinking tonight?</p>
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#e8d5b0" }}>Hey {selected}! Enter your PIN</div>
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

        </div>
      )}
    </div>
  );
}

// ── Mule Card ─────────────────────────────────────────────────────────────────
function MuleCard({ mule, onClick }) {
  const avg = getAvg(mule);
  const tasted = getTastedLabel(mule.tastedBy);
  const valueScore = getValueScore(mule);
  return (
    <div onClick={() => onClick(mule)}
      style={{ background: "linear-gradient(135deg, #1a1208 0%, #231a0d 100%)", border: "1px solid #3a2e1a", borderRadius: 16, overflow: "hidden", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(200,146,58,0.2)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)"; }}>
      <div style={{ position: "relative", height: 180, background: "#0f0b06", overflow: "hidden" }}>
        {(mule.images && mule.images[0]) || mule.image ? <img src={(mule.images && mule.images[0]) || mule.image} alt={mule.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>🍺</div>}
        <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 10px", fontSize: 14, border: "1px solid #3a2e1a" }}>
          {tasted.badge}
        </div>
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 10px", color: "#5a4a32", fontSize: 11, border: "1px solid #3a2e1a" }}>
          {mule.addedBy}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#e8d5b0", fontWeight: 700, marginBottom: 4 }}>{mule.name}</div>
        <div style={{ color: "#7a6a52", fontSize: 13, marginBottom: 10 }}>{getFlag(mule)} {mule.city || mule.location || "Unknown"}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StarRating value={avg} size={18} />
            <span style={{ color: "#C8923A", fontSize: 13, fontWeight: 700 }}>{fmtAvg(avg)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {mule.price && <div style={{ color: "#5a7a5a", fontSize: 12, fontStyle: "italic" }}>{mule.price} SEK</div>}
            {valueScore != null && (
              <div style={{ background: "#0f2010", border: "1px solid #1a4020", borderRadius: 8, padding: "2px 7px", fontSize: 11, color: "#6aaa6a" }}>
                💚 {fmtValue(valueScore)}
              </div>
            )}
          </div>
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

// ── Image Gallery ────────────────────────────────────────────────────────────
function ImageGallery({ images, name }) {
  const [idx, setIdx] = useState(0);
  return (
    <div style={{ position: "relative", height: 260, overflow: "hidden" }}>
      <img src={images[idx]} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {idx > 0 && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i - 1); }}
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
      )}
      {idx < images.length - 1 && (
        <button onClick={e => { e.stopPropagation(); setIdx(i => i + 1); }}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
      )}
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
        {images.map((_, i) => (
          <div key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? "#C8923A" : "rgba(255,255,255,0.5)", cursor: "pointer" }} />
        ))}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ mule, onClose, onDelete, onEdit }) {
  if (!mule) return null;
  const avg = getAvg(mule);
  const tasted = getTastedLabel(mule.tastedBy);
  const valueScore = getValueScore(mule);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(135deg, #1a1208 0%, #231a0d 100%)", border: "1px solid #3a2e1a", borderRadius: 20, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.8)" }}>
        {((mule.images && mule.images.length > 0) || mule.image) && (
          <div style={{ borderRadius: "20px 20px 0 0", overflow: "hidden" }}>
            {mule.images && mule.images.length > 1 ? (
              <ImageGallery images={mule.images} name={mule.name} />
            ) : (
              <div style={{ height: 260 }}><img src={(mule.images && mule.images[0]) || mule.image} alt={mule.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
            )}
          </div>
        )}
        <div style={{ padding: 28 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#e8d5b0", fontWeight: 700, marginBottom: 8 }}>{mule.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <StarRating value={avg} size={22} />
            <span style={{ color: "#C8923A", fontWeight: 700, fontSize: 18 }}>{fmtAvg(avg)}/5</span>
            {valueScore != null && <span style={{ background: "#0f2010", border: "1px solid #1a4020", borderRadius: 10, padding: "4px 10px", color: "#6aaa6a", fontSize: 13 }}>💚 Value: {fmtValue(valueScore)}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Location", value: "📍 " + (mule.location || "—") },
              { label: "Date", value: mule.date ? new Date(mule.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—" },
              { label: "Tasted by", value: tasted.full },
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
            <button onClick={() => { onEdit(mule); onClose(); }} style={{ background: "#0f1a2a", border: "1px solid #203a5a", color: "#7aaac8", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>Edit ✏️</button>
            <button onClick={() => { onDelete(mule.id); onClose(); }} style={{ background: "#3a1010", border: "1px solid #5a2020", color: "#c87a7a", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Form ──────────────────────────────────────────────────────────────────
function AddMuleForm({ onSave, onClose, currentUser, knownCities = [], editMode = false, initialData = null }) {
  const [form, setForm] = useState(() => {
    if (initialData) {
      const tb = Array.isArray(initialData.tastedBy) ? initialData.tastedBy : [];
      const tastedBy = tb.length === 2 ? "both" : tb[0] || "both";
      return { name: initialData.name || "", location: initialData.location || "", city: initialData.city || "", ratingTaste: initialData.ratingTaste || 3, ratingLooks: initialData.ratingLooks || 3, date: initialData.date || new Date().toISOString().split("T")[0], notes: initialData.notes || "", tags: initialData.tags || [], images: initialData.images || (initialData.image ? [initialData.image] : []), price: initialData.price || "", tastedBy };
    }
    return { name: "", location: "", city: "", ratingTaste: 3, ratingLooks: 3, date: new Date().toISOString().split("T")[0], notes: "", tags: [], images: [], price: "", tastedBy: "both" };
  });
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
        const MAX = 600; let w = img.width, h = img.height;
        if (w > h && w > MAX) { h = h * MAX / w; w = MAX; } else if (h > MAX) { w = w * MAX / h; h = MAX; }
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.5);
        setForm(p => ({ ...p, images: [...(p.images || []), compressed], imageChanged: true }));
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
    const tastedNote = `[tasted:${tastedByArr.join(',')}]`;
    const cityNote = form.city ? `[city:${form.city}]` : '';
    const extraImgs = form.images && form.images.length > 1 ? form.images.slice(1) : [];
    const imgsNote = extraImgs.length > 0 ? `[imgs:${extraImgs.join('|||')}]` : '';
    const notesWithMeta = [tastedNote, cityNote, imgsNote, form.notes].filter(Boolean).join(' ');
    await onSave({ ...form, notes: notesWithMeta, rating: (form.ratingTaste + form.ratingLooks) / 2, addedBy: currentUser, tastedBy: tastedByArr });
    setSaving(false);
  };

  return (
    <>
      {showMap && <MapPicker onSelect={pin => { setForm(f => ({ ...f, location: pin.location, city: pin.city || f.city })); setShowMap(false); }} onClose={() => setShowMap(false)} />}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(4px)" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(135deg, #1a1208 0%, #231a0d 100%)", border: "1px solid #3a2e1a", borderRadius: 20, maxWidth: 500, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 80px rgba(0,0,0,0.8)", padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#C8923A" }}>{editMode ? '✏️ Edit Mule' : '🍺 Log a New Mule'}</div>
            <div style={{ color: "#5a4a32", fontSize: 12 }}>as <span style={{ color: "#C8923A", fontWeight: 700 }}>{currentUser}</span></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div><label style={labelStyle}>Bar / Drink Name *</label><input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Copper Mule at The Alchemist" /></div>
            <div>
              <label style={labelStyle}>Bar / Address</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. The Alchemist, King St" />
                <button onClick={() => setShowMap(true)} title="Drop a pin" style={{ background: form.location ? "#2a1a06" : "#0f0b06", border: `1px solid ${form.location ? "#C8923A" : "#3a2e1a"}`, borderRadius: 10, padding: "0 14px", color: form.location ? "#C8923A" : "#7a6a52", cursor: "pointer", fontSize: 18 }}>📍</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>City *</label>
              <input list="city-list" style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Tirana" />
              <datalist id="city-list">{knownCities.map(c => <option key={c} value={c} />)}</datalist>
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
              <label style={labelStyle}>Photos ({form.images ? form.images.length : 0}/5)</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} />
              {form.images && form.images.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  {form.images.map((img, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={img} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #3a2e1a" }} />
                      <button onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}
                        style={{ position: "absolute", top: -6, right: -6, background: "#c85050", border: "none", borderRadius: "50%", width: 18, height: 18, color: "#fff", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {(!form.images || form.images.length < 5) && (
                <button onClick={() => fileRef.current.click()} style={{ background: "#0f0b06", border: "1px dashed #3a2e1a", borderRadius: 10, padding: "10px 20px", color: "#7a6a52", cursor: "pointer", fontSize: 14, width: "100%" }}>
                  📷 {form.images && form.images.length > 0 ? "Add another photo" : "Upload a photo"}
                </button>
              )}
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
              {saving ? "Saving..." : editMode ? "Update Mule ✏️" : "Save Mule 🍺"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}



// ── Head to Head ──────────────────────────────────────────────────────────────
function HeadToHead({ mules, onClose }) {
  const [muleA, setMuleA] = useState(null);
  const [muleB, setMuleB] = useState(null);
  const [step, setStep] = useState("A"); // "A" | "B" | "result"

  const selectMule = (m) => {
    if (step === "A") { setMuleA(m); setStep("B"); }
    else if (step === "B" && m.id !== muleA.id) { setMuleB(m); setStep("result"); }
  };

  const CompareRow = ({ label, a, b, higher = "higher" }) => {
    const aWins = higher === "higher" ? a > b : a < b;
    const bWins = higher === "higher" ? b > a : b < a;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #2a1f0e" }}>
        <div style={{ flex: 1, textAlign: "right", color: aWins ? "#C8923A" : "#e8d5b0", fontWeight: aWins ? 700 : 400 }}>{a}{aWins ? " 👑" : ""}</div>
        <div style={{ width: 80, textAlign: "center", color: "#5a4a32", fontSize: 11, textTransform: "uppercase" }}>{label}</div>
        <div style={{ flex: 1, textAlign: "left", color: bWins ? "#C8923A" : "#e8d5b0", fontWeight: bWins ? 700 : 400 }}>{bWins ? "👑 " : ""}{b}</div>
      </div>
    );
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 20, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 24 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#C8923A", marginBottom: 4 }}>⚔️ Head to Head</div>
        {step !== "result" && <div style={{ color: "#5a4a32", fontSize: 13, marginBottom: 16 }}>Pick {step === "A" ? "the first" : "the second"} mule to compare</div>}
        {step !== "result" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
            {mules.filter(m => step === "B" ? m.id !== muleA?.id : true).map(m => (
              <div key={m.id} onClick={() => selectMule(m)} style={{ background: "#0f0b06", border: "1px solid #2a1f0e", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#C8923A"} onMouseLeave={e => e.currentTarget.style.borderColor = "#2a1f0e"}>
                {m.images && m.images[0] && <img src={m.images[0]} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e8d5b0", fontWeight: 700 }}>{m.name}</div>
                  <div style={{ color: "#5a4a32", fontSize: 12 }}>{getFlag(m)} {m.city || m.location}</div>
                </div>
                <div style={{ color: "#C8923A" }}>⭐ {fmtAvg(getAvg(m))}</div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {[muleA, muleB].map((m, i) => (
                <div key={i} style={{ flex: 1, background: "#0f0b06", borderRadius: 12, padding: 12, textAlign: "center", border: "1px solid #2a1f0e" }}>
                  {m.images && m.images[0] && <img src={m.images[0]} style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
                  <div style={{ color: "#e8d5b0", fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                  <div style={{ color: "#5a4a32", fontSize: 11 }}>{getFlag(m)} {m.city || m.location}</div>
                </div>
              ))}
            </div>
            <CompareRow label="Taste" a={muleA.ratingTaste || getAvg(muleA)} b={muleB.ratingTaste || getAvg(muleB)} />
            <CompareRow label="Looks" a={muleA.ratingLooks || getAvg(muleA)} b={muleB.ratingLooks || getAvg(muleB)} />
            <CompareRow label="Overall" a={fmtAvg(getAvg(muleA))} b={fmtAvg(getAvg(muleB))} />
            {muleA.price && muleB.price && <CompareRow label="Price SEK" a={muleA.price} b={muleB.price} higher="lower" />}
            {getValueScore(muleA) && getValueScore(muleB) && <CompareRow label="Value" a={fmtValue(getValueScore(muleA))} b={fmtValue(getValueScore(muleB))} />}
            <button onClick={() => { setStep("A"); setMuleA(null); setMuleB(null); }} style={{ width: "100%", marginTop: 16, background: "#2a1f0e", border: "1px solid #3a2e1a", color: "#C8923A", borderRadius: 10, padding: 12, cursor: "pointer" }}>Compare again ⚔️</button>
          </div>
        )}
        <button onClick={onClose} style={{ width: "100%", marginTop: 12, background: "transparent", border: "1px solid #3a2e1a", color: "#5a4a32", borderRadius: 10, padding: 10, cursor: "pointer" }}>Close</button>
      </div>
    </div>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function Leaderboard({ mules }) {
  const markusMules = mules.filter(m => m.tastedBy?.includes("Markus"));
  const andersMules = mules.filter(m => m.tastedBy?.includes("Anders"));
  const markusAvg = markusMules.length ? markusMules.reduce((s,m) => s + getAvg(m), 0) / markusMules.length : 0;
  const andersAvg = andersMules.length ? andersMules.reduce((s,m) => s + getAvg(m), 0) / andersMules.length : 0;
  const markusBest = markusMules.sort((a,b) => getAvg(b) - getAvg(a))[0];
  const andersBest = andersMules.sort((a,b) => getAvg(b) - getAvg(a))[0];
  const markusValue = markusMules.filter(m=>m.price).sort((a,b) => (getValueScore(b)||0) - (getValueScore(a)||0))[0];
  const andersValue = andersMules.filter(m=>m.price).sort((a,b) => (getValueScore(b)||0) - (getValueScore(a)||0))[0];
  const topMules = [...mules].sort((a,b) => getAvg(b) - getAvg(a)).slice(0, 5);
  const lcities = [...new Set(mules.map(m => normalizeCity(m.city).toLowerCase()).filter(Boolean))];
  const topCity = lcities.sort((a,b) => mules.filter(m => normalizeCity(m.city)===b).length - mules.filter(m => normalizeCity(m.city)===a).length)[0];
  const topCityDisplay = topCity ? displayCity(mules.find(m => normalizeCity(m.city)===topCity)?.city || topCity) : null;

  const statBox = (label, markusVal, andersVal, higher = "higher") => {
    const mWins = higher === "higher" ? markusVal > andersVal : markusVal < andersVal;
    const aWins = higher === "higher" ? andersVal > markusVal : andersVal < markusVal;
    return (
      <div style={{ background: "#0f0b06", borderRadius: 12, padding: 16, border: "1px solid #2a1f0e" }}>
        <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, textAlign: "center" }}>{label}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 28 }}>🧔</div>
            <div style={{ color: mWins ? "#C8923A" : "#e8d5b0", fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>{markusVal}{mWins ? " 👑" : ""}</div>
          </div>
          <div style={{ color: "#3a2e1a", fontSize: 20 }}>vs</div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 28 }}>👨</div>
            <div style={{ color: aWins ? "#C8923A" : "#e8d5b0", fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>{andersVal}{aWins ? " 👑" : ""}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "0 24px 60px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#C8923A", marginBottom: 20 }}>🏆 Leaderboard</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {statBox("Mules Tried", markusMules.length, andersMules.length)}
        {statBox("Avg Rating", fmtAvg(markusAvg), fmtAvg(andersAvg))}
      </div>
      <div style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>🥇 Top 5 Mules Ever</div>
        {topMules.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 4 ? "1px solid #2a1f0e" : "none" }}>
            <div style={{ color: i === 0 ? "#C8923A" : i === 1 ? "#8a8a8a" : i === 2 ? "#a06820" : "#5a4a32", fontSize: 18, fontWeight: 700, width: 24 }}>{i+1}</div>
            {m.images && m.images[0] && <img src={m.images[0]} style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />}
            <div style={{ flex: 1 }}>
              <div style={{ color: "#e8d5b0", fontSize: 15, fontWeight: 700 }}>{m.name}</div>
              <div style={{ color: "#5a4a32", fontSize: 12 }}>{getFlag(m)} {m.city || m.location}</div>
            </div>
            <div style={{ color: "#C8923A", fontWeight: 700 }}>⭐ {fmtAvg(getAvg(m))}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 16, padding: 16 }}>
          <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🧔 Markus Best Find</div>
          {markusBest && <><div style={{ color: "#e8d5b0", fontWeight: 700 }}>{markusBest.name}</div><div style={{ color: "#C8923A" }}>⭐ {fmtAvg(getAvg(markusBest))}</div></>}
        </div>
        <div style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 16, padding: 16 }}>
          <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>👨 Anders Best Find</div>
          {andersBest && <><div style={{ color: "#e8d5b0", fontWeight: 700 }}>{andersBest.name}</div><div style={{ color: "#C8923A" }}>⭐ {fmtAvg(getAvg(andersBest))}</div></>}
        </div>
        <div style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 16, padding: 16 }}>
          <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>💚 Best Value Find</div>
          {markusValue && <><div style={{ color: "#e8d5b0", fontWeight: 700 }}>{markusValue.name}</div><div style={{ color: "#6aaa6a" }}>{fmtValue(getValueScore(markusValue))}</div></>}
        </div>
        <div style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 16, padding: 16 }}>
          <div style={{ color: "#5a4a32", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>🏙️ Most Visited City</div>
          {topCity && <><div style={{ color: "#e8d5b0", fontWeight: 700 }}>{topCityDisplay}</div><div style={{ color: "#5a4a32", fontSize: 12 }}>{mules.filter(m => normalizeCity(m.city)===topCity).length} mules</div></>}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [mules, setMules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMule, setEditingMule] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filterTag, setFilterTag] = useState("");
  const [filterWho, setFilterWho] = useState("");
  const [tab, setTab] = useState("list");
  const [filterCity, setFilterCity] = useState("");
  const [showH2H, setShowH2H] = useState(false);
  const [mapCountry, setMapCountry] = useState("");

  const load = async () => {
    try { setError(null); const rows = await dbGetAll(); setMules(rows.map(rowToMule)); }
    catch (e) { setError("Could not connect to database."); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (currentUser) load(); }, [currentUser]);

  const addMule = async mule => { await dbInsert(mule); await load(); setShowAdd(false); };
  const updateMule = async mule => {
    try {
      await dbUpdate(editingMule.id, { ...mule, rating: (mule.ratingTaste + mule.ratingLooks) / 2 });
      setEditingMule(null);
      window.location.reload();
    } catch(e) {
      alert("Save failed: " + e.message);
    }
  };
  const deleteMule = async id => { await dbDelete(id); setMules(p => p.filter(m => m.id !== id)); };

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} />;

  const allTags = [...new Set(mules.flatMap(m => m.tags || []))];
  const filtered = mules
    .filter(m => { const q = search.toLowerCase(); return !q || m.name?.toLowerCase().includes(q) || m.location?.toLowerCase().includes(q); })
    .filter(m => !filterTag || m.tags?.includes(filterTag))
    .filter(m => { if (!filterWho) return true; return m.tastedBy?.includes(filterWho); })
    .filter(m => !filterCity || normalizeCity(m.city) === filterCity)
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "rating-high") return getAvg(b) - getAvg(a);
      if (sortBy === "rating-low") return getAvg(a) - getAvg(b);
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price-low") return (a.price || 999) - (b.price || 999);
      if (sortBy === "price-high") return (b.price || 0) - (a.price || 0);
      if (sortBy === "value") return (getValueScore(b) || 0) - (getValueScore(a) || 0);
      return 0;
    });

  const avgRating = mules.length ? fmtAvg(mules.reduce((s, m) => s + getAvg(m), 0) / mules.length) : "—";
  const cities = new Set(mules.map(m => normalizeCity(m.city)).filter(Boolean));
  const bestValue = mules.filter(m => m.price).sort((a,b) => (getValueScore(b)||0) - (getValueScore(a)||0))[0];
  const now = new Date();
  const monthMules = mules.filter(m => { if (!m.createdAt) return false; const d = new Date(m.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const muleOfMonth = monthMules.length > 0 ? monthMules.sort((a,b) => getAvg(b) - getAvg(a))[0] : null;

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a0703", fontFamily: "'Georgia', serif", color: "#e8d5b0", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #1a1006 0%, #0a0703 100%)", borderBottom: "1px solid #2a1f0e", padding: "28px 24px 20px", textAlign: "center", position: "relative" }}>
        <button onClick={() => setCurrentUser(null)} style={{ position: "absolute", top: 16, right: 16, background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "6px 14px", color: "#5a4a32", cursor: "pointer", fontSize: 12 }}>
          {currentUser === "Markus" ? "🧔" : "👨"} {currentUser} · Log out
        </button>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <MuleLogo size={56} />
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(22px, 5vw, 42px)", fontWeight: 900, color: "#C8923A", margin: 0, lineHeight: 1 }}>The Mule Hunt</h1>
        <p style={{ color: "#5a4a32", marginTop: 4, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Anders &amp; Markus</p>

        {/* Stats */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
          {[
            { label: "Mules Tried", value: mules.length },
            { label: "Avg Rating", value: avgRating },
            { label: "Cities", value: cities.size || "—" },
            { label: "Best Value", value: bestValue ? bestValue.name.split(" ")[0] : "—" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#C8923A" }}>{s.value}</div>
              <div style={{ color: "#5a4a32", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a1f0e", background: "#0f0b06" }}>
        {[{ key: "list", label: "🍺 Mules" }, { key: "map", label: "🗺️ Map" }, { key: "leaderboard", label: "🏆 Stats" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "14px", background: "transparent", border: "none", borderBottom: tab === t.key ? "2px solid #C8923A" : "2px solid transparent", color: tab === t.key ? "#C8923A" : "#5a4a32", cursor: "pointer", fontSize: 14, fontFamily: "'Playfair Display', serif", fontWeight: tab === t.key ? 700 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "leaderboard" ? (
        <Leaderboard mules={mules} />
      ) : tab === "map" ? (
        <MapView mules={mules} onSelectMule={m => { setSelected(m); setTab("list"); }} />
      ) : (
        <>
          {/* Controls */}
          <div style={{ padding: "14px 24px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", maxWidth: 1100, margin: "0 auto" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search..." style={{ flex: "1 1 180px", background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 16px", color: "#e8d5b0", fontSize: 14, outline: "none" }} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 12px", color: "#e8d5b0", fontSize: 13, cursor: "pointer" }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="rating-high">Top Rated</option>
              <option value="rating-low">Lowest Rated</option>
              <option value="value">Best Value 💚</option>
              <option value="name">A-Z</option>
              <option value="price-low">Cheapest</option>
              <option value="price-high">Priciest</option>
            </select>
            <select value={filterWho} onChange={e => setFilterWho(e.target.value)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 12px", color: "#e8d5b0", fontSize: 13, cursor: "pointer" }}>
              <option value="">Everyone</option>
              <option value="Markus">🧔 Markus</option>
              <option value="Anders">👨 Anders</option>
            </select>
            {allTags.length > 0 && <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 12px", color: "#e8d5b0", fontSize: 13, cursor: "pointer" }}><option value="">All Tags</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select>}
            <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", borderRadius: 10, padding: "10px 12px", color: "#e8d5b0", fontSize: 13, cursor: "pointer" }}>
              <option value="">All Cities</option>
              {(() => {
                const seen = new Map();
                mules.forEach(m => { if (m.city) { const n = normalizeCity(m.city); if (!seen.has(n)) seen.set(n, m.city); } });
                return [...seen.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([n, original]) => <option key={n} value={n}>{displayCity(original)}</option>);
              })()}
            </select>
                    <button onClick={() => setShowH2H(true)} style={{ background: "#1a1208", border: "1px solid #3a2e1a", color: "#C8923A", borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>⚔️ Compare</button>
    <button onClick={() => setShowAdd(true)} style={{ background: "linear-gradient(135deg, #C8923A, #a06820)", border: "none", color: "#0f0b06", borderRadius: 10, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", fontFamily: "'Playfair Display', serif" }}>+ Log a Mule</button>
          </div>

          {/* Grid */}
          <div style={{ padding: "0 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
            {muleOfMonth && (
            <div style={{ marginBottom: 20, background: "linear-gradient(135deg, #2a1a06, #1a1208)", border: "2px solid #C8923A", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 32 }}>⭐</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#C8923A", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Mule of the Month</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#e8d5b0", fontWeight: 700 }}>{muleOfMonth.name}</div>
                <div style={{ color: "#7a6a52", fontSize: 13 }}>{getFlag(muleOfMonth)} {muleOfMonth.city || muleOfMonth.location} · ⭐ {fmtAvg(getAvg(muleOfMonth))}/5</div>
              </div>
              {muleOfMonth.images && muleOfMonth.images[0] && <img src={muleOfMonth.images[0]} style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: "1px solid #C8923A" }} />}
            </div>
          )}
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
        </>
      )}

      {showH2H && <HeadToHead mules={mules} onClose={() => setShowH2H(false)} />}
      {showAdd && <AddMuleForm onSave={addMule} onClose={() => setShowAdd(false)} currentUser={currentUser} knownCities={[...new Set(mules.map(m => m.city).filter(Boolean))]} />}
      {editingMule && <AddMuleForm editMode={true} initialData={editingMule} onSave={updateMule} onClose={() => setEditingMule(null)} currentUser={currentUser} knownCities={[...new Set(mules.map(m => m.city).filter(Boolean))]} />}
      {selected && <Modal mule={selected} onClose={() => setSelected(null)} onDelete={deleteMule} onEdit={m => { setEditingMule(m); setSelected(null); }} />}
    </div>
  );
}
