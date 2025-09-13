import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import { fetchArteIt } from "./sources/arteit.js";
import { fetchExibart } from "./sources/exibart.js";

const OUT = path.resolve("mostre.json");

function dedup(items) {
  const seen = new Set();
  return items.filter(x => {
    const k = (x.link || "") + "|" + (x.titolo || "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function normalize(m) {
  const keep = s => (s && typeof s === "string") ? s.trim() : "";
  const d = s => (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) ? s : null;
  return {
    artisti: keep(m.artisti),
    titolo: keep(m.titolo),
    date: { dal: d(m?.date?.dal), al: d(m?.date?.al) },
    museo: keep(m.museo),
    luogo: {
      regione: keep(m?.luogo?.regione),
      citta: keep(m?.luogo?.citta),
      indirizzo: keep(m?.luogo?.indirizzo)
    },
    link: keep(m.link),
    img: keep(m.img),
    fonte: keep(m.fonte),
    discoveredAt: m.discoveredAt || new Date().toISOString()
  };
}

(async () => {
  try {
    const batches = await Promise.allSettled([
      fetchArteIt(),
      fetchExibart()
    ]);
    const all = batches.flatMap(b => b.status === "fulfilled" ? b.value : []);

    const cleaned = dedup(all).map(normalize)
      // tieni in corso/future o finite da max 60 giorni
      .filter(m => {
        const today = dayjs();
        const end = m.date?.al ? dayjs(m.date.al) : null;
        return !end || end.isAfter(today.subtract(60, "day"));
      })
      // ordina per data d’inizio (dalla più recente)
      .sort((a,b) => {
        const da = a.date?.dal ? dayjs(a.date.dal).valueOf() : 0;
        const db = b.date?.dal ? dayjs(b.date.dal).valueOf() : 0;
        return db - da;
      });

    fs.writeFileSync(OUT, JSON.stringify(cleaned, null, 2), "utf8");
    console.log(`OK: ${cleaned.length} mostre -> ${OUT}`);
  } catch (e) {
    console.error("Errore:", e?.message || e);
    process.exit(1);
  }
})();
