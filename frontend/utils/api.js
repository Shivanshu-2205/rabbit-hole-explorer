/**
 * Data layer — Wikidata (primary) + Wikipedia (enrichment + fallback)
 *
 * Architecture:
 *   1. Wikidata  → typed relationships (cast, director, genre, participants…)
 *   2. Wikipedia → summaries, thumbnails, descriptions for every node
 *   3. Wikipedia search → fallback when Wikidata has sparse data
 *
 * No API keys required. All endpoints are public and CORS-enabled.
 */

// ─── endpoints ─────────────────────────────────────────────────────────────
const WP_REST    = 'https://en.wikipedia.org/api/rest_v1';
const WP_ACTION  = 'https://en.wikipedia.org/w/api.php';
const WD_ACTION  = 'https://www.wikidata.org/w/api.php';

// ─── rate-limit-aware fetch ───────────────────────────────────────────────
// Wikipedia returns 429 with a Retry-After header when rate limited.
// We wait the specified time and retry once before giving up.
async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;
    // Rate limited — read Retry-After header (seconds) or default to 5s
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
    const waitMs = Math.min(retryAfter * 1000, 10000); // cap at 10s
    await new Promise(r => setTimeout(r, waitMs));
  }
  // Final attempt — return whatever we get
  return fetch(url, options);
}

// ─── app category system ───────────────────────────────────────────────────
const CAT_RULES = [
  { cat: 'mathematics', re: /math|calculus|algebra|geometry|statistics|probability|theorem|number|topology|logic/i },
  { cat: 'science',     re: /physics|chemistry|biology|quantum|evolution|genetics|molecule|atom|thermodynam|relativity|neuroscien/i },
  { cat: 'technology',  re: /computer|software|hardware|internet|algorithm|AI|machine learning|neural|robot|cipher|cryptograph/i },
  { cat: 'history',     re: /history|war|empire|ancient|medieval|revolution|dynasty|century|civilisation|civilization|archaeological/i },
  { cat: 'philosophy',  re: /philosophy|ethics|ontology|epistemology|consciousness|mind|existential|metaphysics|logic/i },
  { cat: 'arts',        re: /music|art|film|literature|poetry|theatre|theater|painting|architecture|jazz|classical|novel/i },
  { cat: 'nature',      re: /ecology|ecosystem|ocean|forest|climate|weather|animal|plant|species|biodiversity|geology/i },
  { cat: 'society',     re: /society|culture|politics|economics|psychology|sociology|religion|language|anthropology/i },
];
const CAT_COLORS = {
  mathematics: '#22d3ee', science: '#4af0d0', technology: '#4a9eff',
  history:     '#ffb347', philosophy: '#c084fc', arts: '#f472b6',
  nature:      '#4ade80', society: '#fb923c',   other: '#a78bfa',
};
const CAT_ICONS = {
  mathematics: '∑', science: '🔬', technology: '💻', history: '📜',
  philosophy: '🧠', arts: '🎨',   nature: '🌿',     society: '🏛️', other: '🔵',
};
function detectCategory(title, description = '') {
  const text = `${title} ${description}`;
  for (const { cat, re } of CAT_RULES) if (re.test(text)) return cat;
  return 'other';
}
const toSlug = (t) => encodeURIComponent(t.trim().replace(/ /g, '_'));

// ══════════════════════════════════════════════════════════════════════════
// ─── WIKIPEDIA HELPERS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

async function wpSummary(title) {
  const res = await fetchWithRetry(`${WP_REST}/page/summary/${toSlug(title)}`, {
    headers: { 'Api-User-Agent': 'RabbitHoleExplorer/1.0' },
  });
  if (!res.ok) throw new Error(`No Wikipedia page for "${title}"`);
  return res.json();
}

async function wpSearch(query) {
  const params = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query,
    srnamespace: 0, srlimit: 1, format: 'json', origin: '*',
  });
  const res  = await fetchWithRetry(`${WP_ACTION}?${params}`);
  const data = await res.json();
  const hits = data?.query?.search;
  if (!hits?.length) throw new Error(`No results for "${query}"`);
  return hits[0].title;
}

async function wpSearchMulti(query, limit = 8) {
  const params = new URLSearchParams({
    action: 'query', list: 'search', srsearch: query,
    srnamespace: 0, srlimit: limit, format: 'json', origin: '*',
  });
  const res  = await fetchWithRetry(`${WP_ACTION}?${params}`);
  const data = await res.json();
  return (data?.query?.search || []).map(r => r.title);
}

async function wpLinks(title, limit = 40) {
  const params = new URLSearchParams({
    action: 'query', titles: title, prop: 'links',
    pllimit: limit, plnamespace: 0, format: 'json', origin: '*',
  });
  const res  = await fetchWithRetry(`${WP_ACTION}?${params}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});
  if (!pages.length) return [];
  return (pages[0].links || [])
    .map(l => l.title)
    .filter(l => !/^(Wikipedia|Help|Template|Category|Portal|File|Talk|User):/i.test(l));
}

// Build a full node object from a Wikipedia summary response
function summaryToNode(summary, depth = 1, isCenter = false) {
  const cat  = detectCategory(summary.title, summary.extract || '');
  const tags = summary.title.split(/[\s,\u2013\-]+/).slice(0, 3).map(w => w.toLowerCase()).filter(w => w.length > 3);
  return {
    id:               summary.key || summary.title.replace(/ /g, '_'),
    name:             summary.title,
    description:      summary.extract_html
      ? summary.extract_html.replace(/<[^>]+>/g, '').slice(0, 300)
      : (summary.extract || '').slice(0, 300),
    fullDescription:  (summary.extract || '').slice(0, 1200),
    short_description:(summary.extract || '').slice(0, 120),
    category:         cat,
    color:            CAT_COLORS[cat],
    icon:             CAT_ICONS[cat],
    tags,
    depth:            isCenter ? 0 : depth,
    thumbnail:        summary.thumbnail?.source || null,
    wikiUrl:          summary.content_urls?.desktop?.page || null,
    related_topics:   [],
  };
}

// Hydrate an array of Wikipedia titles → WikiNode[]
// Fires fetches in parallel, silently drops failures
async function hydrateTitles(titles, maxNodes = 6) {
  const unique = [...new Set(titles)].slice(0, maxNodes * 2);
  const results = await Promise.allSettled(unique.map(t => wpSummary(t)));
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => summaryToNode(r.value, 1))
    .slice(0, maxNodes);
}

// ══════════════════════════════════════════════════════════════════════════
// ─── WIKIDATA HELPERS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

/**
 * Given a Wikipedia article title, get the Wikidata QID and all claims.
 * Returns null if not found.
 *
 * API: wbgetentities with sites=enwiki&titles=…&props=claims|info
 * Response path: data.entities[QID].claims
 * Each claim: claims[PID][i].mainsnak.datavalue.value
 *   - for item values: { "entity-type": "item", "id": "Q123" }
 *   - for string/time values: plain string or time object
 */
async function wdGetEntity(wpTitle) {
  try {
    const params = new URLSearchParams({
      action:   'wbgetentities',
      sites:    'enwiki',
      titles:   wpTitle,
      props:    'claims|labels|descriptions',
      languages:'en',
      format:   'json',
      origin:   '*',
    });
    const res  = await fetchWithRetry(`${WD_ACTION}?${params}`);
    const data = await res.json();
    const entities = data?.entities || {};
    // Find the entity that isn't "-1" (missing)
    const entity = Object.values(entities).find(e => e.id && e.id !== '-1');
    if (!entity) return null;
    return entity;
  } catch {
    return null;
  }
}

/**
 * Given a Wikidata QID, get the English Wikipedia title via sitelinks.
 * Returns null if no enwiki sitelink exists.
 */
async function wdQidToWpTitle(qid) {
  try {
    const params = new URLSearchParams({
      action:   'wbgetentities',
      ids:      qid,
      props:    'sitelinks',
      sitefilter: 'enwiki',
      format:   'json',
      origin:   '*',
    });
    const res  = await fetchWithRetry(`${WD_ACTION}?${params}`);
    const data = await res.json();
    return data?.entities?.[qid]?.sitelinks?.enwiki?.title || null;
  } catch {
    return null;
  }
}

/**
 * Get the English label for a Wikidata QID.
 * Used to name nodes that don't have a Wikipedia article.
 */
async function wdGetLabel(qid) {
  try {
    const params = new URLSearchParams({
      action:   'wbgetentities',
      ids:      qid,
      props:    'labels',
      languages:'en',
      format:   'json',
      origin:   '*',
    });
    const res  = await fetchWithRetry(`${WD_ACTION}?${params}`);
    const data = await res.json();
    return data?.entities?.[qid]?.labels?.en?.value || null;
  } catch {
    return null;
  }
}

/**
 * Extract item QIDs from a Wikidata claims property.
 * claims[PID] is an array of statement objects.
 * We only want mainsnak datatype "wikibase-item" with a QID value.
 */
function extractQids(claims, pid) {
  const statements = claims?.[pid] || [];
  return statements
    .filter(s => s?.mainsnak?.snaktype === 'value' && s?.mainsnak?.datavalue?.type === 'wikibase-entityid')
    .map(s => s.mainsnak.datavalue.value.id)
    .filter(Boolean);
}

/**
 * Given a list of Wikidata QIDs, resolve them to Wikipedia titles in batch.
 * Returns array of titles (skips QIDs with no enwiki sitelink).
 * Batches up to 50 QIDs per request (Wikidata API limit).
 */
async function wdQidsBatchToWpTitles(qids) {
  if (!qids.length) return [];
  const unique = [...new Set(qids)].slice(0, 50);
  try {
    const params = new URLSearchParams({
      action:     'wbgetentities',
      ids:        unique.join('|'),
      props:      'sitelinks',
      sitefilter: 'enwiki',
      format:     'json',
      origin:     '*',
    });
    const res  = await fetchWithRetry(`${WD_ACTION}?${params}`);
    const data = await res.json();
    const titles = [];
    for (const qid of unique) {
      const title = data?.entities?.[qid]?.sitelinks?.enwiki?.title;
      if (title) titles.push(title);
    }
    return titles;
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ─── ENTITY TYPE DETECTION (from Wikidata P31 "instance of") ─────────────
// ══════════════════════════════════════════════════════════════════════════

/**
 * Wikidata Q-codes for entity type detection via P31 (instance of).
 *
 * We check the P31 QIDs directly — no string matching, no guessing.
 * Each bucket lists QIDs that mean "this is a ___".
 */
const ENTITY_TYPE_QIDS = {
  // Films & shows
  FILM_SHOW: new Set([
    'Q11424',   // film
    'Q24856',   // film series
    'Q5398426', // television series
    'Q1366112', // television program
    'Q506240',  // television film
    'Q63952888',// television mini-series
    'Q21191270',// television series episode
    'Q7725634', // literary work (catch-all for adaptations)
    'Q2431196', // animated film
    'Q29168811',// animated television series
    'Q20650540',// documentary film
  ]),
  // Music
  MUSIC: new Set([
    'Q482994',  // album
    'Q105543609',// music album
    'Q215380',  // musical group
    'Q177220',  // singer
    'Q639669',  // musician
    'Q7302866', // music video
    'Q134556',  // single (music)
    'Q55850593',// music release group
    'Q207628',  // musical work
  ]),
  // Real people
  PERSON: new Set([
    'Q5',       // human
    'Q15632617',// fictional human (handle separately but still person-like)
  ]),
  // Fictional characters
  FICTIONAL_PERSON: new Set([
    'Q15632617',// fictional human
    'Q95074',   // fictional character
    'Q3658341', // literary character
    'Q21070568',// possibly fictional person
  ]),
  // Crime events
  CRIME_EVENT: new Set([
    'Q149086',  // homicide
    'Q833',     // murder
    'Q1137085', // crime
    'Q3519302', // massacre
    'Q2223653', // kidnapping
    'Q2742737', // assault
    'Q28868623',// criminal act
    'Q3030248', // rape
    'Q179057',  // terrorist attack
  ]),
  // Places
  PLACE: new Set([
    'Q515',     // city
    'Q6256',    // country
    'Q3624078', // sovereign state
    'Q161524',  // capital city
    'Q188509',  // suburb
    'Q82794',   // geographic region
    'Q23442',   // island
    'Q39816',   // valley
    'Q8502',    // mountain
    'Q1549591', // big city
    'Q902814',  // populated place
    'Q3957',    // town
    'Q532',     // village
  ]),
  // Technology
  TECHNOLOGY: new Set([
    'Q7397',    // software
    'Q9143',    // programming language
    'Q68',      // computer
    'Q17155032',// application software
    'Q20136634',// web application
    'Q166142',  // application
    'Q2877143', // computing platform
    'Q9174',    // operating system
    'Q35127',   // website
    'Q1301371', // computer network
  ]),
  // Historical events
  HISTORICAL_EVENT: new Set([
    'Q198',     // war
    'Q188055',  // armed conflict
    'Q178561',  // battle
    'Q3839081', // historical event
    'Q1190554', // occurrence
    'Q182832',  // revolution
    'Q2990859', // insurgency
    'Q217602',  // military operation
    'Q891568',  // political scandal
  ]),
  // Organizations
  ORGANIZATION: new Set([
    'Q4830453', // business
    'Q783794',  // company
    'Q43229',   // organization
    'Q163740',  // non-profit
    'Q31855',   // institution
    'Q3918',    // university
    'Q7278',    // political party
    'Q48799',   // government agency
  ]),
  // Sports
  SPORT: new Set([
    'Q476028',  // association football club
    'Q12973014',// sports team
    'Q13406554',// sports competition
    'Q4438121', // sports season
    'Q2156831', // sports organization
    'Q847017',  // sports club
  ]),
  // Concepts
  CONCEPT: new Set([
    'Q151885',  // concept
    'Q2695280', // technique
    'Q11862829',// academic discipline
    'Q35120',   // entity (very abstract)
    'Q16722960',// theory
    'Q4026292', // activity
    'Q1914636', // activity (duplicate)
  ]),
};

function detectEntityTypeFromQids(p31Qids) {
  if (!p31Qids?.length) return 'OTHER';
  const qidSet = new Set(p31Qids);

  // Check in priority order — most specific first
  for (const qid of qidSet) {
    if (ENTITY_TYPE_QIDS.CRIME_EVENT.has(qid))       return 'CRIME_EVENT';
    if (ENTITY_TYPE_QIDS.FICTIONAL_PERSON.has(qid))  return 'FICTIONAL_PERSON';
    if (ENTITY_TYPE_QIDS.FILM_SHOW.has(qid))         return 'FILM_SHOW';
    if (ENTITY_TYPE_QIDS.MUSIC.has(qid))             return 'MUSIC';
    if (ENTITY_TYPE_QIDS.PERSON.has(qid))            return 'PERSON';
    if (ENTITY_TYPE_QIDS.PLACE.has(qid))             return 'PLACE';
    if (ENTITY_TYPE_QIDS.TECHNOLOGY.has(qid))        return 'TECHNOLOGY';
    if (ENTITY_TYPE_QIDS.HISTORICAL_EVENT.has(qid))  return 'HISTORICAL_EVENT';
    if (ENTITY_TYPE_QIDS.ORGANIZATION.has(qid))      return 'ORGANIZATION';
    if (ENTITY_TYPE_QIDS.SPORT.has(qid))             return 'SPORT';
    if (ENTITY_TYPE_QIDS.CONCEPT.has(qid))           return 'CONCEPT';
  }
  return 'OTHER';
}

// ══════════════════════════════════════════════════════════════════════════
// ─── WIKIDATA PROPERTY FETCHERS ───────────────────────────────────────────
// Each returns an array of Wikipedia titles, ready to hydrate.
// ══════════════════════════════════════════════════════════════════════════

// P161 = cast member
async function wdGetCast(claims) {
  const qids = extractQids(claims, 'P161');
  return wdQidsBatchToWpTitles(qids);
}

// P57 = director
async function wdGetDirectors(claims) {
  const qids = extractQids(claims, 'P57');
  return wdQidsBatchToWpTitles(qids);
}

// P58 = screenwriter
async function wdGetWriters(claims) {
  const qids = extractQids(claims, 'P58');
  return wdQidsBatchToWpTitles(qids);
}

// P136 = genre
async function wdGetGenres(claims) {
  const qids = extractQids(claims, 'P136');
  return wdQidsBatchToWpTitles(qids);
}

// P179 = part of the series
async function wdGetSeries(claims) {
  const qids = extractQids(claims, 'P179');
  return wdQidsBatchToWpTitles(qids);
}

// P674 = characters (fictional characters in a work)
async function wdGetCharacters(claims) {
  const qids = extractQids(claims, 'P674');
  return wdQidsBatchToWpTitles(qids);
}

// P264 = record label
async function wdGetRecordLabel(claims) {
  const qids = extractQids(claims, 'P264');
  return wdQidsBatchToWpTitles(qids);
}

// P162 = producer (music)
async function wdGetProducers(claims) {
  const qids = extractQids(claims, 'P162');
  return wdQidsBatchToWpTitles(qids);
}

// P175 = performer
async function wdGetPerformers(claims) {
  const qids = extractQids(claims, 'P175');
  return wdQidsBatchToWpTitles(qids);
}

// P86 = composer
async function wdGetComposers(claims) {
  const qids = extractQids(claims, 'P86');
  return wdQidsBatchToWpTitles(qids);
}

// P800 = notable work
async function wdGetNotableWorks(claims) {
  const qids = extractQids(claims, 'P800');
  return wdQidsBatchToWpTitles(qids);
}

// P106 = occupation
async function wdGetOccupations(claims) {
  const qids = extractQids(claims, 'P106');
  return wdQidsBatchToWpTitles(qids);
}

// P27 = country of citizenship
async function wdGetCountry(claims) {
  const qids = extractQids(claims, 'P27');
  return wdQidsBatchToWpTitles(qids);
}

// P19 = place of birth
async function wdGetBirthPlace(claims) {
  const qids = extractQids(claims, 'P19');
  return wdQidsBatchToWpTitles(qids);
}

// P69 = educated at
async function wdGetEducation(claims) {
  const qids = extractQids(claims, 'P69');
  return wdQidsBatchToWpTitles(qids);
}

// P1344 = participant in (for crime victims/perpetrators)
async function wdGetParticipantIn(claims) {
  const qids = extractQids(claims, 'P1344');
  return wdQidsBatchToWpTitles(qids);
}

// P276 = location
async function wdGetLocation(claims) {
  const qids = extractQids(claims, 'P276');
  return wdQidsBatchToWpTitles(qids);
}

// P17 = country (for events/places)
async function wdGetEventCountry(claims) {
  const qids = extractQids(claims, 'P17');
  return wdQidsBatchToWpTitles(qids);
}

// P1441 = present in work (for fictional characters — what show/book are they in)
async function wdGetPresentInWork(claims) {
  const qids = extractQids(claims, 'P1441');
  return wdQidsBatchToWpTitles(qids);
}

// P725 = voice actor
async function wdGetVoiceActors(claims) {
  const qids = extractQids(claims, 'P725');
  return wdQidsBatchToWpTitles(qids);
}

// P364 = original language
async function wdGetOriginalLanguage(claims) {
  const qids = extractQids(claims, 'P364');
  return wdQidsBatchToWpTitles(qids);
}

// P495 = country of origin
async function wdGetCountryOfOrigin(claims) {
  const qids = extractQids(claims, 'P495');
  return wdQidsBatchToWpTitles(qids);
}

// P159 = headquarters location (organizations)
async function wdGetHeadquarters(claims) {
  const qids = extractQids(claims, 'P159');
  return wdQidsBatchToWpTitles(qids);
}

// P112 = founded by
async function wdGetFounders(claims) {
  const qids = extractQids(claims, 'P112');
  return wdQidsBatchToWpTitles(qids);
}

// P452 = industry
async function wdGetIndustry(claims) {
  const qids = extractQids(claims, 'P452');
  return wdQidsBatchToWpTitles(qids);
}

// P641 = sport
async function wdGetSport(claims) {
  const qids = extractQids(claims, 'P641');
  return wdQidsBatchToWpTitles(qids);
}

// P118 = league
async function wdGetLeague(claims) {
  const qids = extractQids(claims, 'P118');
  return wdQidsBatchToWpTitles(qids);
}

// P131 = located in admin territory
async function wdGetAdminTerritory(claims) {
  const qids = extractQids(claims, 'P131');
  return wdQidsBatchToWpTitles(qids);
}

// ══════════════════════════════════════════════════════════════════════════
// ─── ANGLE BUILDERS ───────────────────────────────────────────────────────
// Each entity type has a function that takes (claims, wpTitle) and returns
// an array of angle objects: { label, icon, color, titles[] }
// Titles are then hydrated to full nodes after all angles are computed.
// ══════════════════════════════════════════════════════════════════════════

async function buildAngles_FilmShow(claims, wpTitle) {
  const [cast, directors, writers, genres, characters, series] = await Promise.all([
    wdGetCast(claims),
    wdGetDirectors(claims),
    wdGetWriters(claims),
    wdGetGenres(claims),
    wdGetCharacters(claims),
    wdGetSeries(claims),
  ]);

  // Cast & Crew combines cast + directors + writers
  const crew = [...new Set([...directors, ...writers])];
  const castAndCrew = [...cast, ...crew];

  // Similar works — search-based since Wikidata doesn't have a "similar films" property
  const similarTitles = await wpSearchMulti(`${wpTitle} similar films genre`, 8);

  const angles = [
    { label: 'Cast & Crew',    icon: '👤', color: '#00f5ff',  titles: castAndCrew },
    { label: 'Characters',     icon: '🎭', color: '#bf5fff',  titles: characters },
    { label: 'Themes & Genre', icon: '💡', color: '#f472b6',  titles: genres },
    { label: 'Similar Works',  icon: '🎬', color: '#ffb347',  titles: similarTitles },
  ];

  // Add series angle if this is part of one
  if (series.length) {
    angles.push({ label: 'Series', icon: '📺', color: '#4af0d0', titles: series });
  }

  return angles;
}

async function buildAngles_Music(claims, wpTitle) {
  const [performers, composers, genres, series, producers] = await Promise.all([
    wdGetPerformers(claims),
    wdGetComposers(claims),
    wdGetGenres(claims),
    wdGetSeries(claims),
    wdGetProducers(claims),
  ]);

  // Discography — search for other works by same artist
  const discographyTitles = await wpSearchMulti(`${wpTitle} discography albums`, 8);
  const influencesTitles  = await wpSearchMulti(`${wpTitle} genre influences similar`, 8);

  return [
    { label: 'Artists',        icon: '🎤', color: '#f472b6',  titles: [...performers, ...composers, ...producers] },
    { label: 'Genre & Style',  icon: '💡', color: '#bf5fff',  titles: [...genres, ...influencesTitles] },
    { label: 'Discography',    icon: '🎵', color: '#00f5ff',  titles: discographyTitles },
    { label: 'Series / Era',   icon: '🌍', color: '#ffb347',  titles: series },
  ];
}

async function buildAngles_Person(claims, wpTitle) {
  const [notableWorks, occupations, country, birthPlace, education] = await Promise.all([
    wdGetNotableWorks(claims),
    wdGetOccupations(claims),
    wdGetCountry(claims),
    wdGetBirthPlace(claims),
    wdGetEducation(claims),
  ]);

  // Context — search-based
  const contextTitles = await wpSearchMulti(`${wpTitle} era historical context`, 8);
  const relatedPeople = await wpSearchMulti(`${wpTitle} colleagues collaborators`, 8);

  return [
    { label: 'Notable Works',   icon: '⚡', color: '#00f5ff',  titles: notableWorks },
    { label: 'Life & Context',  icon: '🌍', color: '#ffb347',  titles: [...country, ...birthPlace, ...education, ...contextTitles] },
    { label: 'Field & Work',    icon: '🔬', color: '#4af0d0',  titles: occupations },
    { label: 'Connected People',icon: '🔗', color: '#39ff8f',  titles: relatedPeople },
  ];
}

async function buildAngles_FictionalPerson(claims, wpTitle) {
  // For fictional characters, the most useful thing is the work they appear in
  const [presentInWork, voiceActors] = await Promise.all([
    wdGetPresentInWork(claims),
    wdGetVoiceActors(claims),
  ]);

  // Search for the actors who play this character and related characters
  const actorTitles    = await wpSearchMulti(`${wpTitle} actor portrayed by`, 8);
  const relatedCharTitles = await wpSearchMulti(`${wpTitle} related characters same show`, 8);

  return [
    { label: 'Appears In',      icon: '📺', color: '#f472b6',  titles: presentInWork },
    { label: 'Portrayed By',    icon: '👤', color: '#00f5ff',  titles: [...actorTitles, ...voiceActors] },
    { label: 'Related Characters', icon: '🎭', color: '#bf5fff', titles: relatedCharTitles },
  ];
}

async function buildAngles_CrimeEvent(claims, wpTitle) {
  const [location, country] = await Promise.all([
    wdGetLocation(claims),
    wdGetEventCountry(claims),
  ]);

  // All other angles are search-based — Wikidata crime data is sparse
  const [peopleTitles, legalTitles, contextTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} perpetrator victim people involved`, 8),
    wpSearchMulti(`${wpTitle} trial conviction sentence legal`, 8),
    wpSearchMulti(`${wpTitle} social impact media reaction aftermath`, 8),
  ]);

  return [
    { label: 'The Incident',    icon: '📋', color: '#ff6b6b',  titles: await wpSearchMulti(`${wpTitle} events what happened`, 8) },
    { label: 'People Involved', icon: '👥', color: '#00f5ff',  titles: peopleTitles },
    { label: 'Legal Outcome',   icon: '⚖️', color: '#ffb347',  titles: legalTitles },
    { label: 'Context',         icon: '🌍', color: '#4af0d0',  titles: [...location, ...country, ...contextTitles] },
  ];
}

async function buildAngles_Place(claims, wpTitle) {
  const [adminTerritory, country] = await Promise.all([
    wdGetAdminTerritory(claims),
    wdGetEventCountry(claims),
  ]);

  const [historyTitles, peopleTitles, cultureTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} history founding historical`, 8),
    wpSearchMulti(`${wpTitle} notable people born from famous`, 8),
    wpSearchMulti(`${wpTitle} culture traditions festivals landmarks`, 8),
  ]);

  return [
    { label: 'Geography',      icon: '🗺️', color: '#4ade80',  titles: [...adminTerritory, ...country] },
    { label: 'History',        icon: '📜', color: '#ffb347',  titles: historyTitles },
    { label: 'Notable People', icon: '👥', color: '#00f5ff',  titles: peopleTitles },
    { label: 'Culture & Life', icon: '🏛️', color: '#fb923c',  titles: cultureTitles },
  ];
}

async function buildAngles_Technology(claims, wpTitle) {
  const [genres, country] = await Promise.all([
    wdGetGenres(claims),     // genre here = type of technology
    wdGetCountryOfOrigin(claims),
  ]);

  const [howTitles, historyTitles, altTitles, impactTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} how works mechanism architecture`, 8),
    wpSearchMulti(`${wpTitle} history invention origin created`, 8),
    wpSearchMulti(`${wpTitle} alternative competitor comparison versus`, 8),
    wpSearchMulti(`${wpTitle} uses applications impact society`, 8),
  ]);

  return [
    { label: 'How It Works',    icon: '🔧', color: '#4a9eff',  titles: howTitles },
    { label: 'History',         icon: '📜', color: '#ffb347',  titles: [...historyTitles, ...country] },
    { label: 'Alternatives',    icon: '🆚', color: '#bf5fff',  titles: altTitles },
    { label: 'Impact & Use',    icon: '🌍', color: '#4af0d0',  titles: impactTitles },
  ];
}

async function buildAngles_HistoricalEvent(claims, wpTitle) {
  const [location, country] = await Promise.all([
    wdGetLocation(claims),
    wdGetEventCountry(claims),
  ]);

  const [peopleTitles, causesTitles, aftermathTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} key figures people leaders involved`, 8),
    wpSearchMulti(`${wpTitle} causes reasons background context`, 8),
    wpSearchMulti(`${wpTitle} aftermath consequences legacy impact`, 8),
  ]);

  return [
    { label: 'What Happened',   icon: '📋', color: '#ff6b6b',  titles: [...location, ...country] },
    { label: 'Key People',      icon: '👥', color: '#00f5ff',  titles: peopleTitles },
    { label: 'Causes',          icon: '🌍', color: '#ffb347',  titles: causesTitles },
    { label: 'Aftermath',       icon: '🔮', color: '#bf5fff',  titles: aftermathTitles },
  ];
}

async function buildAngles_Organization(claims, wpTitle) {
  const [founders, headquarters, industry] = await Promise.all([
    wdGetFounders(claims),
    wdGetHeadquarters(claims),
    wdGetIndustry(claims),
  ]);

  const [peopleTitles, historyTitles, impactTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} CEO founder leader executive key people`, 8),
    wpSearchMulti(`${wpTitle} history founded milestones development`, 8),
    wpSearchMulti(`${wpTitle} industry competitors market impact`, 8),
  ]);

  return [
    { label: 'Key People',      icon: '👤', color: '#00f5ff',  titles: [...founders, ...peopleTitles] },
    { label: 'History',         icon: '📜', color: '#ffb347',  titles: historyTitles },
    { label: 'Industry',        icon: '🏢', color: '#4a9eff',  titles: [...industry, ...headquarters, ...impactTitles] },
  ];
}

async function buildAngles_Sport(claims, wpTitle) {
  const [sport, league] = await Promise.all([
    wdGetSport(claims),
    wdGetLeague(claims),
  ]);

  const [playersTitles, rivalsTitles, historyTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} players roster athletes coaches`, 8),
    wpSearchMulti(`${wpTitle} rivals opponents competition teams`, 8),
    wpSearchMulti(`${wpTitle} history founded achievements records`, 8),
  ]);

  return [
    { label: 'Players',         icon: '👤', color: '#00f5ff',  titles: playersTitles },
    { label: 'Rivals & League', icon: '🆚', color: '#ff6b6b',  titles: [...league, ...rivalsTitles] },
    { label: 'History',         icon: '📜', color: '#bf5fff',  titles: historyTitles },
    { label: 'Sport & Rules',   icon: '🏆', color: '#ffb347',  titles: sport },
  ];
}

async function buildAngles_Concept(claims, wpTitle) {
  const [historyTitles, appTitles, debateTitles, coreTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} history origin who coined development`, 8),
    wpSearchMulti(`${wpTitle} applications uses examples practical`, 8),
    wpSearchMulti(`${wpTitle} criticism debate controversy opposing`, 8),
    wpSearchMulti(`${wpTitle} definition explained overview`, 8),
  ]);

  return [
    { label: 'The Idea',        icon: '💡', color: '#c084fc',  titles: coreTitles },
    { label: 'Origins',         icon: '📜', color: '#ffb347',  titles: historyTitles },
    { label: 'Applications',    icon: '🔬', color: '#4af0d0',  titles: appTitles },
    { label: 'Debate',          icon: '🤔', color: '#fb923c',  titles: debateTitles },
  ];
}

async function buildAngles_Other(claims, wpTitle) {
  const [overviewTitles, historyTitles, contextTitles] = await Promise.all([
    wpSearchMulti(`${wpTitle} overview related`, 8),
    wpSearchMulti(`${wpTitle} history origin development`, 8),
    wpSearchMulti(`${wpTitle} context significance impact`, 8),
  ]);

  return [
    { label: 'Overview',        icon: '🔵', color: '#a78bfa',  titles: overviewTitles },
    { label: 'History',         icon: '📜', color: '#ffb347',  titles: historyTitles },
    { label: 'Context',         icon: '🌍', color: '#4af0d0',  titles: contextTitles },
  ];
}

// ══════════════════════════════════════════════════════════════════════════
// ─── getTopicAngles — the main export ────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════

/**
 * Given a Wikipedia article title, fetch structured angle data using
 * Wikidata as the primary source for typed relationships.
 *
 * Returns: [{ label, icon, color, nodes: WikiNode[] }, ...]
 * Returns [] on failure → RightPanel falls back to connectedNodes.
 */
export async function getTopicAngles(wpTitle) {
  try {
    // 1. Get Wikidata entity for this Wikipedia article
    const entity = await wdGetEntity(wpTitle);

    // 2. Determine entity type from P31 (instance of)
    const p31Qids    = entity ? extractQids(entity.claims, 'P31') : [];
    const entityType = detectEntityTypeFromQids(p31Qids);

    const claims = entity?.claims || {};

    // 3. Build angle title lists based on entity type
    let rawAngles = [];
    switch (entityType) {
      case 'FILM_SHOW':        rawAngles = await buildAngles_FilmShow(claims, wpTitle);        break;
      case 'MUSIC':            rawAngles = await buildAngles_Music(claims, wpTitle);            break;
      case 'PERSON':           rawAngles = await buildAngles_Person(claims, wpTitle);           break;
      case 'FICTIONAL_PERSON': rawAngles = await buildAngles_FictionalPerson(claims, wpTitle);  break;
      case 'CRIME_EVENT':      rawAngles = await buildAngles_CrimeEvent(claims, wpTitle);       break;
      case 'PLACE':            rawAngles = await buildAngles_Place(claims, wpTitle);            break;
      case 'TECHNOLOGY':       rawAngles = await buildAngles_Technology(claims, wpTitle);       break;
      case 'HISTORICAL_EVENT': rawAngles = await buildAngles_HistoricalEvent(claims, wpTitle);  break;
      case 'ORGANIZATION':     rawAngles = await buildAngles_Organization(claims, wpTitle);     break;
      case 'SPORT':            rawAngles = await buildAngles_Sport(claims, wpTitle);            break;
      case 'CONCEPT':          rawAngles = await buildAngles_Concept(claims, wpTitle);          break;
      default:                 rawAngles = await buildAngles_Other(claims, wpTitle);            break;
    }

    // 4. Hydrate each angle's title list → full WikiNode objects (in parallel)
    const hydratedAngles = await Promise.allSettled(
      rawAngles.map(async (angle) => {
        // Deduplicate and remove the source title
        const seen   = new Set([wpTitle, wpTitle.replace(/ /g, '_')]);
        const unique = [];
        for (const t of (angle.titles || [])) {
          if (t && !seen.has(t)) { seen.add(t); unique.push(t); }
          if (unique.length >= 12) break;
        }
        const nodes = await hydrateTitles(unique, 6);
        return { label: angle.label, icon: angle.icon, color: angle.color, nodes };
      })
    );

    // 5. Keep only angles with at least 2 nodes
    return hydratedAngles
      .filter(r => r.status === 'fulfilled' && r.value.nodes.length >= 2)
      .map(r => r.value);

  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ─── GRAPH EXPANSION (searchTopic + getRelatedTopics) ─────────────────────
// Also upgraded: uses Wikipedia search instead of broken category members
// ══════════════════════════════════════════════════════════════════════════

export async function searchTopic(query) {
  const exactTitle = await wpSearch(query);
  const summary    = await wpSummary(exactTitle);
  const center     = summaryToNode(summary, 0, true);

  // Use Wikipedia search for initial children — relevant, not random
  const childTitles = await wpSearchMulti(`${exactTitle} related overview`, 10);

  // Also pull inline links as secondary source
  const inlineLinks = await wpLinks(exactTitle, 20);

  // Merge, deduplicate, hydrate
  const seen = new Set([exactTitle, exactTitle.replace(/ /g, '_')]);
  const candidates = [];
  for (const t of [...childTitles, ...inlineLinks]) {
    if (!seen.has(t)) { seen.add(t); candidates.push(t); }
    if (candidates.length >= 12) break;
  }

  const children = await hydrateTitles(candidates, 6);
  center.related_topics = children.map(c => c.name);

  const nodes = [center, ...children];
  const edges = children.map(c => ({
    id: `${center.id}→${c.id}`, source: center.id, target: c.id,
  }));

  return { graph: { nodes, edges }, centralTopic: center, query };
}

export async function getTopicById(id) {
  const title = id.replace(/_/g, ' ');
  try {
    const summary = await wpSummary(title);
    const node    = summaryToNode(summary, 0, true);
    const links   = await wpLinks(title, 20);
    node.related_topics = links.slice(0, 8);
    return { topic: node };
  } catch {
    return { topic: { id, name: title, description: 'Could not load Wikipedia data.', related_topics: [] } };
  }
}

export async function getRelatedTopics(id) {
  const title = id.replace(/_/g, ' ');

  // Search-based expansion — no more broken category members
  const [searchTitles, inlineLinks] = await Promise.all([
    wpSearchMulti(`${title} related`, 10),
    wpLinks(title, 20),
  ]);

  const seen = new Set([title, id]);
  const candidates = [];
  for (const t of [...searchTitles, ...inlineLinks]) {
    if (!seen.has(t)) { seen.add(t); candidates.push(t); }
    if (candidates.length >= 12) break;
  }

  const children = await hydrateTitles(candidates, 6);
  const edges = children.map(c => ({
    id: `${id}→${c.id}`, source: id, target: c.id,
  }));

  return { nodes: children, edges, parentId: id };
}

// ─── Backend API helpers ──────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function apiFetch(path, options = {}) {
  const { token, ...fetchOpts } = options;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res  = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data.data;
}

export async function apiLogin(e, p)    { return apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify({ email: e, password: p }) }); }
export async function apiRegister(e, p) { return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email: e, password: p }) }); }
export async function apiLogout(token)  { return apiFetch('/auth/logout',   { method: 'POST', token }); }
export async function apiGetProfile(token)          { return apiFetch('/auth/me',      { token }); }
export async function apiGetFavourites(token)       { return apiFetch('/favourites',   { token }); }
export async function apiSaveFavourite(token, { title, path }) { return apiFetch('/favourites', { method: 'POST', token, body: JSON.stringify({ title, path }) }); }
export async function apiDeleteFavourite(token, id) { return apiFetch(`/favourites/${id}`, { method: 'DELETE', token }); }