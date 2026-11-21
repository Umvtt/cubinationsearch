# Cubination Index

Fan-made search site for the Roblox game **Cubination**: cubes, armor, weapons, enemies, islands, recipes.
Data comes from the [Cubination Wiki](https://cubination.fandom.com) (CC BY-SA).

No build step, no dependencies: plain HTML/CSS/JS plus a `data.json` snapshot of the wiki.

## Publish on GitHub Pages
Repo **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

## Update the data
- Automatic: `.github/workflows/refresh-data.yml` re-pulls the wiki every Monday (or run it from the Actions tab).
- Manual: `python3 scripts/build_data.py` (stdlib only), then commit `data.json`.

## Run locally
```
python3 -m http.server 8000
```
