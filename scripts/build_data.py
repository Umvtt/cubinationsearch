#!/usr/bin/env python3
"""Pulls every article from the Cubination wiki (Fandom) into data.json.

Usage:  python3 scripts/build_data.py
Only needs the Python standard library.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

WIKI = "https://cubination.fandom.com"
API = WIKI + "/api.php"
OUT = Path(__file__).resolve().parent.parent / "data.json"
UA = "cubination-search/1.0 (fan-made static search site)"


def api(**params):
    params["format"] = "json"
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # network hiccup, retry
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))


# ---------------------------------------------------------------- HTML cleanup
ALLOWED = {
    "p", "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th",
    "b", "strong", "i", "em", "br", "h2", "h3", "h4", "span", "dl", "dt", "dd",
    "sup", "sub", "caption",
}
# elements whose whole subtree we throw away
SKIP_CLASSES = {
    "toc", "mw-editsection", "navbox", "noprint", "reference", "references",
    "mw-references-wrap", "gallery", "wikia-gallery", "portable-infobox",
    "mbox", "ambox", "hatnote",
}
SKIP_TAGS = {"script", "style", "figure", "img", "noscript", "video", "audio", "iframe"}
VOID = {"br", "img", "hr", "meta", "link", "input"}
COLOR = re.compile(r"color\s*:\s*(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)")


def slug(title):
    return title.replace(" ", "_")


class Cleaner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip_depth = 0   # >0 while inside a skipped subtree
        self.stack = []       # (tag, emitted_tag_or_None)
        self.text = []        # plain text for searching

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in VOID:
            if self.skip_depth == 0 and tag == "br":
                self.out.append("<br>")
            return
        classes = set((a.get("class") or "").split())
        skip = self.skip_depth > 0 or tag in SKIP_TAGS or classes & SKIP_CLASSES
        if skip:
            self.skip_depth += 1
            self.stack.append((tag, "SKIP"))
            return
        emitted = None
        if tag == "a":
            href = a.get("href") or ""
            m = re.match(r"^/wiki/([^#?]+)", href)
            if m and "new" not in classes and ":" not in urllib.parse.unquote(m.group(1)):
                title = urllib.parse.unquote(m.group(1)).replace("_", " ")
                self.out.append('<a href="#/%s" data-t="%s">' % (
                    urllib.parse.quote(slug(title)), title.replace('"', "&quot;")))
                emitted = "a"
        elif tag in ALLOWED:
            extra = ""
            if tag == "span":
                m = COLOR.search(a.get("style") or "")
                if m:
                    extra = ' style="color:%s"' % m.group(1)
                else:
                    self.stack.append((tag, None))
                    return
            if tag in ("td", "th"):
                for k in ("colspan", "rowspan"):
                    if a.get(k, "").isdigit():
                        extra += ' %s="%s"' % (k, a[k])
            if tag == "table":
                extra += ' class="wt"'
            self.out.append("<%s%s>" % (tag, extra))
            emitted = tag
        self.stack.append((tag, emitted))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # pop to matching tag
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                popped = self.stack[i:]
                del self.stack[i:]
                for t, e in reversed(popped):
                    if e == "SKIP":
                        self.skip_depth -= 1
                    elif e:
                        self.out.append("</%s>" % e)
                return

    def handle_data(self, data):
        if self.skip_depth:
            return
        self.out.append(data.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        self.text.append(data)


def clean_html(html):
    # Fandom wraps headings in <span class=mw-headline>; drop id noise by regex first
    c = Cleaner()
    c.feed(html)
    out = "".join(c.out)
    out = re.sub(r"<(p|li|span|b|strong|i|em)>\s*</\1>", "", out)
    out = re.sub(r"(<br>\s*){3,}", "<br><br>", out)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    text = re.sub(r"\s+", " ", "".join(c.text)).strip()
    return out, text


# ---------------------------------------------------------------- recipes
LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def strip_links(s):
    s = LINK.sub(lambda m: m.group(2) or m.group(1), s)
    return re.sub(r"'{2,}", "", s).strip()


def parse_recipes(wikitext):
    """Lines like:  * [[A]] 🔗 [[B]] > '''C'''   (🔥 = furnace, 🔗 = combine)."""
    section = None
    recipes = []
    for line in wikitext.splitlines():
        h = re.match(r"^=+\s*'*\s*(.*?)\s*'*\s*=+\s*$", line)
        if h:
            name = h.group(1).lower()
            if name.startswith(("obtain", "obtainment")):
                section = "obtain"
            elif name.startswith("uses"):
                section = "use"
            elif not name.startswith("recipe"):
                section = None
            continue
        if not line.lstrip().startswith("*") or ">" not in line:
            continue
        body = line.lstrip("* ").strip()
        left, _, right = body.rpartition(">")
        if not left:
            continue
        method = "furnace" if "🔥" in left else "combine" if "🔗" in left else "other"
        ingredients = []
        for part in re.split(r"🔥|🔗|\+", left):
            part = re.sub(r"^[\s🏝️🏝]+", "", part)
            part = re.sub(r"\(([^)]*)\)", "", part) if method == "furnace" else part
            n = strip_links(part)
            if n:
                ingredients.append(n)
        result = strip_links(right)
        if ingredients and result:
            recipes.append({
                "kind": section or "other",
                "method": method,
                "from": ingredients,
                "to": result,
                "raw": strip_links(body),
            })
    return recipes


# ---------------------------------------------------------------- main
def all_pages():
    pages, cont = {}, {}
    while True:
        d = api(action="query", generator="allpages", gapnamespace=0,
                gapfilterredir="nonredirects", gaplimit=50,
                prop="categories|pageimages", cllimit="max", piprop="thumbnail",
                pithumbsize=300, **cont)
        for pid, p in d.get("query", {}).get("pages", {}).items():
            e = pages.setdefault(p["title"], {"cats": set(), "img": None})
            for c in p.get("categories", []):
                e["cats"].add(c["title"].split(":", 1)[1])
            if p.get("thumbnail"):
                e["img"] = p["thumbnail"]["source"]
        if "continue" not in d:
            break
        cont = d["continue"]
    return pages


def main():
    pages = all_pages()
    print("found %d articles" % len(pages), file=sys.stderr)
    out = []
    for i, (title, meta) in enumerate(sorted(pages.items()), 1):
        try:
            d = api(action="parse", page=title, prop="text|wikitext", redirects=1,
                    disablelimitreport=1, disableeditsection=1)["parse"]
        except Exception as e:
            print("  skip %s: %s" % (title, e), file=sys.stderr)
            continue
        html, text = clean_html(d["text"]["*"])
        wt = d["wikitext"]["*"]
        if re.match(r"^\s*#redirect", wt, re.I) or len(text) < 3:
            continue
        # first sentence-ish summary
        summary = re.sub(r"\s+", " ", text)[:220]
        out.append({
            "title": title,
            "cats": sorted(meta["cats"]),
            "img": meta["img"],
            "summary": summary,
            "html": html,
            "text": text,
            "recipes": parse_recipes(wt),
        })
        if i % 25 == 0:
            print("  %d/%d" % (i, len(pages)), file=sys.stderr)
        time.sleep(0.15)

    OUT.write_text(json.dumps({
        "source": WIKI,
        "built": time.strftime("%Y-%m-%d", time.gmtime()),
        "pages": out,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote %s (%d pages, %d KB)" % (OUT, len(out), OUT.stat().st_size // 1024), file=sys.stderr)


if __name__ == "__main__":
    main()
