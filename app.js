(() => {
  const $ = (s) => document.querySelector(s);
  const q = $("#q"), list = $("#list"), pageEl = $("#page"), catsEl = $("#cats"), craftEl = $("#craft"), quickEl = $("#quick");
  const PAGE_SIZE = 40;
  const HIDE_CATS = new Set(["Pages with broken file links", "Stubs", "Stub", "Cubination Wiki", "Community", "Images", "Media", "Maintenance", "Candidates for deletion", "Documentation templates"]);
  const MAIN_CATS = ["Armor", "Cubes", "Weapons", "Equipment", "Enemies", "Islands"];
  const QUICK = ["Armor Cube", "Steel Sword", "Regen Coil", "Raider", "Iron Cube"];

  let pages = [], byTitle = new Map(), cat = "All", shown = PAGE_SIZE, selected = -1, currentResults = [], showAllCats = false;
  let recipes = [], ingredients = new Map(); // global recipe index

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const slug = (t) => encodeURIComponent(t.replace(/ /g, "_"));
  const noEmoji = (s) => s.replace(/🔗️?/g, "+").replace(/🔥️?/g, "in").replace(/🏝️?/g, "").replace(/\s+/g, " ");
  const pageFor = (name, target) => byTitle.get(norm(target || "")) || byTitle.get(norm(name));
  const splitAlt = (n) => { const m = n.match(/^(.*?)\s*\((.*)\)\s*$/); return m ? [m[1], m[2]] : [n, ""]; };

  /* ---------- animated icons (inline SVG, animated in CSS) ---------- */
  const ICON = {
    flame: '<svg class="ico ico-flame" viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 2 2 3 2 0-3-1-5 0-7z" fill="#e8590c"/><path class="g" d="M12 22a3.5 3.5 0 0 1-3.5-3.5c0-2 2-3 3.5-5 1.5 2 3.5 3 3.5 5A3.5 3.5 0 0 1 12 22z" fill="#ffd43b"/></svg>',
    link: '<svg class="ico ico-link" viewBox="0 0 24 24" aria-hidden="true"><rect class="l1" x="1.5" y="8" width="12" height="8" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><rect class="l2" x="10.5" y="8" width="12" height="8" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    island: '<svg class="ico ico-island" viewBox="0 0 24 24" aria-hidden="true"><g class="palm"><path d="M13 18c0-4 .5-6 1-9" stroke="#8a5a2b" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M14 9c-3-3-6-2-8 0 3-1 5 0 8 0zM14 9c3-3 6-2 8 0-3-1-5 0-8 0zM14 9c-1-4 1-6 3-6-1 2-1 4-3 6z" fill="#2f9e44"/></g><path d="M5 19a8 4 0 0 1 14 0z" fill="#e0b25c"/><path class="wave" d="M1 22c3-2 5-2 8 0s5 2 8 0 4-2 6 0" stroke="#339af0" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    arrow: '<svg class="ico ico-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h15M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.8" fill="none" stroke-linecap="square"/></svg>',
    spark: '<svg class="ico ico-spark" viewBox="0 0 24 24" aria-hidden="true"><path class="s" d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z" fill="currentColor"/><path class="s s2" d="M18 14l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="currentColor"/></svg>',
  };
  const METHOD = {
    combine: [ICON.link, "Combine"],
    furnace: [ICON.flame, "Furnace"],
    other: [ICON.island, "Found"],
  };

  /* ---------- load ---------- */
  list.innerHTML = '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  fetch("data.json").then((r) => r.json()).then((d) => {
    pages = d.pages.map((p) => ({
      ...p,
      cats: p.cats.filter((c) => !HIDE_CATS.has(c)),
      _t: norm(p.title), _c: norm(p.cats.join(" ")),
      _r: norm(p.recipes.map((r) => r.raw).join(" ")), _x: norm(p.text),
    }));
    pages.forEach((p) => byTitle.set(p._t, p));
    buildRecipeIndex();
    $("#wikilink").href = d.source;
    $("#built").textContent = "Data last refreshed " + d.built + ".";
    buildQuick(); buildCats(); route();
  }).catch(() => {
    list.innerHTML = '<div class="empty"><b>Couldn\'t load the data.</b><p>Try reloading the page.</p></div>';
  });

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

  function tile(name, target, hiKey, cls = "") {
    const [main, alt] = splitAlt(name);
    const pg = pageFor(main, target);
    const key = norm(pg ? pg.title : main);
    const img = pg && pg.img ? `<img src="${esc(pg.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc(main[0] || "?");
    const inner = `<span class="thumb sm">${img}</span><span class="cap">${esc(main)}${alt ? `<small>or ${esc(alt)}</small>` : ""}</span>`;
    const c = `tile ${cls}${hiKey && key === hiKey ? " hi" : ""}`;
    return pg ? `<a class="${c}" href="#/${slug(pg.title)}" title="${esc(pg.title)}">${inner}</a>` : `<span class="${c}">${inner}</span>`;
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
    if (b.dataset.random !== undefined) { const p = pages[Math.floor(Math.random() * pages.length)]; location.hash = "#/" + slug(p.title); return; }
    q.value = b.dataset.q; shown = PAGE_SIZE; render(); q.focus();
  });

  function buildCats() {
    const counts = {};
    pages.forEach((p) => p.cats.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    const rest = Object.entries(counts).filter(([c, n]) => n >= 3 && !MAIN_CATS.includes(c)).sort((a, b) => b[1] - a[1]);
    const main = MAIN_CATS.filter((c) => counts[c]).map((c) => [c, counts[c]]);
    const items = [["All", pages.length], ...main, ...(showAllCats ? rest : [])];
    catsEl.innerHTML = items.map(([c, n]) => `<button role="tab" aria-selected="${c === cat}" data-c="${esc(c)}">${esc(c)}<span>${n}</span></button>`).join("") +
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

  function search(text) {
    const full = norm(text.replace(/armour/gi, "armor"));
    const pool = cat === "All" ? pages : pages.filter((p) => p.cats.includes(cat));
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

  const thumb = (p, cls = "") => p && p.img
    ? `<div class="thumb ${cls}"><img src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`
    : `<div class="thumb ${cls}">${esc((p && p.title[0]) || "?")}</div>`;

  function snippet(p, terms) {
    const text = noEmoji(p.text), lower = text.toLowerCase();
    for (const t of terms) {
      const i = lower.indexOf(t);
      if (i > 60) return "…" + text.slice(Math.max(0, i - 50), i + 130);
    }
    return noEmoji(p.summary);
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
    list.innerHTML =
      `<div class="meta"><span>${currentResults.length} result${currentResults.length === 1 ? "" : "s"}${cat !== "All" ? " in " + esc(cat) : ""}</span></div>` +
      slice.map((p, i) => `<a class="row" style="--i:${Math.min(i, 12)}" href="#/${slug(p.title)}">${thumb(p)}<div>
        <h3>${hl(p.title, terms)}</h3>
        <div class="tags">${p.cats.slice(0, 3).map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
        <p>${hl(snippet(p, terms), terms)}</p></div><span class="go">${ICON.arrow}</span></a>`).join("") +
      (currentResults.length > shown ? `<button class="morebtn">Show more (${currentResults.length - shown})</button>` : "");
    list.querySelector(".morebtn")?.addEventListener("click", () => { shown += PAGE_SIZE; render(); });
  }

  q.addEventListener("input", () => {
    shown = PAGE_SIZE;
    if (location.hash.length > 2) { history.replaceState(null, "", "#/"); route(); } else render();
  });
  q.addEventListener("keydown", (e) => {
    const rows = [...list.querySelectorAll(".row")];
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
    if (e.key === "/" && tag !== "INPUT" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if ($("#craft").hidden) { q.focus(); q.select(); } else $("#craftin")?.focus();
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
    while (changed) {            // drop headings left with nothing under them
      changed = false;
      t.content.querySelectorAll("h2,h3,h4").forEach((h) => {
        const n = h.nextElementSibling;
        if (!n || (/^H[2-4]$/.test(n.tagName) && n.tagName <= h.tagName)) { h.remove(); changed = true; }
      });
    }
    return t.innerHTML.trim();
  }

  function showPage(p) {
    const me = p._t, seen = new Set(), makes = [], uses = [];
    const add = (r, isMake) => { const k = rkey(r); if (seen.has(k)) return; seen.add(k); (isMake ? makes : uses).push(r); };
    p.recipes.forEach((r) => add(r, r.kind === "obtain"));
    recipes.forEach((r) => { if (r._out === me) add(r, true); else if (r._in.includes(me)) add(r, false); });
    const body = cleanBody(p);
    pageEl.innerHTML = `
      <a class="back" href="#/">&larr; back to search</a>
      <div class="head">${thumb(p)}<div><h1>${esc(p.title)}</h1>
        <div class="tags">${p.cats.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
        ${uses.length ? `<a class="cta" href="#/craft/${slug(p.title)}">${ICON.spark} What can I craft with this?</a>` : ""}</div></div>
      ${makes.length ? `<h2 class="sec">${ICON.link} How to get it <small>${makes.length}</small></h2>${grid(makes, me)}` : ""}
      ${uses.length ? `<h2 class="sec">${ICON.flame} What it’s used for <small>${uses.length}</small></h2>${grid(uses, me)}` : ""}
      ${body ? `<h2 class="sec">From the wiki</h2><div class="body">${body}</div>` : ""}
      <div class="src">Source: <a href="https://cubination.fandom.com/wiki/${esc(p.title.replace(/ /g, "_"))}" target="_blank" rel="noopener">${esc(p.title)} on the wiki</a></div>`;
    document.title = p.title + " – Cubination Index";
  }

  /* ---------- craft finder ---------- */
  let picked = []; // ingredient keys

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
    craftEl.innerHTML = `
      <div class="panel">
        <h1>What can I craft?</h1>
        <p class="lead">Pick a cube or item you have. Add a second one to see what the two make together.</p>
        <div class="picker">
          <input id="craftin" class="craftin" type="text" autocomplete="off" spellcheck="false" placeholder="Start typing: iron cube, wood cube…">
          <div class="sugg" hidden></div>
        </div>
        <div class="chips">${chips.map((c) => `<span class="chip">${thumb(c.page, "")}${esc(c.label)}<button data-rm="${esc(c.key)}" aria-label="Remove ${esc(c.label)}">×</button></span>`).join("")}</div>
        ${chips.length ? "" : `<div class="hint">Popular ingredients</div><div class="tryrow">${popular.map((c) => `<button class="chipbtn" data-add="${esc(c.key)}">${esc(c.label)}</button>`).join("")}</div>`}
      </div>${results}`;
    wireCraft();
  }

  function setPicked(keys) { location.hash = "#/craft" + (keys.length ? "/" + keys.map((k) => slug(ingredients.get(k).label)).join("~") : ""); }

  function wireCraft() {
    const input = $("#craftin"), box = craftEl.querySelector(".sugg");
    let sel = 0, opts = [];
    const open = () => {
      const t = norm(input.value);
      opts = [...ingredients.values()].filter((e) => !picked.includes(e.key) && (!t || e.key.includes(t)))
        .sort((a, b) => (b.key.startsWith(t) - a.key.startsWith(t)) || b.count - a.count).slice(0, 8);
      sel = 0;
      box.hidden = !opts.length || (!t && document.activeElement !== input);
      box.innerHTML = opts.map((e, i) => `<button data-add="${esc(e.key)}" class="${i === 0 ? "sel" : ""}">${thumb(e.page)}${esc(e.label)}<small>${e.count} recipe${e.count > 1 ? "s" : ""}</small></button>`).join("");
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

  /* ---------- routing ---------- */
  function route() {
    if (!pages.length) return;
    const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const isCraft = raw === "craft" || raw.startsWith("craft/");
    $("#tab-search").classList.toggle("on", !isCraft);
    $("#tab-craft").classList.toggle("on", isCraft);
    const h = raw.replace(/_/g, " ");
    const p = !isCraft && h && byTitle.get(norm(h));
    $("#searchbar").hidden = !!p || isCraft;
    list.hidden = !!p || isCraft;
    pageEl.hidden = !p;
    craftEl.hidden = !isCraft;
    if (isCraft) {
      const keys = raw.slice(6).split("~").filter(Boolean)
        .map((s) => { const pg = byTitle.get(norm(s.replace(/_/g, " "))); return pg ? norm(pg.title) : norm(s.replace(/_/g, " ")); })
        .filter((k) => ingredients.has(k)).slice(0, 3);
      showCraft(keys); window.scrollTo(0, 0);
    } else if (p) {
      showPage(p); window.scrollTo(0, 0);
    } else {
      document.title = "Cubination Index – search cubes, armor, weapons & recipes";
      render();
    }
  }
  window.addEventListener("hashchange", route);
})();
