(() => {
  const $ = (s) => document.querySelector(s);
  const q = $("#q"), list = $("#list"), pageEl = $("#page"), catsEl = $("#cats");
  const PAGE_SIZE = 40;
  // categories that are wiki housekeeping, not useful to browse
  const HIDE_CATS = new Set(["Pages with broken file links", "Stubs", "Stub", "Cubination Wiki", "Community", "Images", "Media", "Maintenance", "Candidates for deletion", "Documentation templates"]);

  let pages = [], byTitle = new Map(), cat = "All", shown = PAGE_SIZE, selected = -1, currentResults = [];

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const slug = (t) => encodeURIComponent(t.replace(/ /g, "_"));

  fetch("data.json").then((r) => r.json()).then((d) => {
    pages = d.pages.map((p) => ({
      ...p,
      cats: p.cats.filter((c) => !HIDE_CATS.has(c)),
      _t: norm(p.title),
      _c: norm(p.cats.join(" ")),
      _r: norm(p.recipes.map((r) => r.raw).join(" ")),
      _x: norm(p.text),
    }));
    pages.forEach((p) => byTitle.set(p._t, p));
    $("#wikilink").href = d.source;
    $("#built").textContent = "Data last refreshed " + d.built + ".";
    buildCats();
    route();
  }).catch(() => {
    list.innerHTML = '<div class="empty"><b>Couldn\'t load the data.</b><p>Try reloading the page.</p></div>';
  });

  /* ---------- categories ---------- */
  function buildCats() {
    const counts = {};
    pages.forEach((p) => p.cats.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    const top = Object.entries(counts).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
    // armor first, since that's what most people come for
    top.sort((a, b) => (b[0] === "Armor") - (a[0] === "Armor") || b[1] - a[1]);
    const all = [["All", pages.length], ...top];
    catsEl.innerHTML = all.map(([c, n]) => `<button role="tab" aria-selected="${c === cat}" data-c="${esc(c)}">${esc(c)}<span>${n}</span></button>`).join("");
  }
  catsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    cat = b.dataset.c; shown = PAGE_SIZE;
    catsEl.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", x === b));
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
    for (const t of tokens) {
      let hit = 0;
      const words = p._t.split(" ");
      if (words.includes(t)) hit = 40;
      else if (words.some((w) => w.startsWith(t))) hit = 28;
      else if (p._t.includes(t)) hit = 18;
      else if (p._c.includes(t)) hit = 14;
      else if (p._r.includes(t)) hit = 8;
      else if (p._x.includes(t)) hit = 3;
      else if (t.length > 3 && words.some((w) => lev(w, t) <= (t.length > 5 ? 2 : 1))) hit = 12; // typo
      if (!hit) return 0;          // every word must match something
      s += hit;
    }
    // items that are actually *in* the searched category beat loose name matches
    for (const t of tokens) if (p.cats.some((c) => norm(c) === t || norm(c) === t + "s" || norm(c).startsWith(t + " "))) s += 35;
    return s;
  }

  function search(text) {
    const full = norm(text.replace(/armour/gi, "armor"));
    let pool = cat === "All" ? pages : pages.filter((p) => p.cats.includes(cat));
    if (!full) return pool.slice().sort((a, b) => a.title.localeCompare(b.title));
    const tokens = full.split(" ").map((t) => t.replace(/s$/, (m) => (t.length > 3 ? "" : m)));
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

  const thumb = (p) => p.img
    ? `<div class="thumb"><img src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`
    : `<div class="thumb">${esc(p.title[0])}</div>`;

  function snippet(p, terms) {
    // show the part of the text that matches, if the match isn't at the start
    const lower = p.text.toLowerCase();
    for (const t of terms) {
      const i = lower.indexOf(t);
      if (i > 60) return "…" + p.text.slice(Math.max(0, i - 50), i + 130);
    }
    return p.summary;
  }

  function render() {
    const text = q.value.trim();
    currentResults = search(text);
    const terms = norm(text).split(" ").filter(Boolean);
    selected = -1;
    if (!currentResults.length) {
      let hint = "";
      if (cat !== "All") hint = `<p>Nothing in <b>${esc(cat)}</b>. <span class="didyou"><button data-all>Search all categories</button></span></p>`;
      list.innerHTML = `<div class="empty"><b>No match for “${esc(text)}”.</b>${hint}<p>Try fewer words, or just the item name (e.g. “steel”).</p></div>`;
      list.querySelector("[data-all]")?.addEventListener("click", () => catsEl.querySelector("[data-c=All]").click());
      return;
    }
    const slice = currentResults.slice(0, shown);
    list.innerHTML =
      `<div class="meta">${currentResults.length} result${currentResults.length === 1 ? "" : "s"}${cat !== "All" ? " in " + esc(cat) : ""}</div>` +
      slice.map((p) => `<a class="row" href="#/${slug(p.title)}">${thumb(p)}<div>
        <h3>${hl(p.title, terms)}</h3>
        <div class="tags">${p.cats.slice(0, 3).map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div>
        <p>${hl(snippet(p, terms), terms)}</p></div></a>`).join("") +
      (currentResults.length > shown ? `<button class="more">Show more (${currentResults.length - shown})</button>` : "");
    list.querySelector(".more")?.addEventListener("click", () => { shown += PAGE_SIZE; render(); });
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
    } else if (e.key === "Enter") {
      (rows[selected] || rows[0])?.click();
    } else if (e.key === "Escape") { q.value = ""; render(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== q && !e.metaKey && !e.ctrlKey) { e.preventDefault(); q.focus(); q.select(); }
  });

  /* ---------- detail page ---------- */
  function showPage(p) {
    const mine = new Set([p._t]);
    // recipes from *other* pages that mention this item
    const key = (r) => [...r.from].map(norm).sort().join("+") + ">" + norm(r.to);
    const seen = new Set(p.recipes.map(key));
    const also = [];
    for (const o of pages) {
      if (o === p) continue;
      for (const r of o.recipes) {
        if (seen.has(key(r))) continue;
        if ([...r.from, r.to].some((n) => mine.has(norm(n)))) { seen.add(key(r)); also.push({ r, from: o }); }
      }
    }
    const link = (n) => byTitle.has(norm(n)) ? `<a href="#/${slug(byTitle.get(norm(n)).title)}">${esc(n)}</a>` : esc(n);
    const fmt = (r) => r.from.map(link).join(r.method === "furnace" ? " 🔥 " : " 🔗 ") + " &gt; " + link(r.to);
    pageEl.innerHTML = `
      <a class="back" href="#/">&larr; back to search</a>
      <div class="head">${thumb(p)}<div><h1>${esc(p.title)}</h1>
        <div class="tags">${p.cats.map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div></div></div>
      <div class="body">${p.html}</div>
      ${also.length ? `<div class="also"><h2>Also shows up in</h2><ul>${also.slice(0, 25).map((a) => `<li>${fmt(a.r)}</li>`).join("")}</ul></div>` : ""}
      <div class="src">Source: <a href="${esc("https://cubination.fandom.com/wiki/" + p.title.replace(/ /g, "_"))}" target="_blank" rel="noopener">${esc(p.title)} on the wiki</a></div>`;
    document.title = p.title + " – Cubination Index";
  }

  /* ---------- routing ---------- */
  function route() {
    if (!pages.length) return;
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")).replace(/_/g, " ");
    const p = h && byTitle.get(norm(h));
    if (p) {
      list.hidden = true; $("#searchbar").querySelector(".lbl").hidden = true;
      pageEl.hidden = false; showPage(p); window.scrollTo(0, 0);
    } else {
      pageEl.hidden = true; list.hidden = false; $("#searchbar").querySelector(".lbl").hidden = false;
      document.title = "Cubination Index – search cubes, armor, weapons & more";
      render();
    }
  }
  window.addEventListener("hashchange", route);
})();
