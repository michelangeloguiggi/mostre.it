import axios from "axios";
import * as cheerio from "cheerio";
import { parseStringPromise } from "xml2js";

const FEED = "https://www.arte.it/rss/feed_eventi.php?lang=it";

function parseDateRange(text) {
  const mesi = {
    gennaio:"01", febbr:"02", febbraio:"02", marzo:"03", aprile:"04", maggio:"05",
    giugno:"06", luglio:"07", agosto:"08", settembre:"09", october:"10", ottobre:"10",
    novembre:"11", december:"12", dicembre:"12", september:"09", january:"01"
  };
  const m = (text || "").match(/Dal\s+(\d{1,2})\s+([A-Za-zàé]+)\s+(\d{4})\s+al\s+(\d{1,2})\s+([A-Za-zàé]+)\s+(\d{4})/i);
  if (!m) return { dal: null, al: null };
  const d1 = `${m[3]}-${(mesi[m[2].toLowerCase()]||"01")}-${String(m[1]).padStart(2,"0")}`;
  const d2 = `${m[6]}-${(mesi[m[5].toLowerCase()]||"01")}-${String(m[4]).padStart(2,"0")}`;
  return { dal: d1, al: d2 };
}

async function parseShow(url) {
  const { data } = await axios.get(url, { timeout: 20000 });
  const $ = cheerio.load(data);
  const titolo = $("h1").first().text().trim() || $("title").text().trim();
  const body = $("body").text();

  const dateLine = body.match(/Dal\s+\d{1,2}\s+[A-Za-zàé]+\s+\d{4}\s+al\s+\d{1,2}\s+[A-Za-zàé]+\s+\d{4}/i)?.[0] || "";
  const date = parseDateRange(dateLine);

  const museo = (body.match(/Luogo:\s*([^\n]+)/)?.[1] || "").trim();
  const indirizzo = (body.match(/Indirizzo:\s*([^\n]+)/)?.[1] || "").trim();
  const citta = (body.match(/Città:\s*([^\n]+)/)?.[1] || "").trim();

  const map = {"Roma":"Lazio","Milano":"Lombardia","Torino":"Piemonte","Venezia":"Veneto","Firenze":"Toscana","Napoli":"Campania","Bologna":"Emilia-Romagna","Genova":"Liguria","Palermo":"Sicilia","Cagliari":"Sardegna","Bari":"Puglia","Perugia":"Umbria","Ancona":"Marche","Trieste":"Friuli-Venezia Giulia","Trento":"Trentino-Alto Adige","Bolzano":"Trentino-Alto Adige","Aosta":"Valle d'Aosta","Campobasso":"Molise","Potenza":"Basilicata","Catanzaro":"Calabria"};
  const regione = map[citta] || "";

  let artisti = "";
  const mTit = titolo.match(/^([^.\-–:]{3,60})[.\-–:]/);
  if (mTit) artisti = mTit[1].trim();

  const img = $('meta[property="og:image"]').attr("content") || $("img").first().attr("src") || "";

  return {
    artisti, titolo, date,
    museo,
    luogo: { regione, citta, indirizzo },
    link: url, img,
    fonte: "arte.it"
  };
}

export async function fetchArteIt() {
  const { data } = await axios.get(FEED, { timeout: 20000 });
  const rss = await parseStringPromise(data);
  const items = rss?.rss?.channel?.[0]?.item || [];
  const urls = items.map(i => i.link?.[0]).filter(Boolean);

  const out = [];
  for (const url of urls.slice(0, 40)) {
    try { out.push(await parseShow(url)); } catch(e) {}
  }
  return out;
}
