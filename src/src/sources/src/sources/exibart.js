import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";

const FEED = "https://www.exibart.com/feed/";

function parseDates(text) {
  const m = (text||"").match(/dal\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+al\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i);
  if (!m) return { dal: null, al: null };
  const y1 = m[3].length === 2 ? "20"+m[3] : m[3];
  const y2 = m[6].length === 2 ? "20"+m[6] : m[6];
  return { dal: `${y1}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`, al: `${y2}-${String(m[5]).padStart(2,"0")}-${String(m[4]).padStart(2,"0")}` };
}

function guessCityRegion(text) {
  const cities = ["Roma","Milano","Torino","Venezia","Firenze","Napoli","Bologna","Genova","Palermo","Cagliari","Bari","Perugia","Ancona","Trieste","Trento","Bolzano","Aosta","Campobasso","Potenza","Catanzaro"];
  const map = {"Roma":"Lazio","Milano":"Lombardia","Torino":"Piemonte","Venezia":"Veneto","Firenze":"Toscana","Napoli":"Campania","Bologna":"Emilia-Romagna","Genova":"Liguria","Palermo":"Sicilia","Cagliari":"Sardegna","Bari":"Puglia","Perugia":"Umbria","Ancona":"Marche","Trieste":"Friuli-Venezia Giulia","Trento":"Trentino-Alto Adige","Bolzano":"Trentino-Alto Adige","Aosta":"Valle d'Aosta","Campobasso":"Molise","Potenza":"Basilicata","Catanzaro":"Calabria"};
  const hit = cities.find(c => text.includes(c));
  return { citta: hit || "", regione: hit ? map[hit] : "" };
}

async function parsePage(url) {
  const { data } = await axios.get(url, { timeout: 20000 });
  const $ = cheerio.load(data);
  const titolo = $("h1").first().text().trim() || $("title").text().trim();
  const body = $("article, .entry-content, body").text().replace(/\s+/g," ").trim();

  let artisti = "";
  const mTit = titolo.match(/^([^.\-–:]{3,60})[.\-–:]/);
  if (mTit) artisti = mTit[1].trim();

  const museo = (body.match(/presso\s+([A-Z0-9].{3,80})/i)?.[1] || "").split(".")[0].trim();
  const { citta, regione } = guessCityRegion(body);
  const indirizzo = (body.match(/(via|viale|piazza|largo)\s+[A-ZÀ-Ù][^,]+,\s*\d*/i)?.[0] || "").trim();
  const date = parseDates(body);
  const img = $('meta[property="og:image"]').attr("content") || $("img").first().attr("src") || "";

  return {
    artisti, titolo, date,
    museo,
    luogo: { regione, citta, indirizzo },
    link: url, img,
    fonte: "exibart"
  };
}

export async function fetchExibart() {
  const { data } = await axios.get(FEED, { timeout: 20000 });
  const rss = await parseStringPromise(data);
  const items = rss?.rss?.channel?.[0]?.item || [];
  const urls = items.map(i => i.link?.[0]).filter(Boolean);

  const out = [];
  for (const url of urls.slice(0, 30)) {
    try { out.push(await parsePage(url)); } catch(e) {}
  }
  return out;
}
