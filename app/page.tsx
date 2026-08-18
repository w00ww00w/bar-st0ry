"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import catalog from "../data/bars.json";

const bars = catalog.bars;

export default function Home() {
  const [visited, setVisited] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list" | "admin">("map");
  const [search, setSearch] = useState("");
  const [customBars, setCustomBars] = useState<typeof bars>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [coordinates, setCoordinates] = useState<Record<string, { lat: number; lon: number }>>({});
  const [mapReady, setMapReady] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef(new Map<string, any>());

  useEffect(() => {
    setVisited(JSON.parse(localStorage.getItem("bar-map.visited") || "[]"));
    setCustomBars(JSON.parse(localStorage.getItem("bar-map.custom") || "[]"));
    setHidden(JSON.parse(localStorage.getItem("bar-map.hidden") || "[]"));
    setConfirmed(JSON.parse(localStorage.getItem("bar-map.confirmed") || "[]"));
    setCoordinates(JSON.parse(localStorage.getItem("bar-map.coordinates") || "{}"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = () => {
      if (cancelled || map.current || !mapNode.current) return;
      const L = (window as any).L;
      map.current = L.map(mapNode.current, { zoomControl: true }).fitBounds([[54.70, 82.58], [55.25, 83.22]]);
      map.current.attributionControl.setPrefix(false);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors", maxZoom: 19,
      }).addTo(map.current);
      setMapReady(true);
    };
    if ((window as any).L) init();
    else {
      let script = document.querySelector<HTMLScriptElement>("script[data-leaflet]");
      if (!script) {
        script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.dataset.leaflet = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", init, { once: true });
    }
    return () => { cancelled = true; map.current?.remove(); map.current = null; markers.current.clear(); setMapReady(false); };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapReady) return;
    const positionedBars = [...bars, ...customBars].map((bar) => ({ ...bar, ...coordinates[bar.id] }));
    const visibleIds = new Set(positionedBars.filter((bar) => !hidden.includes(bar.id)).map((bar) => bar.id));
    markers.current.forEach((marker, id) => { if (!visibleIds.has(id)) { marker.remove(); markers.current.delete(id); } });
    positionedBars.filter((bar) => visibleIds.has(bar.id)).forEach((bar) => {
      let marker = markers.current.get(bar.id);
      if (!marker) {
        marker = L.marker([bar.lat, bar.lon]).addTo(map.current).on("click", () => setSelected(bar.id));
        marker.bindTooltip(bar.name, { direction: "top", offset: [0, -8] });
        markers.current.set(bar.id, marker);
      }
      marker.setLatLng([bar.lat, bar.lon]);
    });
    markers.current.forEach((marker, id) => marker.setIcon(L.divIcon({
      className: "bar-marker-host",
      html: `<span class="bar-marker${visited.includes(id) ? " done" : ""}${selected === id ? " active" : ""}">${visited.includes(id) ? "✓" : ""}</span>`,
      iconSize: [22, 22], iconAnchor: [11, 22],
    })));
  }, [coordinates, customBars, hidden, mapReady, selected, visited]);

  const toggle = (id: string) => {
    const next = visited.includes(id) ? visited.filter((barId) => barId !== id) : [...visited, id];
    setVisited(next);
    localStorage.setItem("bar-map.visited", JSON.stringify(next));
  };

  const allBars = [...bars, ...customBars].map((bar) => ({ ...bar, ...coordinates[bar.id] }));
  const visibleBars = allBars.filter((bar) => !hidden.includes(bar.id));
  const visitedCount = visited.filter((id) => visibleBars.some((bar) => bar.id === id)).length;
  const current = visibleBars.find((bar) => bar.id === selected);
  const query = search.trim().toLocaleLowerCase("ru");
  const matches = (bar: (typeof bars)[number]) => [bar.name, bar.category, bar.address].some((value) => value?.toLocaleLowerCase("ru").includes(query));
  const filtered = query ? visibleBars.filter(matches) : visibleBars;
  const moderated = query ? allBars.filter(matches) : allBars;
  const openBar = (bar: (typeof bars)[number]) => {
    setSelected(bar.id);
    setView("map");
    setTimeout(() => map.current?.invalidateSize().setView([bar.lat, bar.lon], 16), 0);
  };
  const toggleHidden = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((barId) => barId !== id) : [...hidden, id];
    setHidden(next); localStorage.setItem("bar-map.hidden", JSON.stringify(next));
    if (id === selected && next.includes(id)) setSelected(null);
  };
  const toggleConfirmed = (id: string) => {
    const next = confirmed.includes(id) ? confirmed.filter((barId) => barId !== id) : [...confirmed, id];
    setConfirmed(next); localStorage.setItem("bar-map.confirmed", JSON.stringify(next));
  };
  const editCoordinates = (id: string) => {
    const bar = allBars.find((item) => item.id === id); if (!bar) return;
    const lat = Number(window.prompt("Широта", String(bar.lat))); if (!Number.isFinite(lat) || lat < -90 || lat > 90) return;
    const lon = Number(window.prompt("Долгота", String(bar.lon))); if (!Number.isFinite(lon) || lon < -180 || lon > 180) return;
    const next = { ...coordinates, [id]: { lat, lon } }; setCoordinates(next); localStorage.setItem("bar-map.coordinates", JSON.stringify(next));
  };
  const addBar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const lat = Number(data.get("lat")); const lon = Number(data.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const bar = {
      id: `manual-${crypto.randomUUID()}`, name: String(data.get("name")), category: String(data.get("category")),
      address: String(data.get("address")) || null, lat, lon, website: null, phone: null, openingHours: null, osmUrl: null,
    };
    const next = [...customBars, bar]; setCustomBars(next); localStorage.setItem("bar-map.custom", JSON.stringify(next));
    form.reset(); setSearch(""); openBar(bar);
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#map" aria-label="BarStory — на карту">
          <span className="brand-mark">BS</span><span>BarStory</span>
        </a>
        <div className="progress" aria-label={`Посещено ${visitedCount} из ${visibleBars.length}`}>
          <span>{visitedCount}/{visibleBars.length}</span><div><i style={{ width: `${(visitedCount / visibleBars.length) * 100}%` }} /></div>
        </div>
      </header>

      <section className="intro">
        <p className="eyebrow">Новосибирск · {visibleBars.length} мест</p>
        <h1>Узнай город<br />по одному бару за раз.</h1>
        <p className="lede">Выбирайте место на карте, заглядывайте на напиток и собирайте свою историю города.</p>
      </section>

      <nav className="browse-panel" aria-label="Просмотр и поиск баров">
        <div className="view-switch">
          <button aria-pressed={view === "map"} onClick={() => { setView("map"); setTimeout(() => map.current?.invalidateSize(), 0); }}>Карта</button>
          <button aria-pressed={view === "list"} onClick={() => setView("list")}>Список</button>
          <button aria-pressed={view === "admin"} onClick={() => setView("admin")}>Управление</button>
        </div>
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={search} placeholder="Название, адрес или категория" aria-label="Поиск баров"
            onChange={(event) => { setSearch(event.target.value); if (event.target.value && view !== "admin") setView("list"); }} />
          <small>{view === "admin" ? moderated.length : filtered.length}</small>
        </label>
      </nav>

      <section className={`map-shell${view === "map" ? "" : " is-hidden"}`} id="map" aria-label="Карта баров">
        <div className="real-map" ref={mapNode} />
        {current && <article className="bar-card">
          <div><p>{current.category}{current.address ? ` · ${current.address}` : ""}{confirmed.includes(current.id) && <span className="verified">✓ Подтверждено</span>}</p><h2>{current.name}</h2></div>
          <button onClick={() => toggle(current.id)}>{visited.includes(current.id) ? "Отменить отметку" : "Я здесь выпил"}</button>
        </article>}
      </section>

      {view === "list" && <section className="bar-list" aria-label="Список баров">
        {filtered.map((bar) => <button className="bar-row" onClick={() => openBar(bar)} key={bar.id}>
          <span className={`row-status${visited.includes(bar.id) ? " done" : ""}`}>{visited.includes(bar.id) ? "✓" : ""}</span>
          <span><strong>{bar.name}{confirmed.includes(bar.id) && <em className="verified">✓ Подтверждено</em>}</strong><small>{bar.category}{bar.address ? ` · ${bar.address}` : ""}</small></span>
          <b aria-hidden="true">→</b>
        </button>)}
        {!filtered.length && <p className="empty-list">Ничего не найдено. Попробуйте другой запрос.</p>}
      </section>}

      {view === "admin" && <section className="admin-panel" aria-label="Управление заведениями">
        <form className="add-bar" onSubmit={addBar}>
          <div><p className="eyebrow">Ручное добавление</p><h2>Новое заведение</h2></div>
          <label>Название<input name="name" required /></label>
          <label>Категория<select name="category"><option>Бар</option><option>Паб</option><option>Пивной сад</option></select></label>
          <label className="wide">Адрес<input name="address" /></label>
          <label>Широта<input name="lat" type="number" step="any" min="54" max="56" required /></label>
          <label>Долгота<input name="lon" type="number" step="any" min="82" max="84" required /></label>
          <button type="submit">Добавить на карту</button>
        </form>
        <div className="moderation-list">
          <div className="moderation-head"><h2>Модерация</h2><span>Подтверждено: {confirmed.length} · скрыто: {hidden.length}</span></div>
          {moderated.map((bar) => <article className={hidden.includes(bar.id) ? "is-muted" : ""} key={bar.id}>
            <div><strong>{bar.name}</strong><small>{bar.id.startsWith("manual-") ? "Добавлено вручную" : "OpenStreetMap"}{bar.address ? ` · ${bar.address}` : ""} · {bar.lat.toFixed(5)}, {bar.lon.toFixed(5)}</small></div>
            <div className="mod-actions">
              <button onClick={() => editCoordinates(bar.id)}>Координаты</button>
              <button onClick={() => toggleConfirmed(bar.id)}>{confirmed.includes(bar.id) ? "Снять отметку" : "Подтвердить"}</button>
              <button onClick={() => toggleHidden(bar.id)}>{hidden.includes(bar.id) ? "Вернуть" : "Скрыть"}</button>
            </div>
          </article>)}
        </div>
      </section>}

      <footer><span>Пейте ответственно.</span><span>{catalog.attribution} · прогресс хранится на этом устройстве.</span></footer>
    </main>
  );
}
