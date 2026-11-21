(() => {
  const $ = (s) => document.querySelector(s);
  const q = $("#q"), list = $("#list"), pageEl = $("#page"), catsEl = $("#cats"), craftEl = $("#craft"), quickEl = $("#quick"), mapEl = $("#mapview");
  const modal = $("#modal"), dock = $("#dock"), fx = $("#fx");
  const PAGE_SIZE = 40;
  const HIDE_CATS = new Set(["Pages with broken file links", "Stubs", "Stub", "Cubination Wiki", "Community", "Images", "Media", "Maintenance", "Candidates for deletion", "Documentation templates"]);
  const MAIN_CATS = ["Armor", "Cubes", "Weapons", "Equipment", "Enemies", "Islands"];
  const QUICK = ["Armor Cube", "Steel Sword", "Regen Coil", "Raider", "Iron Cube"];

  let pages = [], byTitle = new Map(), cat = "All", shown = PAGE_SIZE, selected = -1, currentResults = [], showAllCats = false;
  let recipes = [], ingredients = new Map(), extraImgs = {};
  let view = "grid";
  try { view = localStorage.getItem("cx-view") || "grid"; } catch (e) {}

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const nk = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = (t) => encodeURIComponent(t.replace(/ /g, "_"));
  const noEmoji = (s) => s.replace(/🔗️?/g, "+").replace(/🔥️?/g, "in").replace(/🏝️?/g, "").replace(/\s+/g, " ");
  const pageFor = (name, target) => byTitle.get(norm(name)) || byTitle.get(norm(target || ""));
  const splitAlt = (n) => { const m = n.match(/^(.*?)\s*\((.*)\)\s*$/); return m ? [m[1], m[2]] : [n, ""]; };
  const imgFor = (name, pg) => (pg && pg.img) || extraImgs[nk(name)] || null;

  /* ---------- animated icons (inline SVG, animated in CSS) ---------- */
  const ICON = {
    flame: '<svg class="ico ico-flame" viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 2 2 3 2 0-3-1-5 0-7z" fill="#e8590c"/><path class="g" d="M12 22a3.5 3.5 0 0 1-3.5-3.5c0-2 2-3 3.5-5 1.5 2 3.5 3 3.5 5A3.5 3.5 0 0 1 12 22z" fill="#ffd43b"/></svg>',
    link: '<svg class="ico ico-link" viewBox="0 0 24 24" aria-hidden="true"><rect class="l1" x="1.5" y="8" width="12" height="8" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><rect class="l2" x="10.5" y="8" width="12" height="8" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    island: '<svg class="ico ico-island" viewBox="0 0 24 24" aria-hidden="true"><g class="palm"><path d="M13 18c0-4 .5-6 1-9" stroke="#8a5a2b" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M14 9c-3-3-6-2-8 0 3-1 5 0 8 0zM14 9c3-3 6-2 8 0-3-1-5 0-8 0zM14 9c-1-4 1-6 3-6-1 2-1 4-3 6z" fill="#2f9e44"/></g><path d="M5 19a8 4 0 0 1 14 0z" fill="#e0b25c"/><path class="wave" d="M1 22c3-2 5-2 8 0s5 2 8 0 4-2 6 0" stroke="#339af0" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    arrow: '<svg class="ico ico-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h15M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="square"/></svg>',
    spark: '<svg class="ico ico-spark" viewBox="0 0 24 24" aria-hidden="true"><path class="s" d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z" fill="currentColor"/><path class="s s2" d="M18 14l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="currentColor"/></svg>',
  };
  const ln = (cls, inner) => `<svg class="ico ico-${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;
  Object.assign(ICON, {
    cube: ln("cube", '<path d="M12 2.5l8.5 4.3v10.4L12 21.5l-8.5-4.3V6.8z"/><path d="M3.5 6.8L12 11l8.5-4.2M12 11v10.5"/>'),
    shield: ln("shield", '<path d="M12 2.5l8 3v6c0 4.8-3.3 8.6-8 10-4.7-1.4-8-5.2-8-10v-6z"/><path d="M12 7v10"/>'),
    sword: ln("sword", '<path d="M14.5 3.5h6v6L10 20l-3-3z"/><path d="M5 15l4 4M4 20l2-2"/>'),
    skull: ln("skull", '<path d="M5 12a7 7 0 1 1 14 0c0 2-1 3.2-2 4v3H7v-3c-1-.8-2-2-2-4z"/><circle cx="9.5" cy="12" r="1.3" fill="currentColor"/><circle cx="14.5" cy="12" r="1.3" fill="currentColor"/>'),
    pack: ln("pack", '<path d="M8 6a4 4 0 0 1 8 0"/><rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 15h6"/>'),
    bricks: ln("bricks", '<rect x="3" y="4" width="18" height="16"/><path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 9.3v5.4M9 14.7V20"/>'),
    coil: ln("coil", '<path d="M12 2l-6 4 12 4-12 4 12 4-6 4"/>'),
    ingot: ln("ingot", '<path d="M2.5 17.5l3-8h13l3 8z"/><path d="M8 9.5l-1 8M16 9.5l1 8"/>'),
    star: ln("star", '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/>'),
    gear: ln("gear", '<circle cx="12" cy="12" r="3.4"/><path d="M12 2.5v3.2M12 18.3v3.2M2.5 12h3.2M18.3 12h3.2M5.3 5.3l2.3 2.3M16.4 16.4l2.3 2.3M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3"/>'),
    map: ln("map", '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
    lock: ln("lock", '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    table: ln("table", '<path d="M3 8l9-5 9 5v9l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v9"/><path d="M8 5.5l9 5"/>'),
    pin: ln("pin", '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
    hand: ln("hand", '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-3 0-4.5-2-6-5l-1-2a1.5 1.5 0 0 1 2.5-1.5L8 14"/>'),
    on: ln("snd on", '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path class="w1" d="M16 9.2c1.3 1.7 1.3 4.1 0 5.6"/><path class="w2" d="M18.7 6.6c3 3 3 7.8 0 10.8"/>'),
    off: ln("snd off", '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>'),
  });
  const CAT_ICON = { Armor: "shield", Cubes: "cube", "Natural Cubes": "cube", Weapons: "sword", Equipment: "pack", Enemies: "skull", Bosses: "skull", Islands: "island", Structures: "bricks", Coils: "coil", Ingots: "ingot", Features: "star", "Sandbox Exclusives": "star", "Island Mechanics": "gear", "Game Mechanics": "gear", "Menu Mechanics": "gear", "Recipe items": "cube" };
  const catIcon = (c) => ICON[CAT_ICON[c] || "cube"];
  /* Items with no picture on the wiki get a generated icon tinted from their name (Red Cube is red, Copper is copper...) */
  const TINT = { red: "#e03131", blue: "#1c7ed6", yellow: "#f2b705", green: "#37b24d", white: "#e9ecef", cyan: "#15aabf", magenta: "#d6336c", purple: "#7950f2", copper: "#c8703a", gold: "#e5a812", golden: "#e5a812", iron: "#8a93a6", steel: "#6f7f95", black: "#3a3a46", pyrolite: "#e8590c", cryoide: "#74c0fc", ice: "#a5d8ff", lava: "#f76707", fire: "#f76707", flame: "#f76707", water: "#339af0", dirt: "#8a5a2b", wood: "#a9763c", wooden: "#a9763c", rock: "#868e96", stone: "#868e96", sand: "#e0c27a", glass: "#a5d8ff", gunpowder: "#495057", lithium: "#adb5bd", orange: "#fd7e14", pink: "#f783ac", brown: "#8a5a2b", silver: "#adb5bd", rusted: "#a0522d", rusty: "#a0522d", frost: "#74c0fc", christmas: "#2f9e44", magma: "#f76707", health: "#f03e3e", regen: "#f03e3e", speed: "#fcc419" };
  const mix = (hex, t) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t))); return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""); };
  function tintFor(name) {
    const w = norm(name).split(" ");
    for (const k of w) if (TINT[k]) return TINT[k];
    let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
    const s = 0.55, l = 0.52, a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12, v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * v).toString(16).padStart(2, "0"); };
    return "#" + f(0) + f(8) + f(4);
  }
  function phFor(name = "", cats = []) {
    const c = tintFor(name), n = name.toLowerCase();
    if (cats.includes("Bosses") || cats.includes("Enemies"))
      return `<svg class="ico ph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C7 2 3.500 5.600 3.500 10.500c0 2.500 1 4 2.500 5.200V20h3v-2h1.500v2h3v-2H15v2h3v-4.300c1.500-1.200 2.500-2.700 2.500-5.200C20.500 5.600 17 2 12 2z" fill="${cats.includes("Bosses") ? "#e0a0a0" : "#a9d3b0"}" stroke="rgba(0,0,0,.5)" stroke-width=".9" stroke-linejoin="round"/><circle cx="8.600" cy="11" r="2.100" fill="#1b1814"/><circle cx="15.400" cy="11" r="2.100" fill="#1b1814"/><path d="M12 13.500l1.200 2.500h-2.400z" fill="#1b1814"/></svg>`;
    if (/\b(sword|club|hammer|greatsword|pitchfork|spear|axe|dagger|mace)\b/.test(n))
      return `<svg class="ico ph" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5" stroke="${mix(c, .1)}" stroke-width="3.4" stroke-linecap="square"/><path d="M15 5h4v4" stroke="${mix(c, .4)}" stroke-width="2" fill="none"/><path d="M6.500 13l4.500 4.500M4 20l3-3" stroke="#5a4a2a" stroke-width="2.600" stroke-linecap="round"/></svg>`;
    if (/\b(shield|helmet|chestplate|leggings?|boots?|armor)\b/.test(n))
      return `<svg class="ico ph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.500l8 3v6c0 4.800-3.300 8.600-8 10-4.700-1.400-8-5.200-8-10v-6z" fill="${c}" stroke="${mix(c, -.45)}" stroke-width="1.600" stroke-linejoin="round"/><path d="M12 2.500v19c-4.700-1.400-8-5.200-8-10v-6z" fill="${mix(c, .25)}"/></svg>`;
    return `<svg class="ico ph" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.500l8.500 4.300v10.400L12 21.500l-8.500-4.300V6.800z" fill="${c}"/><path d="M12 2.500l8.500 4.300L12 11 3.500 6.800z" fill="${mix(c, .38)}"/><path d="M12 11v10.500l-8.500-4.300V6.800z" fill="${mix(c, -.12)}"/><path d="M12 11l8.500-4.200v10.400L12 21.500z" fill="${mix(c, -.3)}"/><path d="M12 2.500l8.500 4.300v10.400L12 21.500l-8.500-4.300V6.800z M3.500 6.800L12 11l8.500-4.200M12 11v10.500" fill="none" stroke="rgba(0,0,0,.5)" stroke-width=".9" stroke-linejoin="round"/></svg>`;
  }
  const METHOD = { combine: [ICON.link, "Combine"], furnace: [ICON.flame, "Furnace"], other: [ICON.island, "Found"] };
  $("#dock .dk-ico").innerHTML = ICON.table;
  $("#tab-craft").innerHTML = ICON.spark + "Craft";
  $("#tab-map").innerHTML = ICON.map + "Map";

  /* ---------- sound (tiny synthesized blips, no audio files) ---------- */
  const Snd = (() => {
    let ctx = null, on = true, lastTick = 0;
    try { on = localStorage.getItem("cx-sound") !== "off"; } catch (e) {}
    const get = () => {
      if (!on) return null;
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch (e) { return null; }
    };
    function tone(f, dur = .08, type = "square", vol = .035, when = 0, slide = 1) {
      const c = get(); if (!c) return;
      const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide !== 1) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
    }
    return {
      get on() { return on; },
      toggle() { on = !on; try { localStorage.setItem("cx-sound", on ? "on" : "off"); } catch (e) {} if (on) this.click(); return on; },
      click() { tone(520, .06, "square", .03, 0, .7); },
      nav() { tone(300, .07, "square", .035, 0, 1.7); tone(450, .07, "square", .03, .05, 1.3); },
      tick() { const n = performance.now(); if (n - lastTick > 55) { lastTick = n; tone(1000 + Math.random() * 200, .025, "square", .012); } },
      pop() { tone(360, .1, "triangle", .06, 0, 2.2); },
      drop() { tone(520, .1, "triangle", .05, 0, .45); },
      thud() { tone(140, .16, "square", .05, 0, .5); tone(260, .1, "triangle", .04, .04, .6); },
      success() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .14, "triangle", .05, i * .07)); },
      nope() { tone(170, .2, "sawtooth", .035, 0, .6); },
      sparkle() { [880, 1175, 1568, 2093, 1760].forEach((f, i) => tone(f, .12, "sine", .04, i * .05)); },
      select() { tone(660, .05, "square", .03, 0, 1.4); tone(880, .07, "square", .025, .05); },
    };
  })();
  const sndBtn = document.createElement("button");
  sndBtn.id = "snd"; sndBtn.className = "snd";
  const paintSnd = () => { sndBtn.innerHTML = Snd.on ? ICON.on : ICON.off; sndBtn.setAttribute("aria-pressed", Snd.on); sndBtn.title = Snd.on ? "Sound on (click to mute)" : "Sound off"; sndBtn.setAttribute("aria-label", sndBtn.title); };
  paintSnd();
  document.querySelector(".top").appendChild(sndBtn);
  sndBtn.addEventListener("click", (e) => { e.stopPropagation(); Snd.toggle(); paintSnd(); });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#snd, #dock, .modal")) return;
    if (e.target.closest("a.row, a.tile, a.cta, .tabs a, .back, .body a, .brand")) Snd.nav();
    else if (e.target.closest("[data-add], [data-rm]")) { /* played by the craft view */ }
    else if (e.target.closest("button")) Snd.click();
  });
  document.addEventListener("error", (e) => {      // a failed image becomes the placeholder
    const i = e.target;
    if (i && i.tagName === "IMG" && i.closest(".thumb")) i.parentElement.innerHTML = phFor(i.dataset.n || "");
  }, true);

  /* ---------- particles ---------- */
  function burst(x, y, n = 14) {
    const colors = ["#e03131", "#1c7ed6", "#f2b705", "#37b24d", "#e8590c", "#7950f2"];
    for (let i = 0; i < n; i++) {
      const b = document.createElement("i"); b.className = "bit";
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      b.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 20}px;--r:${Math.random() * 360}deg`;
      fx.appendChild(b); setTimeout(() => b.remove(), 800);
    }
  }

  /* ---------- load ---------- */
  list.innerHTML = '<div class="loader"><i></i><i></i><i></i></div>';
  const readyCbs = [];
  fetch("data.json").then((r) => r.json()).then((d) => {
    extraImgs = d.imgs || {};
    CX.mapImg = d.mapImg || null;
    const raw = mergeDuplicates(d.pages);
    const virtual = makeVirtual(raw);
    pages = raw.concat(virtual).map((p) => ({
      ...p,
      cats: fixCats(p),
      _t: norm(p.title), _c: norm(fixCats(p).join(" ")),
      _r: norm(p.recipes.map((r) => r.raw).join(" ")), _x: norm(p.text),
    }));
    pages.forEach((p) => byTitle.set(p._t, p));
    buildRecipeIndex();
    $("#wikilink").href = d.source;
    $("#built").textContent = `${pages.length} items · data last refreshed ${d.built}.`;
    readyCbs.forEach((f) => f());
    buildQuick(); buildCats(); route();
  }).catch((e) => {
    console.error(e);
    list.innerHTML = '<div class="empty"><b>Couldn\'t load the data.</b><p>Try reloading the page.</p></div>';
  });

  /* Everything that exists in the game gets an entry, even without its own wiki page:
     items that only appear inside recipes, and bosses / places that only exist on the map. */
  function inferCats(name) {
    const n = name.toLowerCase(), c = [];
    if (/\bcube\b/.test(n)) c.push("Cubes");
    if (/shield|armor|helmet|chestplate|legging|boots?\b/.test(n)) c.push("Armor");
    if (/sword|club|hammer|spear|greatsword|pitchfork|caltrop|axe|bow\b/.test(n)) c.push("Weapons");
    if (/ingot|^iron$|^gold$|^copper$|^steel$|dust|shard/.test(n)) c.push("Ingots");
    if (/coil/.test(n)) c.push("Coils");
    return c;
  }
  /* The wiki has pages that differ only by capitalisation ("Black Iron Cube" / "Black iron cube").
     Keep one entry per item, with the fuller page as the base and the other's info folded in. */
  function mergeDuplicates(list) {
    const groups = new Map();
    list.forEach((p) => { const k = norm(p.title); (groups.get(k) || groups.set(k, []).get(k)).push(p); });
    return [...groups.values()].map((g) => {
      if (g.length === 1) return g[0];
      g.sort((a, b) => b.text.length - a.text.length);
      const [main, ...rest] = g, seen = new Set(main.recipes.map((r) => r.raw));
      const m = { ...main, gallery: [...new Set(g.flatMap((x) => x.gallery || []))], cats: [...new Set(g.flatMap((x) => x.cats))], img: g.map((x) => x.img).find(Boolean) || null, recipes: main.recipes.slice() };
      for (const o of rest) {
        o.recipes.forEach((r) => { if (!seen.has(r.raw)) { seen.add(r.raw); m.recipes.push(r); } });
        if (o.text && !main.text.includes(o.text.slice(0, 40))) { m.html += `<h2>Also on the wiki (“${esc(o.title)}”)</h2>${o.html}`; m.text += " " + o.text; }
      }
      return m;
    });
  }
  const WEAPON =/\b(sword|club|hammer|greatsword|pitchfork|caltrop|spear|axe|bow|blade|dagger|scythe|mace|staff)\b/i;
  function fixCats(p) {
    const c = new Set(p.cats.filter((x) => !HIDE_CATS.has(x)));
    const enemy = c.has("Enemies") || c.has("Bosses") || c.has("Islands");
    if (!enemy && WEAPON.test(p.title) && !/handle|tree/i.test(p.title)) { c.add("Weapons"); c.add("Equipment"); }
    if (!enemy && /\b(shield|armor set|helmet|chestplate|leggings?|boots?)\b/i.test(p.title)) c.add("Armor");
    if (!enemy && /\bcoil\b/i.test(p.title)) { c.add("Coils"); c.add("Equipment"); }
    if (!enemy && /\b(ingot|dust)\b/i.test(p.title)) c.add("Ingots");
    return [...c];
  }
  function makeVirtual(raw) {
    const have = new Set(raw.map((p) => norm(p.title)));
    const rawBy = new Map(raw.map((p) => [norm(p.title), p]));
    const seen = new Map();
    const consider = (n, r, idx) => {
      n = (n || "").replace(/\s+/g, " ").trim();
      if (!n || n.length > 42 || /[,.?_:]/.test(n) || /[\u{1F300}-\u{1FAFF}☀-➿]/u.test(n) || !/[a-z]/i.test(n)) return;
      const k = norm(n);
      if (!k || have.has(k) || seen.has(k)) return;
      seen.set(k, { title: n, r, idx });
    };
    for (const p of raw) for (const r of p.recipes) {
      r.from.forEach((n, i) => consider(n, r, i));
      const [m, alt] = splitAlt(r.to);
      consider(m, r, -1);
      alt.split(/,\s*/).forEach((a) => consider(a, r, -1));
    }
    const out = [];
    for (const { title, r, idx } of seen.values()) {
      const made = r.method !== "other" && norm(splitAlt(r.to)[0]) === norm(title);
      const parent = rawBy.get(norm((idx >= 0 ? r.fromT && r.fromT[idx] : r.toT) || ""));
      const summary = made ? `Made by combining ${r.from.filter((f) => norm(f) !== "furnace").join(" + ")}.` : `Used to make ${splitAlt(r.to)[0]}.`;
      out.push({
        title, cats: [...inferCats(title), "Recipe items"], img: extraImgs[nk(title)] || (parent && parent.img) || null,
        summary, text: summary, html: "", recipes: [], virtual: true,
      });
      have.add(norm(title));
    }
    if (window.CX && CX.map && CX.map.extraPages) CX.map.extraPages(raw).forEach((p) => { if (!have.has(norm(p.title))) { out.push(p); have.add(norm(p.title)); } });
    return out;
  }

  /* ---------- recipe index ---------- */
  const rkey = (r) => r.from.map(norm).sort().join("+") + ">" + norm(splitAlt(r.to)[0]);

  function buildRecipeIndex() {
    const seen = new Map();
    for (const p of pages) for (const r of p.recipes) {
      const k = rkey(r);
      if (!seen.has(k)) seen.set(k, { ...r, src: p.title });
    }
    recipes = [...seen.values()];
    for (const r of recipes) {
      r._in = [];
      r.from.forEach((n, i) => {
        if (norm(n) === "furnace" || norm(n) === "spawn") return;
        const pg = pageFor(n, r.fromT && r.fromT[i]);
        const label = pg ? pg.title : n, key = norm(label);
        r._in.push(key);
        const e = ingredients.get(key) || { key, label, page: pg, count: 0 };
        e.count++; ingredients.set(key, e);
      });
      const [main] = splitAlt(r.to);
      const rp = pageFor(main, r.toT);
      r._out = norm(rp ? rp.title : main);
    }
  }
  function recipesFor(p) {
    const me = p._t, seen = new Set(), makes = [], uses = [];
    const add = (r, isMake) => { const k = rkey(r); if (seen.has(k)) return; seen.add(k); (isMake ? makes : uses).push(r); };
    p.recipes.forEach((r) => add(r, r.kind === "obtain"));
    recipes.forEach((r) => { if (r._out === me) add(r, true); else if (r._in.includes(me)) add(r, false); });
    return { makes, uses };
  }

  const thumb = (p, cls = "") => {
    const u = p && imgFor(p.title, p);
    return u ? `<div class="thumb ${cls}"><img src="${esc(u)}" alt="" data-n="${esc(p.title)}" draggable="false" loading="lazy"></div>` : `<div class="thumb ${cls}">${phFor(p ? p.title : "", p ? p.cats : [])}</div>`;
  };
  const tagHtml = (c) => `<span class="tag">${catIcon(c)}${esc(c)}</span>`;

  function tile(name, target, hiKey, cls = "") {
    if (/^[\s_?.!-]*$/.test(name)) name = "Unknown";
    const [main, alt] = splitAlt(name);
    const pg = pageFor(main, target);
    const key = norm(pg ? pg.title : main);
    const u = imgFor(main, pg);
    const img = u ? `<img src="${esc(u)}" alt="" data-n="${esc(main)}" draggable="false" loading="lazy">` : phFor(main);
    const inner = `<span class="thumb sm">${img}</span><span class="cap">${esc(main)}${alt ? `<small>or ${esc(alt)}</small>` : ""}</span>`;
    const c = `tile ${cls}${hiKey && key === hiKey ? " hi" : ""}`;
    const item = esc(pg ? pg.title : main);
    return pg ? `<a class="${c}" href="#/${slug(pg.title)}" data-item="${item}" draggable="false" title="${esc(pg.title)} (drag me to the crafting table)">${inner}</a>`
              : `<span class="${c}" data-item="${item}">${inner}</span>`;
  }
  function card(r, hiKey, i = 0) {
    const [icon, label] = METHOD[r.method] || METHOD.other;
    const ins = [];
    r.from.forEach((n, j) => { if (norm(n) !== "furnace") ins.push(tile(n, r.fromT && r.fromT[j], hiKey)); });
    return `<div class="rc m-${r.method}" style="--i:${Math.min(i, 12)}"><div class="rm">${icon}${label}</div>
      <div class="rt">${ins.join('<span class="op">+</span>')}<span class="arrow">${ICON.arrow}</span>${tile(r.to, r.toT, hiKey, "result")}</div></div>`;
  }
  const grid = (rs, hi) => `<div class="rgrid">${rs.map((r, i) => card(r, hi, i)).join("")}</div>`;

  /* ---------- quick picks + categories ---------- */
  function buildQuick() {
    const have = QUICK.filter((t) => byTitle.has(norm(t)));
    quickEl.innerHTML = `<span>Try</span>` + have.map((t) => `<button data-q="${esc(t)}">${esc(t)}</button>`).join("") +
      `<button data-random>${ICON.spark} Surprise me</button>`;
  }
  quickEl.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.random !== undefined) { Snd.sparkle(); const p = pages[Math.floor(Math.random() * pages.length)]; location.hash = "#/" + slug(p.title); return; }
    q.value = b.dataset.q; shown = PAGE_SIZE; render(); q.focus();
  });
  function buildCats() {
    const counts = {};
    pages.forEach((p) => p.cats.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    const rest = Object.entries(counts).filter(([c, n]) => n >= 3 && !MAIN_CATS.includes(c)).sort((a, b) => b[1] - a[1]);
    const main = MAIN_CATS.filter((c) => counts[c]).map((c) => [c, counts[c]]);
    const items = [["All", pages.length], ...main, ...(showAllCats ? rest : [])];
    catsEl.innerHTML = items.map(([c, n]) => `<button role="tab" aria-selected="${c === cat}" data-c="${esc(c)}">${c === "All" ? "" : catIcon(c)}${esc(c)}<span>${n}</span></button>`).join("") +
      (rest.length ? `<button class="more" data-more>${showAllCats ? "fewer −" : "more +"}</button>` : "");
  }
  catsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.more !== undefined) { showAllCats = !showAllCats; buildCats(); return; }
    cat = b.dataset.c; shown = PAGE_SIZE; buildCats();
    if (location.hash.length > 2) location.hash = "#/";
    render();
  });

  /* ---------- search ---------- */
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  function score(p, tokens, full) {
    let s = 0;
    if (p._t === full) s += 200;
    else if (p._t.startsWith(full + " ")) s += 90;
    else if (p._t.includes(full)) s += 60;
    const words = p._t.split(" ");
    for (const t of tokens) {
      let hit = 0;
      if (words.includes(t)) hit = 40;
      else if (words.some((w) => w.startsWith(t))) hit = 28;
      else if (p._t.includes(t)) hit = 18;
      else if (p._c.includes(t)) hit = 14;
      else if (p._r.includes(t)) hit = 8;
      else if (p._x.includes(t)) hit = 3;
      else if (t.length > 3 && words.some((w) => lev(w, t) <= (t.length > 5 ? 2 : 1))) hit = 12;
      if (!hit) return 0;
      s += hit;
    }
    for (const t of tokens) if (p.cats.some((c) => norm(c) === t || norm(c) === t + "s" || norm(c).startsWith(t + " "))) s += 35;
    return s;
  }
  function search(text, pool) {
    const full = norm(text.replace(/armour/gi, "armor"));
    pool = pool || (cat === "All" ? pages : pages.filter((p) => p.cats.includes(cat)));
    if (!full) return pool.slice().sort((a, b) => a.title.localeCompare(b.title));
    const tokens = full.split(" ").map((t) => (t.length > 3 ? t.replace(/s$/, "") : t));
    return pool.map((p) => [score(p, tokens, full), p]).filter((x) => x[0] > 0)
      .sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title)).map((x) => x[1]);
  }
  function hl(text, terms) {
    let out = esc(text);
    terms.filter((t) => t.length > 1).forEach((t) => {
      out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![^<]*>)", "ig"), "<mark>$1</mark>");
    });
    return out;
  }
  function snippet(p, terms) {
    const text = noEmoji(p.text).replace(/^(Description|Introduction)\s+/i, ""), lower = text.toLowerCase();
    for (const t of terms) { const i = lower.indexOf(t); if (i > 60) return "…" + text.slice(Math.max(0, i - 50), i + 130); }
    return noEmoji(p.summary).replace(/^(Description|Introduction)\s+/i, "");
  }
  function render() {
    const text = q.value.trim();
    currentResults = search(text);
    const terms = norm(text).split(" ").filter(Boolean);
    selected = -1;
    if (!currentResults.length) {
      const hint = cat !== "All" ? `<p>Nothing in <b>${esc(cat)}</b>. <span class="didyou"><button data-all>Search all categories</button></span></p>` : "";
      list.innerHTML = `<div class="empty"><b>No match for “${esc(text)}”.</b>${hint}<p>Try fewer words, or just the item name (e.g. “steel”).</p></div>`;
      list.querySelector("[data-all]")?.addEventListener("click", () => { cat = "All"; buildCats(); render(); });
      return;
    }
    const slice = currentResults.slice(0, shown);
    const vt = `<span class="vt" role="group" aria-label="View"><button data-v="grid" aria-pressed="${view === "grid"}" title="Grid view">${ICON.cube}Grid</button><button data-v="list" aria-pressed="${view === "list"}" title="List view">${ICON.bricks}List</button></span>`;
    const pin = (p) => (CX.map && CX.map.tileFor && CX.map.tileFor(p.title) ? ICON.pin : "");
    const body = view === "grid"
      ? `<div class="cards">${slice.map((p, i) => `<a class="card" style="--i:${Math.min(i, 14)}" href="#/${slug(p.title)}" data-item="${esc(p.title)}" draggable="false">${thumb(p, "big")}<div class="cb"><h3>${hl(p.title, terms)}${pin(p)}</h3><div class="tags">${p.cats.slice(0, 2).map(tagHtml).join("")}</div></div></a>`).join("")}</div>`
      : slice.map((p, i) => `<a class="row" style="--i:${Math.min(i, 12)}" href="#/${slug(p.title)}" data-item="${esc(p.title)}" draggable="false">${thumb(p)}<div>
        <h3>${hl(p.title, terms)}${pin(p)}</h3>
        <div class="tags">${p.cats.slice(0, 3).map(tagHtml).join("")}</div>
        <p>${hl(snippet(p, terms), terms)}</p></div><span class="go">${ICON.arrow}</span></a>`).join("");
    list.innerHTML =
      `<div class="meta"><span>${currentResults.length} result${currentResults.length === 1 ? "" : "s"}${cat !== "All" ? " in " + esc(cat) : ""}</span><span class="hintdrag">${ICON.hand} drag any item to the crafting table</span>${vt}</div>` + body +
      (currentResults.length > shown ? `<button class="morebtn">Show more (${currentResults.length - shown})</button>` : "");
    list.querySelector(".morebtn")?.addEventListener("click", () => { shown += PAGE_SIZE; render(); });
  }
  list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]"); if (!b) return;
    view = b.dataset.v; try { localStorage.setItem("cx-view", view); } catch (er) {} render();
  });
  q.addEventListener("input", () => {
    Snd.tick(); shown = PAGE_SIZE;
    if (location.hash.length > 2) { history.replaceState(null, "", "#/"); route(); } else render();
  });
  q.addEventListener("keydown", (e) => {
    const rows = [...list.querySelectorAll(".row, .card")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      selected = Math.max(0, Math.min(rows.length - 1, selected + (e.key === "ArrowDown" ? 1 : -1)));
      rows.forEach((r, i) => r.classList.toggle("sel", i === selected));
      rows[selected]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") (rows[selected] || rows[0])?.click();
    else if (e.key === "Escape") { q.value = ""; render(); }
  });
  document.addEventListener("keydown", (e) => {
    const tag = (document.activeElement || {}).tagName;
    if (e.key === "Escape" && !modal.hidden) { closeModal(); return; }
    if (e.key === "/" && tag !== "INPUT" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (!craftEl.hidden) $("#craftin")?.focus(); else if (!mapEl.hidden) $("#mapq")?.focus(); else { q.focus(); q.select(); }
    }
  });

  /* ---------- detail page ---------- */
  function cleanBody(p) {
    const t = document.createElement("template");
    t.innerHTML = p.html;
    const keys = new Set(p.recipes.map((r) => norm(r.raw)).filter(Boolean));
    t.content.querySelectorAll("li").forEach((li) => { if (keys.has(norm(li.textContent))) li.remove(); });
    t.content.querySelectorAll("ul,ol").forEach((u) => { if (!u.children.length) u.remove(); });
    let changed = true;
    while (changed) {
      changed = false;
      t.content.querySelectorAll("h2,h3,h4").forEach((h) => {
        const n = h.nextElementSibling;
        if (!n || (/^H[2-4]$/.test(n.tagName) && n.tagName <= h.tagName)) { h.remove(); changed = true; }
      });
    }
    return t.innerHTML.trim();
  }
  function showPage(p) {
    const { makes, uses } = recipesFor(p);
    const me = p._t;
    const body = cleanBody(p);
    const mt = CX.map && CX.map.tileFor && CX.map.tileFor(p.title);
    pageEl.innerHTML = `
      <a class="back" href="#/">&larr; back to search</a>
      <div class="head" data-item="${esc(p.title)}">${thumb(p)}<div><h1>${esc(p.title)}</h1>
        <div class="tags">${p.cats.map(tagHtml).join("")}</div>
        <div class="ctas">
          ${uses.length ? `<a class="cta" href="#/craft/${slug(p.title)}">${ICON.spark} What can I craft with this?</a>` : ""}
          ${mt ? `<a class="cta alt" href="#/map/${esc(mt)}">${ICON.pin} Show on map</a>` : ""}
          <button class="cta plain" data-open="${esc(p.title)}">${ICON.table} Quick view</button>
        </div></div></div>
      ${makes.length ? `<h2 class="sec">${ICON.link} How to get it <small>${makes.length}</small></h2>${grid(makes, me)}` : ""}
      ${uses.length ? `<h2 class="sec">${ICON.flame} What it’s used for <small>${uses.length}</small></h2>${grid(uses, me)}` : ""}
      ${(p.gallery || []).length ? `<h2 class="sec">${ICON.star} Images from the wiki <small>${p.gallery.length}</small></h2><div class="gal">${p.gallery.map((g) => `<button class="gi" data-zoom="${esc(g)}" aria-label="Enlarge image"><img src="${esc(g)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
      ${p.virtual && !p.html ? `<div class="note">${p.summary ? esc(p.summary) + " " : ""}This item doesn’t have its own wiki page (yet), so everything the wiki says about it is in the recipes above.</div>` : ""}
      ${body ? `<h2 class="sec">From the wiki</h2><div class="body">${body}</div>` : ""}
      ${p.virtual ? "" : `<div class="src">Source: <a href="https://cubination.fandom.com/wiki/${esc(p.title.replace(/ /g, "_"))}" target="_blank" rel="noopener">${esc(p.title)} on the wiki</a></div>`}`;
    document.title = p.title + " – Cubination Index";
  }
  pageEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]"); if (b) return openItem(b.dataset.open);
    const z = e.target.closest("[data-zoom]"); if (z) { Snd.pop(); openModalShell(`<img class="zoomimg" src="${esc(z.dataset.zoom)}" alt="">`); }
  });

  /* ---------- craft finder ---------- */
  let picked = [], lastCraft = "";
  function showCraft(keys) {
    picked = keys;
    document.title = "What can I craft? – Cubination Index";
    const popular = [...ingredients.values()].sort((a, b) => b.count - a.count).slice(0, 8);
    const chips = picked.map((k) => ingredients.get(k)).filter(Boolean);
    let results = "";
    if (chips.length) {
      const both = recipes.filter((r) => picked.every((k) => r._in.includes(k)));
      const getIt = picked.length === 1 ? recipes.filter((r) => r._out === picked[0]) : [];
      if (both.length) {
        results += `<h2 class="sec">${ICON.flame} ${picked.length > 1 ? "Made with all of them" : "You can make"} <small>${both.length}</small></h2>${grid(both, picked.length === 1 ? picked[0] : "")}`;
      } else {
        results += `<div class="note">Nothing in the wiki uses ${chips.map((c) => esc(c.label)).join(" and ")} together. Here’s what each one does on its own.</div>`;
        for (const k of picked) {
          const rs = recipes.filter((r) => r._in.includes(k));
          if (rs.length) results += `<h2 class="sec">${esc(ingredients.get(k).label)} <small>${rs.length}</small></h2>${grid(rs, k)}`;
        }
      }
      if (getIt.length) results += `<h2 class="sec">${ICON.link} How to get ${esc(chips[0].label)} <small>${getIt.length}</small></h2>${grid(getIt, picked[0])}`;
    }
    if (chips.length && picked.join() !== lastCraft) {
      const ok = picked.length > 1 ? recipes.some((r) => picked.every((k) => r._in.includes(k))) : recipes.some((r) => r._in.includes(picked[0]) || r._out === picked[0]);
      setTimeout(() => (ok ? Snd.success() : Snd.nope()), 120);
    }
    lastCraft = picked.join();
    craftEl.innerHTML = `
      <div class="panel">
        <h1>What can I craft?</h1>
        <p class="lead">Pick a cube or item you have. Add a second one to see what the two make together.</p>
        <div class="picker">
          <input id="craftin" class="craftin" type="text" autocomplete="off" spellcheck="false" placeholder="Start typing: iron cube, wood cube…">
          <div class="sugg" hidden></div>
        </div>
        <div class="chips">${chips.map((c) => `<span class="chip" data-item="${esc(c.label)}">${thumb(c.page || { title: c.label }, "")}${esc(c.label)}<button data-rm="${esc(c.key)}" aria-label="Remove ${esc(c.label)}">×</button></span>`).join("")}</div>
        ${chips.length ? "" : `<div class="hint">Popular ingredients</div><div class="tryrow">${popular.map((c) => `<button class="chipbtn" data-add="${esc(c.key)}">${esc(c.label)}</button>`).join("")}</div>`}
      </div>${results}`;
    wireCraft();
  }
  function setPicked(keys) {
    keys.length > picked.length ? Snd.pop() : Snd.drop();
    location.hash = "#/craft" + (keys.length ? "/" + keys.map((k) => slug(ingredients.get(k).label)).join("~") : "");
  }
  function wireCraft() {
    const input = $("#craftin"), box = craftEl.querySelector(".sugg");
    let sel = 0, opts = [];
    const open = () => {
      const t = norm(input.value);
      opts = [...ingredients.values()].filter((e) => !picked.includes(e.key) && (!t || e.key.includes(t)))
        .sort((a, b) => (b.key.startsWith(t) - a.key.startsWith(t)) || b.count - a.count).slice(0, 8);
      sel = 0;
      box.hidden = !opts.length || (!t && document.activeElement !== input);
      box.innerHTML = opts.map((e, i) => `<button data-add="${esc(e.key)}" class="${i === 0 ? "sel" : ""}">${thumb(e.page || { title: e.label })}${esc(e.label)}<small>${e.count} recipe${e.count > 1 ? "s" : ""}</small></button>`).join("");
    };
    input.addEventListener("input", open);
    input.addEventListener("focus", open);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % (opts.length || 1);
        [...box.children].forEach((b, i) => b.classList.toggle("sel", i === sel));
      } else if (e.key === "Enter" && opts[sel]) setPicked([...picked, opts[sel].key].slice(-3));
      else if (e.key === "Escape") box.hidden = true;
      else if (e.key === "Backspace" && !input.value && picked.length) setPicked(picked.slice(0, -1));
    });
    document.addEventListener("click", function off(e) {
      if (!craftEl.contains(e.target)) { box.hidden = true; document.removeEventListener("click", off); }
    });
    craftEl.onclick = (e) => {
      const add = e.target.closest("[data-add]"), rm = e.target.closest("[data-rm]");
      if (add) setPicked([...picked, add.dataset.add].slice(-3));
      else if (rm) setPicked(picked.filter((k) => k !== rm.dataset.rm));
    };
    if (!picked.length) input.focus({ preventScroll: true });
  }

  /* ---------- popup: how is this item made? ---------- */
  const popStack = [];
  let lastFocus = null;
  function closeModal() {
    modal.hidden = true; modal.innerHTML = ""; popStack.length = 0; document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function openModalShell(inner) {
    if (modal.hidden) { lastFocus = document.activeElement; Snd.thud(); }
    modal.hidden = false; document.body.style.overflow = "hidden";
    modal.innerHTML = `<div class="mbox" tabindex="-1"><button class="mclose" aria-label="Close">×</button>${inner}</div>`;
    modal.querySelector(".mbox").focus({ preventScroll: true });
  }
  function openItem(title, fromBack) {
    const p = title && byTitle.get(norm(title));
    if (!p) return openPicker();
    if (!fromBack) { if (popStack[popStack.length - 1] !== p.title) popStack.push(p.title); }
    const { makes, uses } = recipesFor(p);
    const mt = CX.map && CX.map.tileFor && CX.map.tileFor(p.title);
    const prose = !makes.length && !uses.length ? noEmoji(p.summary || "") : (makes.length ? "" : "");
    openModalShell(`
      ${popStack.length > 1 ? `<button class="mback" data-back>&larr; back</button>` : ""}
      <div class="mhead" data-item="${esc(p.title)}">${thumb(p)}<div><h2>${esc(p.title)}</h2><div class="tags">${p.cats.slice(0, 4).map(tagHtml).join("")}</div></div></div>
      ${makes.length ? `<h3 class="sec">${ICON.link} How it’s made <small>${makes.length}</small></h3>${grid(makes.slice(0, 6), p._t)}${makes.length > 6 ? `<p class="mtext">+ ${makes.length - 6} more on the full page.</p>` : ""}`
                     : `<h3 class="sec">${ICON.island} How to get it</h3><p class="mtext">${p.virtual || !p.summary ? "The wiki doesn’t list a recipe for this one." : "No crafting recipe on the wiki. It may be found, dropped or built. Here’s what the wiki says:"}</p>${prose ? `<p class="mtext">${esc(prose)}${prose.length >= 219 ? "…" : ""}</p>` : ""}`}
      ${uses.length ? `<h3 class="sec">${ICON.flame} Used for <small>${uses.length}</small></h3>${grid(uses.slice(0, 4), p._t)}${uses.length > 4 ? `<p class="mtext">+ ${uses.length - 4} more.</p>` : ""}` : ""}
      <div class="mfoot">
        <a class="cta" href="#/${slug(p.title)}" data-close>${ICON.arrow} Open full page</a>
        ${uses.length ? `<a class="cta plain" href="#/craft/${slug(p.title)}" data-close>${ICON.spark} What can I craft with it?</a>` : ""}
        ${mt ? `<a class="cta alt" href="#/map/${esc(mt)}" data-close>${ICON.pin} Show on map</a>` : ""}
      </div>`);
  }
  function openPicker(text = "") {
    openModalShell(`
      <div class="mhead"><div class="thumb">${ICON.table.replace("ico ico-table", "ico ph")}</div><div><h2>Crafting table</h2><p class="mtext" style="margin:0">Drag any item from the page onto the table, or look one up here.</p></div></div>
      <input class="minput" id="pickq" type="search" placeholder="Search any item…" autocomplete="off" value="${esc(text)}" style="margin-top:14px">
      <div class="pickres" id="pickres"></div>`);
    const input = $("#pickq"), res = $("#pickres");
    const draw = () => {
      const rs = search(input.value, pages).slice(0, 18);
      res.innerHTML = rs.map((p) => `<a class="tile" href="#/${slug(p.title)}" data-item="${esc(p.title)}" draggable="false"><span class="thumb sm">${imgFor(p.title, p) ? `<img src="${esc(imgFor(p.title, p))}" alt="" data-n="${esc(p.title)}" draggable="false" loading="lazy">` : phFor(p.title)}</span><span class="cap">${esc(p.title)}</span></a>`).join("");
    };
    input.addEventListener("input", () => { Snd.tick(); draw(); });
    draw(); input.focus({ preventScroll: true });
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest(".mclose")) return closeModal();
    if (e.target.closest("[data-back]")) { popStack.pop(); return openItem(popStack[popStack.length - 1], true); }
    const a = e.target.closest("a");
    if (!a) return;
    if (a.dataset.close !== undefined) { setTimeout(closeModal, 0); return; }
    const t = a.dataset.item;
    if (t) { e.preventDefault(); Snd.pop(); openItem(t); }
  });
  dock.addEventListener("click", () => { if (!suppress) openPicker(); });

  /* ---------- drag any item onto the crafting table ---------- */
  let D = null, suppress = false, ghost = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || D || !modal.hidden && !e.target.closest(".modal")) return;
    const el = e.target.closest("[data-item]");
    if (!el || e.target.closest("input, textarea, .mclose, button:not([data-item])")) return;
    D = { el, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, touch: e.pointerType !== "mouse", on: false, timer: 0 };
    if (D.touch) D.timer = setTimeout(begin, 260);
  }, { passive: true });
  function begin() {
    if (!D || D.on) return;
    D.on = true; clearTimeout(D.timer);
    const p = byTitle.get(norm(D.el.dataset.item));
    ghost = document.createElement("div"); ghost.className = "dragghost";
    ghost.innerHTML = `${thumb(p || { title: D.el.dataset.item })}<span>${esc(D.el.dataset.item)}</span>`;
    document.body.appendChild(ghost);
    document.body.classList.add("dragging");
    Snd.pop(); if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
    place();
  }
  function place() { if (ghost) ghost.style.transform = `translate(${D.lx + 14}px, ${D.ly - 26}px) rotate(-3deg)`; }
  function overDock() {
    const r = dock.getBoundingClientRect(), m = 30;
    return D.lx > r.left - m && D.lx < r.right + m && D.ly > r.top - m && D.ly < r.bottom + m;
  }
  document.addEventListener("pointermove", (e) => {
    if (!D) return;
    D.lx = e.clientX; D.ly = e.clientY;
    if (!D.on) {
      const dist = Math.hypot(e.clientX - D.x, e.clientY - D.y);
      if (D.touch) { if (dist > 10) { clearTimeout(D.timer); D = null; } }
      else if (dist > 6) begin();
      return;
    }
    place();
    const hot = overDock();
    if (hot !== dock.classList.contains("hot")) { dock.classList.toggle("hot", hot); if (hot) Snd.select(); }
  }, { passive: true });
  function endDrag(cancel) {
    if (!D) return;
    clearTimeout(D.timer);
    if (D.on) {
      const drop = !cancel && overDock(), title = D.el.dataset.item;
      suppress = true; setTimeout(() => (suppress = false), 60);
      document.body.classList.remove("dragging"); dock.classList.remove("hot");
      const g = ghost; ghost = null;
      if (drop) {
        const r = dock.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        g.classList.add("sink"); g.style.transform = `translate(${cx - 30}px, ${cy - 20}px) scale(.3)`;
        setTimeout(() => g.remove(), 300);
        burst(cx, cy, 18); Snd.success();
        setTimeout(() => openItem(title), 160);
      } else { g.classList.add("sink"); setTimeout(() => g.remove(), 250); Snd.drop(); }
    }
    D = null;
  }
  document.addEventListener("pointerup", () => endDrag(false));
  document.addEventListener("pointercancel", () => endDrag(true));
  document.addEventListener("click", (e) => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener("touchmove", (e) => { if (D && D.on) e.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", (e) => { if (D && D.touch) e.preventDefault(); });
  document.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest("[data-item]")) e.preventDefault(); });

  /* ---------- routing ---------- */
  function route() {
    if (!pages.length) return;
    closeModal();
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const isCraft = raw === "craft" || raw.startsWith("craft/");
    const isMap = raw === "map" || raw.startsWith("map/");
    $("#tab-search").classList.toggle("on", !isCraft && !isMap);
    $("#tab-craft").classList.toggle("on", isCraft);
    $("#tab-map").classList.toggle("on", isMap);
    const h = raw.replace(/_/g, " ");
    const p = !isCraft && !isMap && h && byTitle.get(norm(h));
    $("#searchbar").hidden = !!p || isCraft || isMap;
    list.hidden = !!p || isCraft || isMap;
    pageEl.hidden = !p;
    craftEl.hidden = !isCraft;
    mapEl.hidden = !isMap;
    if (!isMap && CX.map && CX.map.hide) CX.map.hide();
    if (isMap) {
      document.title = "World map – Cubination Index";
      if (CX.map) CX.map.show(raw.slice(4).replace(/^\//, ""));
      else mapEl.innerHTML = '<div class="empty"><b>Map failed to load.</b></div>';
    } else if (isCraft) {
      const keys = raw.slice(6).split("~").filter(Boolean)
        .map((s) => { const pg = byTitle.get(norm(s.replace(/_/g, " "))); return pg ? norm(pg.title) : norm(s.replace(/_/g, " ")); })
        .filter((k) => ingredients.has(k)).slice(0, 3);
      showCraft(keys); window.scrollTo(0, 0);
    } else if (p) {
      showPage(p); window.scrollTo(0, 0);
    } else {
      document.title = "Cubination Index – search cubes, armor, weapons, recipes & the map";
      render();
    }
  }
  window.addEventListener("hashchange", route);

  /* ---------- shared API for map.js ---------- */
  window.CX = window.CX || {};
  Object.assign(window.CX, { esc, norm, nk, slug, ICON, Snd, burst, thumb, tagHtml, grid, openItem, recipesFor, noEmoji, onReady: (f) => (pages.length ? f() : readyCbs.push(f)) });
  // live views (Object.assign would copy these once, so define them as real getters)
  Object.defineProperties(window.CX, { pages: { get: () => pages, configurable: true }, byTitle: { get: () => byTitle, configurable: true } });
})();
