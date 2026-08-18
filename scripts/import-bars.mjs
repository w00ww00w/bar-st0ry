import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const city = process.argv[2] || "Новосибирск";
const output = resolve("data/bars.json");
const query = `[out:json][timeout:60];rel(1751445);map_to_area->.city;nwr["amenity"~"^(bar|pub|biergarten)$"](area.city);out center tags;`;

export function normalize(elements) {
  const seen = new Set();
  return elements.flatMap((item) => {
    const tags = item.tags || {};
    const lat = item.lat ?? item.center?.lat;
    const lon = item.lon ?? item.center?.lon;
    if (!tags.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const key = `${tags.name.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const address = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ");
    return [{
      id: `osm-${item.type}-${item.id}`,
      name: tags.name,
      category: { bar: "Бар", pub: "Паб", biergarten: "Пивной сад" }[tags.amenity] || "Бар",
      lat,
      lon,
      address: tags["addr:full"] || address || null,
      website: tags.website || tags["contact:website"] || null,
      phone: tags.phone || tags["contact:phone"] || null,
      openingHours: tags.opening_hours || null,
      osmUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
    }];
  }).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

if (process.argv.includes("--check")) {
  const result = normalize([{ type: "node", id: 1, lat: 55, lon: 83, tags: { name: "Тест", amenity: "bar" } }]);
  if (result.length !== 1 || result[0].id !== "osm-node-1") throw new Error("normalize check failed");
  console.log("Import check passed");
} else {
  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ];
  let response;
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "BarStory/0.1" },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) break;
      errors.push(`${endpoint}: HTTP ${response.status}`);
    } catch (error) { errors.push(`${endpoint}: ${error.message}`); }
  }
  if (!response?.ok) throw new Error(`Overpass API failed:\n${errors.join("\n")}`);
  const bars = normalize((await response.json()).elements || []);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ city, attribution: "© OpenStreetMap contributors", bars }, null, 2)}\n`);
  console.log(`Saved ${bars.length} bars to ${output}`);
}
