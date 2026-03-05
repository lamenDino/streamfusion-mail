# Changelog

All notable changes to **StreamFusion Mail** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.4.6] — 2026-03-05

### Fixed
- **Metadati KissKH mai caricati (timeout TMDB)** — `enrichFromTmdb` poteva richiedere fino a 24s (2 ricerche × 8s + 1 detail × 8s). Sommato agli 8s delle chiamate KissKH, il getMeta superava il `META_TIMEOUT` di 30s, restituendo sempre `{meta: null}`. Fix: aggiunto un **cap di 10s** su `enrichFromTmdb` dentro getMeta (sia KissKH che Rama). Il metadato viene restituito con o senza l’arricchimento TMDB, sempre entro 18s.
- **TMDB search fallisce su titoli con anno** — KissKH restituisce titoli come `"Therapy (2025)"`. La ricerca TMDB con questo titolo falliva perché TMDB ha solo `"Therapy"`. Fix: il suffisso anno-tra-parentesi viene rimosso prima della ricerca TMDB (`meta.name.replace(/\s*\(\d{4}\)\s*$/, '')`).
- **Catalogo Rama non appare in Scopri (Discover)** — il tipo `kdrama` non è riconosciuto da Stremio, che mostra solo cataloghi di tipo `series`, `movie`, `channel`, `tv` nella scheda Scopri. Fix: tipo Rama cambiato da `kdrama` a `series` nel manifest. I routing interni continuano a funzionare correttamente tramite `id` prefix (`rama_*`).
- **Routing catalogo pericoloso** — `handleCatalog` aveva un fallback `|| type === 'series'` che serviva il catalogo KissKH per qualsiasi richiesta di tipo `series`, inclusa `rama_catalog`. Fix: routing ora basato esclusivamente su `catalogId`.
- **Manifest version bump** 1.4.4 → 1.4.6 — forza Stremio a ri-scaricare il manifest e aggiornare i tipi.

---

## [1.4.5] — 2026-06-XX

### Fixed
- **"metadati non trovati" su Cinemeta (cinemeta=true)** — quando `cinemeta=true` era configurato, aggiungere `tt` al top-level `idPrefixes` causava Stremio a chiamare il nostro `getMeta` per gli item Cinemeta (ID `tt*`). Restituendo `{meta: null}` per questi ID, Stremio mostrava "metadati non trovati" su tutta la home. Fix: il manifest con `cinemeta=true` ora usa il formato **per-resource idPrefixes**: `meta` gestisce solo `kisskh_*`/`rama_*`, mentre `stream` gestisce anche `tt*`. Stremio usa Cinemeta per i meta e il nostro addon solo per gli stream.
- **Cinemeta → KissKH: titoli K-drama non risolti** — `v3-cinemeta.strem.io` restituisce `{}` per i K-drama (Vercel datacenter IPs esclusi e/o assenza dei titoli nel database Cinemeta). Aggiunto fallback a **TMDB `/find/{imdbId}`** quando Cinemeta non fornisce il titolo. Richiede `tmdbKey` nel config URL oppure `TMDB_API_KEY` in Vercel env vars.
- **Cinemeta → KissKH: 0 stream per K-drama classici** — `_searchCatalog` cercava solo negli ultimi 600 drammi ordinati per data (`order=3`). Drammi come "Crash Landing on You" (2019, page 3 `order=1`), "Goblin" (page 3), "Descendants of the Sun" (page 3), "Boys Over Flowers" (page 10) non venivano mai trovati. Aggiunto **popularity sweep parallelo** (`order=1`, pagine 1-10) che parte in parallelo con il recency sweep e copre i 300 drammi più visti di tutti i tempi.
- **Risultati di ricerca: match esatti penalizzati da match parziali** — dopo il merge dei risultati, la slice a 20 prendeva i primi 20 per ordine di scoperta (recency sweep). "Crash" (score 0.85) poteva vincere su "Crash Landing on You" (score 1.0) se il primo veniva trovato prima. Fix: i risultati vengono ora **ordinati per `titleSimilarity` discendente** prima della slice, garantendo che i match esatti siano sempre in cima.

### Added
- **`findTitleByImdbId(imdbId, apiKey)`** in `src/utils/tmdb.js` — nuova funzione per cercare il titolo di una serie via TMDB `/find/{imdbId}?external_source=imdb_id`. Usata come fallback per i Cinemeta stream request.
- **`TMDB_API_KEY` env var** — se impostata in Vercel, abilita il fallback TMDB per tutti gli utenti indipendentemente dalla config personale. Chiave gratuita su https://themoviedb.org. Documentata in `stack.env.example`.
- **Manifest version bump** 1.3.8 → 1.4.4 — forza Stremio a ri-scaricare il manifest e invalidare la cache.

---

## [1.3.8] — 2026-03-05

### Added
- **KissKH catalog enrichment da KissKH stesso** — `_listCatalog` e `_searchCatalog` ora eseguono in parallelo le chiamate alla drama detail API (non CF-protetta) per ogni item del catalogo. Le card nella home mostrano `description`, `genres`, `releaseInfo`. Effetto collaterale: `metaCache` viene pre-popolato, quindi quando Stremio apre un item e chiama `getMeta`, la risposta è istantanea dalla cache (elimina il "No metadata was found").
- **`_buildMeta` helper** — logica di costruzione del meta object estratta in una funzione condivisa usata sia da `getCatalog` (enrichment) che da `getMeta` (eliminata duplicazione di codice).
- **IP client passato ai provider** — `server.js` legge l'IP del client da `X-Forwarded-For` (impostato da Vercel) e lo inietta in `config.clientIp`. Tutti i provider (`kisskh.js`, `rama.js`) e le utility (`fetcher.js`) usano questo IP come header `X-Forwarded-For` nelle richieste upstream. Questo fa apparire le richieste come provenienti dall'IP italiano dell'utente.
- **`Accept-Language: it-IT`** — aggiunto a `fetchWithCloudscraper` (Rama), `_baseHeaders` KissKH, e alle chiamate TMDB axios.

### Fixed
- **`getMeta` semplificato** — rimosso codice duplicato (cast parsing, video mapping) ora centralizzato in `_buildMeta`.

---

## [1.3.7] — 2026-03-05

### Fixed
- **KissKH catalog: ripristinato filtro `country=2` (solo drammi coreani)** — il cambio precedente a `country=0` mostrava drammi cinesi/giapponesi in prima pagina. Ora `_listCatalog` usa `country=2&status=0` (solo Corea, sia ongoing che completati).
- **KissKH ricerca titola falliva per drammi meno recenti** — l’API KissKH ignora completamente il parametro `search=` e restituisce sempre il catalogo ordinato per data. `_searchCatalog` si fermava dopo 2 batch consecutivi senza match (~180 drammi visti), non raggiungendo drammi come "Our Universe" (pagina 11). Fix: rimosso l’early-exit `emptyBatches`, aumentato `maxPages` da 10 a 20 (600 drammi coperti). Rimosso `search=query` dall’URL (era inutile).
- **Cinemeta path `SEARCH_TIMEOUT` raddoppiato** — `_kisskhStreamsForTitle` usava 8 s di timeout per la ricerca catalogo. Con la nuova logica (fino a 20 pagine in batch da 3) il timeout è aumentato a 20 s per permettere la ricerca nelle pagine più avanzate.

---

## [1.3.6] — 2026-05-14

### Fixed
- **KissKH streams: rimossa visita intermedia `drama page` nella sequenza FlareSolverr** — `_fetchStreamViaApi` ora esegue solo 2 step: CF primer → episode API (4 varianti), invece di 3 (primer → drama page → episode API). La visita alla drama page consumava 8–15 s del budget 25 s prima ancora di tentare l'API dello stream, causando timeout sistematici. Il `dramaPageUrl` è conservato come `Referer` nell'header della chiamata all'API episodio senza ulteriori caricamenti della pagina. Le varianti API tentate salgono da 2 a 4 (`type×source`: 2×1, 1×0, 2×0, 1×1).

---

## [1.3.5] — 2026-05-09

### Added
- **TopPoster API** — nuovo campo `topPosterKey` nella configurazione. Se configurato (assieme a TMDB), sostituisce il poster standard con la locandina fornita da TopPoster. Ha priorità su RPDB. Integrato in `src/utils/tmdb.js` (`topPosterUrl()`), `src/utils/config.js` (chiave breve `tp`), `src/providers/kisskh.js` (nuovo blocco TMDB enrichment in `getMeta`), `src/providers/rama.js` (entrambi i blocchi poster). Aggiunto il campo nella landing page di configurazione.
- **KissKH TMDB enrichment in getMeta** — `getMeta` di KissKH ora arricchisce la scheda con dati TMDB (poster HD, background, cast, generi, IMDB ID) se `tmdbKey` è configurata, con la stessa logica di Rama.

---

## [1.3.4] — 2026-05-08

### Removed
- **Drammatica provider** rimosso — `www.drammatica.it` risulta parcheggiato (ParkLogic domain parking): il sito non è più attivo. Rimosso da `manifest.json` (catalog + idPrefix), da `src/providers/index.js` (routing, import, `_drammaticaStreamsForTitle`). Il file `drammatica.js` rimane in codebase nel caso venga trovato un nuovo URL.

---



### Removed
- **Guardaserie provider** rimosso — già presente in altri addon; tolto da `manifest.json` (catalog + idPrefix), da `src/providers/index.js` (routing, import, `_guardaserieStreamsForTitle`) e dalla landing page.

### Fixed
- **KissKH stream vuoti quando FlareSolverr è configurato** — `_fetchStreamViaApi` aveva `return null` fisso dopo il blocco FlareSolverr, impedendo il fallback a axios diretto anche quando `api.kisskh.co` è raggiungibile senza CF cookie (verificato: 200 ms 900 via proxy). Ora il flusso è:
  1. FlareSolverr (max 25 s hard cap via `Promise.race`)
  2. axios diretto con proxy (no cookie, funziona su `api.kisskh.co`)
  3. cookie CF_CLEARANCE_KISSKH (fallback finale)

### Added
- **Debug endpoint `/debug/drammatica`** — ispeziona la struttura HTML di drammatica.it per diagnosi selettori.

---

## [1.3.2] — 2026-03-05

### Fixed (stream Rama — bug critico)
- **`wrapStreamUrl` import mancante in `rama.js`** — la funzione era chiamata ma mai importata da `../utils/mediaflow`; causava `ReferenceError` a runtime → tutti i flussi Rama ritornavano `{"streams":[]}` silenziosamente. Ora importata correttamente.
- **Selettore iframe troppo specifico** — il selettore `div.episode-player-box iframe` non matchava le pagine episodio di Rama (che usano `.wp-post-content` come wrapper). Sostituito con selettore ampio multi-classe + fallback su qualunque iframe non pubblicitario.
- **URL con spazi non encodati** — i file su `streamingrof.online` hanno spazi nel path (es. `In Your Radiant Season - S01E02.mp4`). Il regex `[^"'\s]+` si fermava al primo spazio. Nuovo regex `["'](https://…mp4)["']` e encoding `space → %20`, `[ → %5B`, `] → %5D`.

### Fixed (catalog — da commit e6e91e4)
- **Cache vuota propagata a Stremio** — catalog con 0 risultati veniva servito con `Cache-Control: max-age=300`; Stremio metteva in cache la risposta vuota del cold-start. Ora `max-age=0` quando `metas.length === 0`.
- **CATALOG_TIMEOUT troppo basso** — 9 s non bastava per cold-start Vercel + Cloudflare bypass. Portato a 25 s.
- **Routing catalog Drammatica/Guardaserie** — la condizione `rama_catalog || type === 'kdrama'` instradava tutti i catalog `kdrama` a Rama, bypasando Drammatica e Guardaserie. Rimossa la fallback `type` — ogni catalog ora usa solo l'ID prefix.

### Added (stream engine — da commit 0ca4d57)
- **Guardaserie — pattern estrazione episodi da Streamvix** — `_extractEpisodes()` ora usa 4 pattern in cascata:
  - A: `data-episode` + `data-url` (layout legacy)
  - B: `id="serie-S_E"` + `data-link` (layout attuale)
  - C: regex raw sull'HTML per `data-link`
  - D: href fallback
- **SuperVideo P,A,C,K deobfuscator** — `_resolveSupervideo()` aggiunto a Guardaserie e Drammatica; decodifica embed JavaScript P,A,C,K per estrarre il vero URL HLS/MP4.
- **Multi-hoster shortcircuit Guardaserie** — quando gli embed sono già estratti dagli attributi HTML, `_getStreamsFromEmbeds()` evita un secondo fetch della pagina episodio.

---

## [1.3.1] — 2026-03-05

### Fixed (Rama meta enrichment)
- **Trama/Synopsis**: fixed broken selector `div.font-light > div:nth-child(1)` (looked for a child div that doesn’t exist) → now uses `div.font-light.text-spec` where Rama stores the synopsis text directly
- **Generi**: old selector `a[href*="/genere/"]` captured the entire navigation sidebar (50+ genres); now scoped to the specific `li.list-none` row labelled “Genere:” → returns only the series genres (e.g. Boys Love, Drama, Romance, Sports, Youth)
- **Cast**: replaced three non-working strategies with direct `[data-character] h4` selector that matches Rama’s actor card grid (e.g. Choi Jae Hyeok, Yeom Min Hyeok)

### Added (Rama meta)
- `imdbRating` field mapped from Rama’s “Punteggio:” li item (MyDramaList score, e.g. 8.0)
- `director` field extracted from `a[href*="/regia/"]` links in the “Regia:” li
- `runtime` field extracted from “Durata:” li item (e.g. “30 min”)
- `country` field extracted from “Paese:” li item
- Adult content flag emoji 🔞 appended to description when `Valutazione: 18+` is present

---

## [1.3.0] — 2026-03-05

### Added
- **Drammatica.it provider** (`drammatica_` ID prefix, `kdrama` type)
  - Catalog with Cloudflare bypass via cloudscraper
  - Multi-strategy card extraction (5 selector patterns)
  - Auto-detection of catalog path (`/drama/`, `/k-drama/`, `/serie/`, `/`)
  - WordPress search endpoint (`/?s=`) for search queries
  - Meta: poster, background, genres, cast, episode list
  - Multi-strategy episode extraction (URL pattern matching + list selectors)
  - Multi-strategy stream extraction (iframe selectors, `<video>`, data-attrs, script scan)
  - Handles DropLoad, Streamtape, SuperVideo, Vixcloud, MaxStream, direct HLS/MP4
  - Stream card: `🚀 Drammatica` · `🇰🇷 Sub ITA`
- **Guardaserie provider** (`guardaserie_` ID prefix, `kdrama` type)
  - Mirror auto-detection (guardaserie.re → .fm → .cloud → .cx)
  - Catalog path auto-detection with 4 fallback paths
  - Multi-hoster support: DropLoad, Streamtape, SuperVideo, Vixcloud, MaxStream, DoodStream
  - Per-episode multi-stream extraction (all available hosters shown as separate streams)
  - Hoster label in stream name (e.g. `🚀 Guardaserie [DropLoad]`)
  - Tab/data-attribute scan + script scan for embedded URLs
  - Stream card: `🚀 Guardaserie [Hoster]` · `🇰🇷 Sub ITA`
- Both new providers wired into `index.js` aggregator (catalog, meta, stream, IMDB lookup)
- `manifest.json`: 4 catalogs total (`kisskh_catalog`, `rama_catalog`, `drammatica_catalog`, `guardaserie_catalog`)
- `idPrefixes` extended to `["kisskh_", "rama_", "drammatica_", "guardaserie_"]`

### Note
- **Viki (viki.com)** NOT implemented — Widevine DRM (L1/L3) + Rakuten subscription required; stream extraction technically/legally not feasible

---

## [1.2.0] — 2026-03-05

### Added
- **Config encryption (AES-256-GCM)** — `src/utils/config.js` ora cifra il config con AES-256-GCM invece di base64url; proxy URL, MFP key e altri segreti non sono più leggibili in chiaro dalla URL. Imposta `CONFIG_SECRET` env var per personalizzare la chiave. Retrocompatibile con URL base64url esistenti.
- **Timeout middleware globale** — `server.js` ora risponde `504 Gateway Timeout` dopo 50s invece di far morire la funzione Vercel senza risposta. Configurabile via `SERVERLESS_TIMEOUT` env var.
- **Auth debug endpoints** — `/debug/providers`, `/debug/flaresolverr`, `/debug/browser` ora richiedono `?token=` o header `Authorization: Bearer ...` se `DEBUG_TOKEN` env var è impostato (aperto solo in dev).

### Changed
- **Performance: Rama stream fetch parallelo** — `getStreams()` ora fetcha tutti gli URL degli episodi in parallelo con `Promise.all` invece di sequenzialmente. Per serie multi-episodio: ~3x più veloce (15s → 5s per 3 ep).
- **Performance: KissKH catalog search a batch** — `_searchCatalog()` ora fetcha le pagine in batch paralleli da 3 invece di una a volta. Riduce drasticamente il tempo di ricerca.
- **Stream URL validation** — entrambi i provider ora verificano che l'URL inizi con `http` prima di restituirlo; stream malformati vengono scartati con log di warning.
- **Logging stream extraction** — Rama ora logga per ogni episodio se lo stream non viene trovato e perché.

### Fixed
- **Cache LRU off-by-one** — `cache.js`: cambio `>=` → `>` nella condizione di eviction; la cache non supera più di 1 unità il `maxSize`.
- **Season matching** — `index.js _matchEpisode()`: la condizione `if (seasonNum)` era falsy per season=0; sostituita con `if (seasonNum !== null && seasonNum !== undefined)`.
- **Dead code rimosso** — `kisskh.js`: eliminata `_getSubtitles()` (backward-compat wrapper inutilizzato che poteva lanciare browser superflui).

---

## [1.1.3] — 2026-03-05

### Fixed
- **KissKH — Cast**: aggiunta chiamata parallela a `GET /api/DramaList/Cast/{id}` in `getMeta()` per ottenere il cast completo con nome e nome del personaggio (`Nome (Personaggio)`); fallback su `data.artists` se l'endpoint non risponde
- **KissKH — Episode overview**: mappato il campo `overview` su ogni video da `ep.description`, `ep.overview` o `ep.synopsis` (se presenti nella risposta API)
- **Rama — Cast**: rimpiazzato il singolo selettore CSS con 3 strategie progressive:
  1. Link con `href` contenente `/attori/`, `/actor/`, `/cast/`
  2. Parsing testuale di `li.list-none` cercando etichette "Attori:", "Cast:", "Interpreti:" e splittando per virgola/punto e virgola
  3. Elementi con classe contenente `cast` o `actor` come fallback
- **Rama — Episode overview**: aggiunto campo `overview` sui video (vuoto per ora, pronto per espansione futura)

---

## [1.1.2] — 2026-03-05

### Fixed
- **Rama** — `SundefinedEundefined Episodio 1`: il campo `number` nei video è stato rinominato in `episode` (campo richiesto da Stremio per mostrare `S1E1`)
- **Rama** — aggiunto campo `background` (OG image dalla pagina, fallback al poster)
- **Rama** — aggiunta estrazione `genres` e `cast` dallo scraping HTML
- **Rama** — data di rilascio episodi non più epoca Unix (1970): usa l'anno della serie
- **Rama** — thumbnail episodi ora usa l'immagine dello slide del swiper con fallback al poster
- **KissKH** — aggiunto campo `background` (thumbnail della serie)
- **KissKH** — aggiunto mapping `genres` da `data.genres`/`data.subCategory` (se presenti nella risposta API)
- **KissKH** — aggiunto mapping `cast` da `data.artists` (se presente nella risposta API)
- **KissKH** — thumbnail episodi ora usa `ep.thumbnail` con fallback a `data.thumbnail`

---

## [1.1.1] — 2026-03-05

### Fixed
- **Rama** — titolo troncato in Stremio: rimosso l'anno `(YYYY)` da `meta.name` nella riga descrizione (rimane nel meta, non nella card dello stream)
- **Rama** — flag corretto da 🇮🇹 a 🇰🇷: il contenuto è coreano con sottotitoli italiani, non italiano
- **KissKH** — stessa pulizia anno da `seriesTitle` nella descrizione stream
- Aggiunto `Sub ITA` in terza riga per entrambi i provider, al posto del solo flag

---

## [1.1.0] — 2026-03-05

### Changed
- **Stream display format** — entrambi i provider ora espongono le informazioni dello stream in un formato visivo unificato e leggibile su Stremio:
  - `name` → emoji + nome provider (es. `🚀 KissKH`, `🚀 Rama`)
  - `description` → 3 righe: `📁 Titolo serie - Episodio`, `👤 Sorgente`, `🇰🇷` / `🇮🇹`
  - Rimosso campo `title` (sostituito da `description` multi-riga)
- `src/providers/kisskh.js` — aggiunta chiamata `getMeta()` (istantanea via cache) in `getStreams()` per recuperare il titolo della serie da mostrare nella descrizione
- `src/providers/rama.js` — usato `meta.name` già disponibile in `getStreams()` per la stessa finalità
- `src/utils/cloudflare.js` — rimosso percorso FlareSolverr+proxy per il recupero del cookie `cf_clearance` (semplificazione, il path Puppeteer diretto è sufficiente); rimossa dipendenza `flareSolverrGetCookies`

---

## [1.0.3] — 2026-03-04

### Fixed
- `vercel.json` — added `api/index.js` wrapper to satisfy Vercel `builds` convention
- `vercel.json` — reverted to `builds`-only format (no `functions` block, no conflict)
- Memory limit adjusted to comply with Hobby plan (1024 MB cap)

---

## [1.0.2] — 2026-03-04

### Fixed
- `vercel.json` — removed `builds` + `functions` conflict; switched to `functions`-only format

---

## [1.0.1] — 2026-03-04

### Added
- `src/utils/browser.js` — unified Puppeteer launcher with `@sparticuz/chromium` for serverless
  (auto-detects Vercel/Lambda, custom path, or local Chrome)
- `api/index.js` — Vercel serverless entry point (thin wrapper over `server.js`)

### Changed
- `package.json` — replaced `puppeteer` with `puppeteer-core` + `@sparticuz/chromium`
- `src/utils/cloudflare.js` — uses shared `launchBrowser()` instead of inline Puppeteer launch
- `src/providers/kisskh.js` — uses shared `launchBrowser()`, removes redundant `_launchBrowser()`
- `vercel.json` — `builds` pointing to `api/index.js`, no more conflict
- `.vercelignore` — added to reduce deploy bundle size

---

## [1.0.0] — 2026-03-04

### Added
- Initial release of StreamFusion Mail
- **KissKH provider** (`kisskh_*` IDs)
  - API-based catalog and meta retrieval from `kisskh.co`
  - Puppeteer + stealth stream extraction (intercepts `.m3u8` with `v` param)
  - Italian subtitle decryption (AES-128-CBC, 3 key rotation)
  - Automatic Cloudflare bypass via `cf_clearance` cookie persistence
- **Rama Oriental Fansub provider** (`rama_*` IDs)
  - Cloudscraper-based catalog scraping from `ramaorientalfansub.live`
  - Series meta parsing (poster, description, status, episode count, year)
  - Episode stream extraction (iframe, `<video>`, direct link, regex fallback)
- **Aggregator** (`src/providers/index.js`)
  - ID-prefix based routing (zero ambiguity)
  - `Promise.allSettled` parallel execution with configurable timeouts
  - URL-level stream deduplication
  - Automatic fallback for unknown ID prefixes
- **Utilities**
  - `TTLCache` — in-memory LRU cache with configurable TTL and max size
  - `fetchWithCloudscraper` / `fetchWithAxios` — shared HTTP layer with retries
  - `getCloudflareCookie` — Puppeteer-based CF bypass with disk persistence
  - `decryptKisskhSubtitleFull` / `decryptKisskhSubtitleStatic` — subtitle decryption
  - `titleSimilarity` / `cleanTitleForSearch` / `extractBaseSlug` — title helpers
  - Structured JSON logger (production) / human-readable (development)
- **Server** (`server.js`)
  - Express + `stremio-addon-sdk` router
  - CORS headers for all Stremio clients
  - HTML landing page with direct install buttons
  - `/health` endpoint for uptime monitoring
  - Dual mode: `node server.js` (local) or `module.exports` (Vercel)
- **Deploy**
  - `vercel.json` — Vercel serverless (Node 18+)
  - `.env.example` — documented environment variables
  - `.gitignore` — excludes secrets, data, and build artifacts

---

## Unreleased

_Next planned improvements:_

- [ ] TMDB poster/backdrop enrichment for Rama series
- [ ] Episode thumbnail caching layer
- [ ] Rate-limiting middleware
- [ ] GitHub Actions workflow for semver bump + GitHub Release on push
