/* Interactive world map of Cubination.
   Layout (which island sits where, boss star ratings) is read off the wiki's
   "Map (All Rings 2.26.26)" image; everything else (stats, drops, abilities, recipes)
   is pulled live from the wiki data. */
(() => {
  const CX = (window.CX = window.CX || {});
  const IMG_URL = "https://static.wikia.nocookie.net/cubination/images/2/25/Map_%28All_Rings_2.26.26%29.png/revision/latest?cb=20260227014524";
  const WIKI = "https://cubination.fandom.com/wiki/";

  /* ----- geometry: same units as the wiki image, so the photo overlay lines up ----- */
  const PAD = 36, PITCH = 108.1, SIZE = 96, OX = 12, IMG = 985;
  const WORLD = IMG + PAD * 2;
  const P = (i) => PAD + OX + i * PITCH;
  const C = (i) => P(i) + SIZE / 2;

  /* ----- the 9×9 grid ----- */
  const boss = (id, x, y, name, stars, lane, o = {}) => ({ id, x, y, kind: "boss", name, stars, lane, ...o });
  const TILES = [
    { id: "spawn", x: 4, y: 4, kind: "spawn", name: "Spawn", aliases: ["Spawn"] },
    boss("cyber-raider", 3, 4, "Cyber Raider", 1.5, "west", { aliases: ["Cyber Raider Island", "Cyber Raider"] }),
    boss("the-godfather", 2, 4, "The Godfather", 3, "west"),
    boss("adriano", 1, 4, "Adriano", 4, "west"),
    boss("cube-destroyer", 5, 4, "Cube Destroyer", 0.5, "east"),
    boss("pyro", 6, 4, "Pyro", 2, "east"),
    boss("guardian-of-the-sea", 7, 4, "Guardian of the Sea", 3.5, "east"),
    boss("chimera", 8, 4, "Chimera", 4.5, "east"),
    boss("raider-brute", 4, 5, "Raider Brute", 1, "south"),
    boss("litho", 4, 6, "Litho", 2.5, "south"),
    boss("cryo", 4, 7, "Cryo", 4, "south"),
    boss("architecte", 4, 8, "Architecte", 5, "south"),
    { id: "magnetizer", x: 4, y: 3, kind: "util", name: "Magnetizer", lane: "north", aliases: ["Magnetizer"] },
    { id: "repair-machine", x: 4, y: 2, kind: "util", name: "Repair Machine", lane: "north", aliases: ["Repair Machine"] },
  ];
  [[0, 0], [8, 0], [0, 8], [8, 8], [0, 4], [4, 0], [4, 1]].forEach(([x, y]) => TILES.push({ id: `locked-${x}${y}`, x, y, kind: "lock", name: "Locked", lane: "" }));
  const taken = new Set(TILES.map((t) => t.x + "," + t.y));
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (!taken.has(x + "," + y)) TILES.push({ id: `island-${x}${y}`, x, y, kind: "rand", name: "Unexplored island", lane: "" });
  TILES.forEach((t) => {
    t.ring = Math.max(Math.abs(t.x - 4), Math.abs(t.y - 4));
    t.ref = "ABCDEFGHI"[t.x] + (t.y + 1);
    t.aliases = (t.aliases || []).concat(t.kind === "boss" || t.kind === "util" ? [t.name] : []);
  });
  const byId = new Map(TILES.map((t) => [t.id, t]));
  const bosses = TILES.filter((t) => t.kind === "boss");
  const order = bosses.slice().sort((a, b) => a.stars - b.stars);   // boss ladder, easiest → hardest
  order.forEach((b, i) => (b.order = i + 1));
  const LANE = { west: ["West lane", "#b9606c"], east: ["East lane", "#6f9d84"], south: ["South lane", "#a39157"], north: ["North lane", "#8d70b5"] };
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  /* ----- boss sections from the wiki's "Bosses" page ----- */
  let sections = {};
  function readSections(raw) {
    const bp = raw.find((p) => p.title === "Bosses"); if (!bp) return {};
    const t = document.createElement("template"); t.innerHTML = bp.html;
    const out = {}; let cur = null;
    [...t.content.childNodes].forEach((n) => {
      if (n.nodeType === 1 && n.tagName === "H2") { cur = norm(n.textContent); out[cur] = { intro: [], subs: {} , key: "intro" }; return; }
      if (!cur) return;
      const s = out[cur];
      if (n.nodeType === 1 && n.tagName === "H3") { s.key = norm(n.textContent); s.subs[s.key] = []; return; }
      const html = n.nodeType === 1 ? n.outerHTML : "";
      if (!html) return;
      (s.key === "intro" ? s.intro : s.subs[s.key]).push(html);
    });
    return out;
  }
  const secFor = (t) => sections[norm(t.name)] || null;
  const plain = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g, " ").trim(); };

  /* Everything on the map becomes a searchable item too (bosses / machines that have no wiki page of their own). */
  CX.map = {
    extraPages(raw) {
      sections = readSections(raw);
      const have = new Set(raw.map((p) => norm(p.title)));
      const out = [];
      TILES.filter((t) => t.kind === "boss" || t.kind === "util").forEach((t) => {
        if (have.has(norm(t.name))) return;
        const s = secFor(t);
        const intro = s ? s.intro.join("") : "";
        const body = s ? intro + Object.entries(s.subs).filter(([k]) => k !== "music").map(([k, v]) => `<h3>${k}</h3>${v.join("")}`).join("") : "";
        const txt = plain(body);
        const where = `${t.kind === "boss" ? "Boss" : "Machine"} on the world map: ring ${t.ring}, ${t.ref}${t.kind === "boss" ? `, difficulty ${t.stars}/5` : ""}.`;
        out.push({
          title: t.name, cats: [t.kind === "boss" ? "Bosses" : "Island Mechanics"], img: null,
          summary: txt ? txt.slice(0, 220) : where + " The wiki has no details yet.", text: (txt ? txt + " " : "") + where,
          html: body, recipes: [], virtual: true, fromMap: t.id,
        });
      });
      return out;
    },
    tileFor(title) {
      const k = norm(title);
      const t = TILES.find((x) => x.aliases.some((a) => norm(a) === k));
      return t ? t.id : null;
    },
  };

  /* ----- state ----- */
  let built = false, root, stage, svg, vp, sideEl, coordEl, searchEl, resEl;
  let view = { x: 0, y: 0, k: 1 }, fit = 1, userMoved = false, selId = null, matches = new Set(), anim = 0;
  let ladderEl, done = new Set();
  try { done = new Set(JSON.parse(localStorage.getItem("cx-bosses-done") || "[]")); } catch (e) {}
  const saveDone = () => { try { localStorage.setItem("cx-bosses-done", JSON.stringify([...done])); } catch (e) {} };
  const flags = { boss: true, util: true, rand: true, lock: true, rings: false, heat: false, path: false, photo: false };

  const stars = (n) => `<span class="stars" style="--n:${n}" aria-label="${n} out of 5 stars">★★★★★</span>`;
  const starsSvg = (n, cx, y) => {
    let s = "";
    for (let i = 0; i < 5; i++) {
      const fill = n >= i + 1 ? "#ffd43b" : n >= i + 0.5 ? "url(#halfg)" : "#5b5548";
      s += `<use href="#s-star" x="${cx - 36 + i * 14.6}" y="${y}" width="14" height="14" fill="${fill}"/>`;
    }
    return s;
  };
  const heat = (st) => `hsl(${Math.round(125 - (st / 5) * 125)} 58% 42%)`;
  const laneColor = (t) => (t.kind === "boss" || t.kind === "util" ? LANE[t.lane][1] : t.kind === "spawn" ? "#6c6878" : t.kind === "lock" ? "#15120c" : "url(#chk)");

  /* ----- build the SVG ----- */
  function tileSvg(t) {
    const x = P(t.x), y = P(t.y);
    const d = (t.ring * 0.09 + (t.x * 7 + t.y * 3) % 5 * 0.012).toFixed(2);
    let g = `<rect class="plate" width="${SIZE}" height="${SIZE}" rx="4" fill="${laneColor(t)}" ${t.kind === "boss" ? `style="--heat:${heat(t.stars)}"` : ""}/>`;
    if (t.kind === "boss") {
      g += `<use href="#s-skull" x="18" y="16" width="60" height="60" fill="#f7e4e4"/>`;
      g += `<text x="48" y="14" font-size="${t.name.length <= 8 ? 15 : t.name.length <= 12 ? 13 : t.name.length <= 15 ? 11 : 9.5}">${CX.esc(t.name)}</text>`;
      g += starsSvg(t.stars, 48, 78);
      g += `<g class="donebadge"><circle cx="82" cy="82" r="13" fill="#37b24d" stroke="#0d0c0a" stroke-width="3"/><path d="M75.500 82.500l4.500 4.500 8.500-10" stroke="#fff" stroke-width="3.500" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      g += `<g class="badge hb"><circle cx="82" cy="14" r="13" fill="#0d0c0a"/><text x="82" y="19" font-size="13">${t.stars}</text></g>`;
      g += `<g class="badge ob"><circle cx="14" cy="14" r="13" fill="#ffd43b"/><text x="14" y="19" font-size="14" style="fill:#1f1c16;stroke:none">${t.order}</text></g>`;
    } else if (t.kind === "util") {
      g += `<use href="#s-gear" x="22" y="22" width="52" height="52" fill="#f3eaf9"/><text x="48" y="15" font-size="13">${CX.esc(t.name)}</text>`;
    } else if (t.kind === "spawn") {
      g += `<g class="sun"><use href="#s-sun" x="10" y="10" width="76" height="76" fill="none" stroke="#14110a"/></g><text x="48" y="14" font-size="13">SPAWN</text>`;
    } else if (t.kind === "lock") {
      g += `<path d="M0 0L96 96M24 0L96 72M48 0L96 48M72 0L96 24M0 24L72 96M0 48L48 96M0 72L24 96" stroke="#2a251a" stroke-width="3" opacity=".7"/>`;
      g += `<use href="#s-lock" x="26" y="14" width="44" height="44" fill="#ffd43b"/><text x="48" y="84" font-size="15" style="fill:#ffd43b">W.I.P</text>`;
    } else {
      g += `<text class="sub" x="48" y="90" style="fill:#fff;opacity:.5">${t.ref}</text>`;
    }
    return `<g transform="translate(${x} ${y})"><g class="tl t-${t.kind === "boss" ? "boss" : t.kind} lane-${t.lane || "x"}" data-id="${t.id}" role="button" aria-label="${CX.esc(t.name)}, ${t.ref}" style="--d:${d}s">${g}<rect class="selring" x="-5" y="-5" width="${SIZE + 10}" height="${SIZE + 10}" rx="6"/></g></g>`;
  }

  function build() {
    const E = CX.esc;
    const ringBoxes = [1, 2, 3, 4].map((r) => {
      const left = P(4 - r) - 7, w = (2 * r + 1) * PITCH - (PITCH - SIZE) + 14;
      return `<rect class="ringbox" x="${left}" y="${left}" width="${w}" height="${w}" rx="10"/><text class="ringlbl" x="${left + w / 2}" y="${left - 5}" text-anchor="middle">RING ${r}</text>`;
    }).join("");
    const pts = order.map((b) => `${C(b.x)},${C(b.y)}`);
    const labels = [...Array(9).keys()].map((i) => `<text class="glbl" x="${C(i)}" y="${PAD - 6}">${"ABCDEFGHI"[i]}</text><text class="glbl" x="${PAD - 12}" y="${C(i) + 4}">${i + 1}</text>`).join("");
    root.innerHTML = `
      <div class="mapwrap">
        <div class="maphead">
          <div><h1>World map</h1><p>All of Cubination’s islands in one place. Click a tile for details, drag to pan, scroll to zoom. Search for an item to see which bosses drop it.</p></div>
          <div class="mapsearch"><svg class="mag" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="2.6" stroke-linecap="square"/></svg>
            <input id="mapq" class="minput" type="search" placeholder="Find a boss, island or drop…" autocomplete="off" spellcheck="false"><div class="mapres" hidden></div></div>
        </div>
        <div class="maptools" role="toolbar" aria-label="Map layers">
          <button class="tg" data-f="boss" aria-pressed="true" style="--c:#b9606c"><i></i>Bosses <b>${bosses.length}</b></button>
          <button class="tg" data-f="util" aria-pressed="true" style="--c:#8d70b5"><i></i>Machines <b>2</b></button>
          <button class="tg" data-f="rand" aria-pressed="true" style="--c:#a89fb0"><i></i>Random islands <b>${TILES.filter((t) => t.kind === "rand").length}</b></button>
          <button class="tg" data-f="lock" aria-pressed="true" style="--c:#ffd43b"><i></i>Locked <b>${TILES.filter((t) => t.kind === "lock").length}</b></button>
          <span class="sepr"></span>
          <button class="tg" data-f="rings" aria-pressed="false">${CX.ICON.target || ""}Rings</button>
          <button class="tg" data-f="heat" aria-pressed="false">Difficulty heat</button>
          <button class="tg" data-f="path" aria-pressed="false">Boss order</button>
          <button class="tg" data-f="photo" aria-pressed="false">Original wiki map</button>
        </div>
        <div class="mapgrid">
          <div class="stage" id="stage">
            <svg id="msvg" viewBox="0 0 800 600" tabindex="0" role="application" aria-label="Interactive Cubination world map. Arrow keys move between islands, plus and minus zoom.">
              <defs>
                <pattern id="chk" width="96" height="96" patternUnits="userSpaceOnUse"><rect width="96" height="96" fill="#a79eb1"/><rect width="48" height="48" fill="#8d849a"/><rect x="48" y="48" width="48" height="48" fill="#8d849a"/></pattern>
                <linearGradient id="halfg"><stop offset="50%" stop-color="#ffd43b"/><stop offset="50%" stop-color="#5b5548"/></linearGradient>
                <symbol id="s-star" viewBox="0 0 24 24"><path d="M12 1.5l3.1 6.6 7.2.9-5.3 4.9 1.4 7.1L12 17.4l-6.4 3.6L7 13.9 1.7 9l7.2-.9z"/></symbol>
                <symbol id="s-skull" viewBox="0 0 24 24"><path d="M12 2C7 2 3.5 5.6 3.5 10.5c0 2.5 1 4 2.5 5.2V20h3v-2h1.5v2h3v-2H15v2h3v-4.3c1.5-1.2 2.5-2.700 2.500-5.200C20.500 5.600 17 2 12 2zM8.200 9.300a2.200 2.200 0 1 1 0 4.400 2.200 2.200 0 0 1 0-4.400zm7.600 0a2.200 2.200 0 1 1 0 4.400 2.200 2.200 0 0 1 0-4.400zM12 13.500l1.300 2.700h-2.600z"/></symbol>
                <symbol id="s-gear" viewBox="0 0 24 24"><path d="M10.300 1.500h3.400l.5 2.800 1.800.8 2.400-1.600 2.400 2.400-1.600 2.400.8 1.800 2.800.5v3.400l-2.800.5-.8 1.800 1.600 2.400-2.400 2.400-2.400-1.600-1.800.8-.5 2.800h-3.400l-.5-2.800-1.800-.8-2.400 1.600-2.400-2.400 1.600-2.400-.8-1.800-2.800-.5v-3.400l2.800-.5.8-1.800-1.600-2.400 2.400-2.400 2.400 1.600 1.800-.8zM12 8.200a3.800 3.800 0 1 0 0 7.600 3.800 3.800 0 0 0 0-7.600z" fill-rule="evenodd"/></symbol>
                <symbol id="s-lock" viewBox="0 0 24 24"><path d="M12 1.500a5 5 0 0 0-5 5V9H5.500A1.500 1.500 0 0 0 4 10.500v10A1.500 1.500 0 0 0 5.500 22h13a1.500 1.500 0 0 0 1.500-1.500v-10A1.500 1.500 0 0 0 18.500 9H17V6.500a5 5 0 0 0-5-5zm0 3a2 2 0 0 1 2 2V9h-4V6.500a2 2 0 0 1 2-2z" fill-rule="evenodd"/></symbol>
                <symbol id="s-sun" viewBox="0 0 24 24"><g stroke-width="1.100" stroke-linejoin="round"><path d="M12 .8l1.800 5.200L18 2.500l-1 5.400 5.200-1.200-3.500 4.200 4.800 2.300-5.400.7 2.500 4.800-5-2 .2 5.400-3.200-4.300-3.200 4.300.2-5.400-5 2L6.500 14l-5.400-.7 4.800-2.300-3.500-4.200L7 7.900 6 2.500l4.200 3.500z" fill="#e9e4d0"/></g><circle cx="12" cy="12" r="3.800" fill="#6c6878" stroke-width="1.600"/></symbol>
              </defs>
              <g id="vp">
                <image class="photo" href="${CX.mapImg || IMG_URL}" x="${PAD}" y="${PAD}" width="${IMG}" height="984" preserveAspectRatio="none"/>
                ${labels}
                <text class="glbl" x="${WORLD / 2}" y="${WORLD - 10}" style="font-size:14px;fill:#ffd43b">▼ S</text>
                <text class="glbl" x="${WORLD / 2}" y="14" style="font-size:14px;fill:#ffd43b">▲ N</text>
                <text class="glbl" x="${WORLD - 12}" y="${WORLD / 2}" style="font-size:14px;fill:#ffd43b" transform="rotate(90 ${WORLD - 12} ${WORLD / 2})">E ▶</text>
                <text class="glbl" x="12" y="${WORLD / 2}" style="font-size:14px;fill:#ffd43b" transform="rotate(-90 12 ${WORLD / 2})">◀ W</text>
                ${TILES.map(tileSvg).join("")}
                ${ringBoxes}
                <polyline class="pathline" points="${pts.join(" ")}"/>
              </g>
            </svg>
            <div class="zoomctl">
              <button data-z="in" aria-label="Zoom in">+</button><button data-z="out" aria-label="Zoom out">−</button>
              <button data-z="fit" aria-label="Fit whole map" title="Fit whole map">${CX.ICON.map}</button>
              <button data-z="spawn" aria-label="Centre on Spawn" title="Centre on Spawn">${CX.ICON.star}</button>
            </div>
            <div class="maphint">scroll = zoom · drag = pan · arrows = move</div>
            <div class="coord" id="mcoord">hover an island</div>
          </div>
          <aside class="ladder" id="mladder" aria-label="Boss order"></aside>
          <aside class="side" id="mside" aria-live="polite"></aside>
        </div>
      </div>`;
    stage = $("#stage"); svg = $("#msvg"); vp = $("#vp"); sideEl = $("#mside"); coordEl = $("#mcoord");
    ladderEl = $("#mladder"); searchEl = $("#mapq"); resEl = root.querySelector(".mapres");
    wire(); built = true;
  }
  const $ = (s) => root.querySelector(s);

  /* ----- view (pan / zoom) ----- */
  function apply() { vp.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.k})`); }
  function size() { const r = stage.getBoundingClientRect(); svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`); return r; }
  function doFit(animate) {
    const r = size(); fit = Math.min(r.width, r.height) / WORLD * 0.98;
    goto({ k: fit, x: (r.width - WORLD * fit) / 2, y: (r.height - WORLD * fit) / 2 }, animate);
  }
  const clampK = (k) => Math.min(Math.max(k, fit * 0.7), fit * 7);
  function goto(v, animate = true, ms = 520) {
    cancelAnimationFrame(anim);
    if (!animate) { view = v; apply(); return; }
    const a = { ...view }, t0 = performance.now(), ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms), e = ease(p);
      view = { x: a.x + (v.x - a.x) * e, y: a.y + (v.y - a.y) * e, k: a.k + (v.k - a.k) * e };
      apply(); if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function zoomAt(px, py, f, animate) {
    const k = clampK(view.k * f), r = k / view.k;
    goto({ k, x: px - (px - view.x) * r, y: py - (py - view.y) * r }, animate, 220);
    userMoved = true;
  }
  function focusTile(t, zoom = true) {
    const r = stage.getBoundingClientRect();
    const k = zoom ? Math.max(view.k, Math.min(r.width, r.height) / (SIZE * 3.4)) : view.k;
    goto({ k: clampK(k), x: r.width / 2 - C(t.x) * k, y: r.height / 2 - C(t.y) * k }, true, 600);
    userMoved = true;
  }

  /* ----- details panel ----- */
  const dir = (t) => {
    const dx = t.x - 4, dy = t.y - 4;
    const parts = [];
    if (dy) parts.push(`${Math.abs(dy)} north`.replace("north", dy < 0 ? "north" : "south"));
    if (dx) parts.push(`${Math.abs(dx)} ${dx < 0 ? "west" : "east"}`);
    return parts.length ? parts.join(", ") + " of Spawn" : "the centre of the map";
  };
  const pageOf = (t) => {
    for (const a of [t.name, ...(t.aliases || [])]) { const p = CX.byTitle.get(norm(a)); if (p && !p.fromMap) return p; }
    return null;
  };
  const RING_NOTES = {
    1: "Ring 1 holds the first three bosses. Beating all of them unlocks ring 2 (per the wiki’s achievements list).",
    2: "Ring 2 opens once every ring-1 boss is down. The Compressor and the Storage Cube Island can turn up here.",
    3: "Ring 3 is where the late bosses start. Towers and ambushes get tougher the further out you go.",
    4: "Ring 4 is the outer edge: towers here are black with strong enemies (4 regen cores on every floor), and the Combination Altar can appear.",
  };
  const RANDOM_ISLANDS = [
    ["Island with a tower", "the most common island. Towers have 2–7 floors, a loot box at the top"],
    ["Ambush islands", "rarer, a box that starts an ambush, tougher the further out"],
    ["Tent", "enemy tents on raider villages, each summons up to three Raiders"],
    ["Storage Cube Island", "ring 2 only, appears once per server", 2],
    ["Compressor", "a random island on ring 2", 2],
    ["Combination Altar", "found in ring 4", 4],
    ["Yuzi Island", "random location, holds the Yuzi Cube"],
    ["Minesweeper island", "a source of Pyrolite"],
  ];
  const itemLink = (name) => {
    const p = CX.byTitle.get(norm(name));
    return p ? `<a href="#/${CX.slug(p.title)}" data-item="${CX.esc(p.title)}" data-t="${CX.esc(p.title)}">${CX.esc(name)}</a>` : CX.esc(name);
  };
  const editLink = (t) => `<a href="${WIKI}${encodeURIComponent(t.name.replace(/ /g, "_"))}?action=edit" target="_blank" rel="noopener">add them on the wiki</a>`;

  function panelFor(t) {
    const E = CX.esc, pg = pageOf(t);
    const lane = t.lane && LANE[t.lane] ? LANE[t.lane][0] : "";
    const kick = `<div class="kicker"><b>${{ boss: "Boss", util: "Machine", spawn: "Hub", lock: "Locked", rand: "Random island" }[t.kind]}</b><span>Ring ${t.ring}</span><span>${t.ref}</span>${lane ? `<span>${lane}</span>` : ""}</div>`;
    let h = `${kick}<h2>${E(t.name)}</h2>`;
    if (t.kind === "boss") {
      h += `<p>${stars(t.stars)}<span class="stars-l">${t.stars} / 5 · boss #${t.order} of ${bosses.length}</span></p>`;
      h += `<dl class="facts"><dt>Where</dt><dd>${dir(t)}</dd><dt>Ring</dt><dd>${t.ring}</dd><dt>Difficulty</dt><dd>${t.stars} stars on the in-game map</dd></dl>`;
      const s = secFor(t);
      if (s) {
        h += `<div class="body">${s.intro.join("")}</div>`;
        if (s.subs.drops || s.subs.drop) h += `<h3>Drops</h3><div class="body">${(s.subs.drops || s.subs.drop).join("")}</div>`;
        const rev = Object.entries(s.subs).find(([k]) => k.startsWith("revival"));
        if (rev) h += `<details><summary>How to revive</summary><div class="body">${rev[1].join("")}</div></details>`;
        if (s.subs.abilities) h += `<details><summary>Abilities</summary><div class="body">${s.subs.abilities.join("")}</div></details>`;
        const mus = s.subs.music; if (mus) h += `<details><summary>Music</summary><div class="body">${mus.join("")}</div></details>`;
      } else if (pg && pg.html) {
        h += `<div class="body">${pg.html}</div>`;
      } else h += `<div class="note">The wiki doesn’t have details for ${E(t.name)} yet. You can ${editLink(t)}.</div>`;
      if (pg && !pg.fromMap) h += `<div class="nbr"><button data-open="${E(pg.title)}">${CX.ICON.table} Quick view</button></div>`;
    } else if (t.kind === "util") {
      h += `<dl class="facts"><dt>Where</dt><dd>${dir(t)}</dd><dt>Ring</dt><dd>${t.ring}</dd></dl>`;
      if (pg && pg.html) {
        h += `<div class="body">${pg.html}</div>`;
        const { makes, uses } = CX.recipesFor(pg);
        if (uses.length) h += `<h3>What it makes</h3>${CX.grid(uses.slice(0, 3))}`;
        if (makes.length) h += `<h3>How to get it</h3>${CX.grid(makes.slice(0, 2))}`;
      } else h += `<div class="note">The wiki doesn’t describe the ${E(t.name)} yet. It sits ${dir(t)}. You can ${editLink(t)}.</div>`;
      if (t.id === "magnetizer") h += `<p>Found on the purple bridge in the first ring.</p>`;
    } else if (t.kind === "spawn") {
      h += `<p>Every player starts here. It’s the centre of the map and the hub for the whole world.</p>`;
      if (pg && pg.html) h += `<div class="body">${pg.html}</div>`;
    } else if (t.kind === "lock") {
      h += `<p>This slot is marked <b>W.I.P</b> on the in-game map. It isn’t available yet.</p>`;
    } else {
      const dist = t.ring;
      h += `<dl class="facts"><dt>Where</dt><dd>${dir(t)}</dd><dt>Ring</dt><dd>${dist}</dd></dl>`;
      h += `<p>An unexplored island. What spawns here is random in every world. It could be:</p><ul class="spawnlist">` +
        RANDOM_ISLANDS.filter((r) => !r[2] || r[2] === dist).map((r) => `<li><span>${itemLink(r[0])} <small style="color:var(--ink-2)">— ${E(r[1])}</small></span></li>`).join("") + `</ul>`;
      if (RING_NOTES[dist]) h += `<div class="note">${E(RING_NOTES[dist])}</div>`;
    }
    // neighbours along the boss ladder
    if (t.kind === "boss") {
      const prev = order[t.order - 2], next = order[t.order];
      h += `<div class="nbr">${prev ? `<button data-go="${prev.id}">← ${E(prev.name)}</button>` : ""}${next ? `<button data-go="${next.id}">${E(next.name)} →</button>` : ""}</div>`;
    }
    h += `<p class="src" style="margin-top:14px">Star ratings and layout read off the wiki’s <a href="${WIKI}File:Map_(All_Rings_2.26.26).png" target="_blank" rel="noopener">map image</a>.</p>`;
    return h;
  }
  function homePanel() {
    const E = CX.esc;
    return `<h2>Pick an island</h2>
      <p>Click any tile, or pick a boss from the order list. Bosses show their stats, drops and abilities straight from the wiki.</p>
      <div class="legend"><span><i style="background:#b9606c"></i>West</span><span><i style="background:#6f9d84"></i>East</span><span><i style="background:#a39157"></i>South</span><span><i style="background:#8d70b5"></i>Machines</span><span><i style="background:#a79eb1"></i>Random</span></div>
      <p class="src">Keyboard: arrow keys move between islands, + / − zoom, 0 fits the map, Home centres on Spawn.</p>`;
  }
  function paintSide(t) {
    sideEl.innerHTML = t ? panelFor(t) : homePanel();
    sideEl.classList.remove("flash"); void sideEl.offsetWidth; sideEl.classList.add("flash");
    sideEl.querySelectorAll("a[data-t]").forEach((a) => { a.dataset.item = a.dataset.t; a.setAttribute("draggable", "false"); });
    sideEl.scrollTop = 0;
  }

  /* ----- boss order: always visible, tracks progress ----- */
  function paintLadder() {
    const E = CX.esc, next = order.find((b) => !done.has(b.id));
    const n = done.size, pct = Math.round((n / bosses.length) * 100);
    ladderEl.innerHTML = `
      <div class="lhead"><h2>Boss order</h2><span class="lcount">${n}/${bosses.length}</span></div>
      <div class="lbar" role="progressbar" aria-valuemin="0" aria-valuemax="${bosses.length}" aria-valuenow="${n}"><i style="width:${pct}%"></i></div>
      <p class="lnext">${next ? `Next up: <button data-go="${next.id}">${E(next.name)}</button>` : "All bosses defeated. Nice."}</p>
      <ol class="lrows">${order.map((b) => `<li><div class="lrow${b.id === selId ? " cur" : ""}${done.has(b.id) ? " dn" : ""}${next && next.id === b.id ? " nx" : ""}" data-go="${b.id}" role="button" tabindex="0" aria-label="${E(b.name)}, ${b.stars} stars${done.has(b.id) ? ", defeated" : ""}">
        <span class="ln">${b.order}</span><span class="lm"><b>${E(b.name)}</b>${stars(b.stars)}</span>
        <button class="ck" data-done="${b.id}" aria-pressed="${done.has(b.id)}" title="${done.has(b.id) ? "Defeated. Click to undo" : "Mark as defeated"}">✓</button></div></li>`).join("")}</ol>
      <p class="lfoot">Easiest to hardest, by the stars on the in-game map. Ticks are saved in this browser.</p>`;
    svg.querySelectorAll(".tl.t-boss").forEach((el) => el.classList.toggle("done", done.has(el.dataset.id)));
  }
  function toggleDone(id) {
    done.has(id) ? done.delete(id) : done.add(id);
    saveDone(); paintLadder();
    if (done.has(id)) { CX.Snd.success(); const r = ladderEl.querySelector(`[data-done="${id}"]`).getBoundingClientRect(); CX.burst(r.left + r.width / 2, r.top + r.height / 2, 12); } else CX.Snd.drop();
    if (selId === id) paintSide(byId.get(id));
  }

  /* ----- selection ----- */
  function select(id, { fly = true, quiet = false } = {}) {
    const t = id && byId.get(id);
    selId = t ? t.id : null;
    svg.querySelectorAll(".tl.sel").forEach((n) => n.classList.remove("sel"));
    if (t) {
      svg.querySelector(`.tl[data-id="${t.id}"]`).classList.add("sel");
      if (fly) focusTile(t);
      if (!quiet) CX.Snd.select();
      history.replaceState(null, "", "#/map/" + t.id);
      if (window.matchMedia("(max-width: 900px)").matches && fly) setTimeout(() => sideEl.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
    } else history.replaceState(null, "", "#/map");
    paintSide(t); paintLadder();
    const cur = ladderEl.querySelector(".lrow.cur"); if (cur) cur.scrollIntoView({ block: "nearest" });
  }
  const resolve = (arg) => {
    if (!arg) return null;
    const a = decodeURIComponent(arg);
    if (byId.has(a)) return a;
    const t = TILES.find((x) => x.aliases.some((al) => norm(al) === norm(a.replace(/-/g, " "))) || norm(x.name) === norm(a.replace(/-/g, " ")));
    return t ? t.id : null;
  };

  /* ----- search ----- */
  function doSearch(text) {
    const q = norm(text);
    matches = new Set();
    svg.querySelectorAll(".tl.match").forEach((n) => n.classList.remove("match"));
    svg.classList.toggle("has-match", false);
    if (q.length < 2) { resEl.hidden = true; resEl.innerHTML = ""; svg.querySelectorAll(".tl.dim").forEach((n) => n.classList.remove("dim")); return; }
    const tokens = q.split(" ");
    const hits = [];
    for (const t of TILES) {
      if (t.kind === "lock" || t.kind === "rand") continue;
      const nameN = norm(t.name), pg = pageOf(t), s = secFor(t);
      const body = norm((s ? plain(s.intro.join("") + Object.values(s.subs).flat().join("")) : "") + " " + (pg ? pg.text : ""));
      const inName = tokens.every((w) => nameN.includes(w)), inBody = tokens.every((w) => body.includes(w) || nameN.includes(w));
      if (inName) hits.push([3, t, "name"]); else if (inBody) hits.push([1, t, "mentions it"]);
    }
    // plain text matches on tiles like "ring 2", "west", "tower"
    TILES.forEach((t) => {
      if (hits.find((h) => h[1] === t)) return;
      if (/^ring \d$/.test(q) && String(t.ring) === q.slice(5)) hits.push([0, t, "ring"]);
    });
    hits.sort((a, b) => b[0] - a[0]);
    hits.forEach(([, t]) => matches.add(t.id));
    svg.querySelectorAll(".tl").forEach((n) => { n.classList.toggle("match", matches.has(n.dataset.id) && !/^island|locked/.test(n.dataset.id) || (/^ring \d$/.test(q) && matches.has(n.dataset.id))); n.classList.toggle("dim", matches.size > 0 && !matches.has(n.dataset.id)); });
    const item = CX.pages.find((p) => norm(p.title) === q);
    resEl.innerHTML = hits.slice(0, 7).map(([, t, why]) => `<button data-go="${t.id}"><b>${CX.esc(t.name)}</b><small>${why === "name" ? t.kind : "drops / mentions"}</small></button>`).join("") +
      (item ? `<button data-open="${CX.esc(item.title)}">${CX.ICON.table} Quick view: ${CX.esc(item.title)}</button>` : "") +
      (!hits.length && !item ? `<button disabled>Nothing on the map matches “${CX.esc(text)}”</button>` : "");
    resEl.hidden = false;
    if (hits.length === 1) { /* single hit: nudge the camera there */ focusTile(hits[0][1], false); }
  }

  /* ----- events ----- */
  function wire() {
    // toolbar
    root.querySelector(".maptools").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-f]"); if (!b) return;
      const f = b.dataset.f; flags[f] = !flags[f]; b.setAttribute("aria-pressed", flags[f]);
      applyFlags(); CX.Snd.click();
    });
    // zoom buttons
    root.querySelector(".zoomctl").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const r = stage.getBoundingClientRect(), z = b.dataset.z;
      if (z === "in") zoomAt(r.width / 2, r.height / 2, 1.5, true);
      else if (z === "out") zoomAt(r.width / 2, r.height / 2, 1 / 1.5, true);
      else if (z === "fit") { userMoved = false; doFit(true); }
      else if (z === "spawn") focusTile(byId.get("spawn"));
    });
    // wheel zoom
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), false);
    }, { passive: false });
    // pan / pinch / click
    const ptrs = new Map(); let drag = null, pinch = null;
    stage.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".zoomctl")) return;
      stage.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      cancelAnimationFrame(anim);
      if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, target: e.target };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k }; drag = null; }
    });
    stage.addEventListener("pointermove", (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], r = stage.getBoundingClientRect();
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        const k = clampK(pinch.k * d / pinch.d), f = k / view.k;
        view = { k, x: mx - (mx - view.x) * f, y: my - (my - view.y) * f }; apply(); userMoved = true; return;
      }
      if (drag && ptrs.size === 1) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 5) drag.moved = true;
        if (drag.moved) { view = { ...view, x: drag.vx + dx, y: drag.vy + dy }; apply(); userMoved = true; }
      }
      // hover readout
      const tl = e.target.closest && e.target.closest(".tl");
      if (tl && !drag?.moved) { const t = byId.get(tl.dataset.id); coordEl.textContent = `${t.ref} · ${t.name}${t.kind === "boss" ? " · " + t.stars + "★" : ""} · ring ${t.ring}`; }
      else if (!tl) coordEl.textContent = "hover an island";
    });
    const up = (e) => {
      const was = drag; ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (was && !was.moved && e.type === "pointerup") {
        const tl = was.target.closest && was.target.closest(".tl");
        if (tl) select(tl.dataset.id);
      }
      if (ptrs.size === 0) drag = null;
    };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.addEventListener("dblclick", (e) => { const r = stage.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, 1.8, true); });
    // keyboard
    svg.addEventListener("keydown", (e) => {
      const cur = byId.get(selId) || byId.get("spawn");
      const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (mv) {
        e.preventDefault();
        const nx = Math.max(0, Math.min(8, cur.x + mv[0])), ny = Math.max(0, Math.min(8, cur.y + mv[1]));
        const t = TILES.find((x) => x.x === nx && x.y === ny);
        if (t) select(selId ? t.id : "spawn", { fly: true });
      } else if (e.key === "+" || e.key === "=") { const r = stage.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.4, true); }
      else if (e.key === "-") { const r = stage.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.4, true); }
      else if (e.key === "0") { userMoved = false; doFit(true); }
      else if (e.key === "Home") focusTile(byId.get("spawn"));
      else if (e.key === "Escape") select(null);
    });
    // side panel + search result clicks
    root.addEventListener("click", (e) => {
      const dn = e.target.closest("[data-done]");
      if (dn) { e.stopPropagation(); toggleDone(dn.dataset.done); return; }
      const go = e.target.closest("[data-go]");
      if (go) { select(go.dataset.go); resEl.hidden = true; return; }
      const op = e.target.closest("[data-open]");
      if (op) { CX.openItem(op.dataset.open); return; }
      const a = e.target.closest("a[data-t]");
      if (a) { e.preventDefault(); CX.Snd.pop(); CX.openItem(a.dataset.t); }
      if (!e.target.closest(".mapsearch")) resEl.hidden = true;
    });
    ladderEl.addEventListener("keydown", (e) => { const r = e.target.closest(".lrow"); if (r && (e.key === "Enter" || e.key === " ") && !e.target.closest("button")) { e.preventDefault(); select(r.dataset.go); } });
    searchEl.addEventListener("input", () => { CX.Snd.tick(); doSearch(searchEl.value); });
    searchEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { const b = resEl.querySelector("button[data-go]"); if (b) { select(b.dataset.go); resEl.hidden = true; } }
      if (e.key === "Escape") { searchEl.value = ""; doSearch(""); }
    });
    searchEl.addEventListener("focus", () => { if (resEl.innerHTML) resEl.hidden = false; });
    new ResizeObserver(() => { if (!root.hidden) { const old = fit; size(); fit = Math.min(stage.clientWidth, stage.clientHeight) / WORLD * 0.98; if (!userMoved) doFit(false); } }).observe(stage);
  }
  function applyFlags() {
    ["boss", "util", "rand", "lock"].forEach((k) => svg.classList.toggle("hide-" + k, !flags[k]));
    svg.classList.toggle("show-rings", flags.rings); svg.classList.toggle("show-heat", flags.heat);
    svg.classList.toggle("show-path", flags.path); svg.classList.toggle("show-photo", flags.photo);
  }

  /* ----- public: show / hide ----- */
  CX.map.show = (arg) => {
    root = document.getElementById("mapview");
    document.body.classList.add("wide");
    if (!built) {
      build();
      requestAnimationFrame(() => { doFit(false); applyFlags(); paintLadder(); finish(); });
    } else finish();
    function finish() {
      const id = resolve(arg);
      if (id) { select(id, { fly: true, quiet: true }); }
      else if (!selId) paintSide(null);
      window.scrollTo(0, 0);
    }
  };
  CX.map.hide = () => { cancelAnimationFrame(anim); document.body.classList.remove("wide"); };
})();
