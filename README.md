# mmk79.github.io

Personal site of Masoud Mohararzadeh: selected research notes (from an Obsidian vault) and the interactive MSc thesis website.
Built with [Quartz](https://quartz.jzhao.xyz) v5, deployed to GitHub Pages by `.github/workflows/deploy.yml`.

## Publish a note
1. In the vault, add `publish: true` to the note's frontmatter. For Excalidraw drawings, turn on the Excalidraw plugin's
   *Auto-export SVG*; embeds are swapped for the exported SVG.
2. `python3 scripts/sync_vault.py --dry-run` lists what would go online; `python3 scripts/sync_vault.py` copies it into `content/`
   (it refuses notes that look like they contain secrets). Quartz's explicit-publish plugin is a second guard.
3. Commit and push; GitHub Actions builds and deploys.

Jupyter notebooks: link one from a published note (`[[My Lab.ipynb]]`). The sync renders it with its saved outputs
(text, tables, plots, math) to `notebooks/my-lab`, adds a download of the `.ipynb`, and rewrites the link. Run the notebook
before syncing; nothing is executed. Needs `uvx` (nbconvert is fetched on first use).

## The thesis website (/thesis/)
In `Thesis-coding-projects/thesis-site`, run `make publish`. It exports the built site for the `/thesis` sub-path into `thesis-build/`
here (downloaded course materials are never included) and also refreshes the local Docker copy. Commit `thesis-build/` and push.

## Linking to the thesis site
Always link it as `<a href="/thesis/" data-router-ignore>…</a>`, not a Markdown link. Quartz's page-switching otherwise
swaps the thesis page in without running its scripts, and every page comes up empty.

## Local preview
`npx quartz build --serve` (notes only), or build + `cp -R thesis-build public/thesis` + any static server.

## Notes
- Quartz's tooling is npm-based (`npm ci`, `npx quartz plugin install`), so this repo uses npm and `package-lock.json`,
  as an exception to the usual pnpm rule.
- Upstream Quartz is the `upstream` remote; `npx quartz upgrade` pulls updates.
- Quartz is MIT-licensed (`LICENSE.txt`).
