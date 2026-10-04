#!/usr/bin/env python3
"""Copy the vault notes marked `publish: true` into content/ for Quartz, with what they embed.

    python3 scripts/sync_vault.py            # sync
    python3 scripts/sync_vault.py --dry-run  # list what would be published
    python3 scripts/sync_vault.py --test     # self-check

- Only notes whose frontmatter has `publish: true` are copied (Quartz's explicit-publish plugin is the second guard).
- Embedded images (`![[x.png]]`) are copied from wherever they live in the vault.
- Excalidraw: `![[Drawing]]` / `![[Drawing.excalidraw]]` becomes the SVG the Excalidraw plugin auto-exports
  (`Drawing.svg` or `Drawing.excalidraw.svg`); turn on *Auto-export SVG* in the plugin. The raw `.excalidraw.md` is never published.
- Each note goes into a sidebar section by its frontmatter: `[[Research]]` category → research/, a `course:` → courses/<course>/,
  anything else → notes/ (sections are listed A–Z).
- Jupyter notebooks linked from a published note (`[[x.ipynb]]` or `![[x.ipynb]]`) are rendered to a page
  `notebooks/x.md` (nbconvert, outputs and plots included) next to a download of the `.ipynb`; the link is rewritten to the page.
- A note that looks like it holds a secret (API key, password, token) is refused, and the sync stops.
Stdlib only, plus `uvx --from nbconvert` for notebooks.
"""
import os, pathlib, re, shutil, subprocess, sys, tempfile

VAULT = pathlib.Path(os.environ.get("VAULT", pathlib.Path.home() / "Documents/Obsidian Vaults/Personal"))
HERE = pathlib.Path(__file__).resolve().parent.parent
CONTENT = HERE / "content"
KEEP = {"index.md"}  # content/ files owned by this repo, never deleted by a sync
SKIP_DIRS = {".obsidian", ".git", ".trash", "Templates", "Clippings", "_review", ".cache", ".provenance", "Job", "Daily"}
SECRET = re.compile(r"(?i)(api[_-]?key|secret|password|passphrase|token)\s*[:=]\s*\S{6,}|sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY")
EMBED = re.compile(r"!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")
NBLINK = re.compile(r"!?\[\[([^\]|#]+\.ipynb)(\|[^\]]*)?\]\]")


def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    return m.group(1) if m else ""


def published(text):
    return re.search(r"(?m)^publish:\s*(true|yes)\s*$", frontmatter(text)) is not None


def vault_files():
    for p in VAULT.rglob("*"):
        if p.is_file() and not any(part in SKIP_DIRS for part in p.relative_to(VAULT).parts):
            yield p


def find(name, index):
    """Resolve an embed target by file name (Obsidian 'shortest path' links)."""
    return index.get(name) or index.get(name.lower())


def excalidraw_svg(name, index):
    base = re.sub(r"\.(excalidraw(\.md)?|md)$", "", name)
    for cand in (f"{base}.excalidraw.svg", f"{base}.svg"):
        hit = find(cand, index)
        if hit:
            return hit
    return None


SECTIONS = {"research": "Research", "notebooks": "Notebooks", "courses": "Courses", "notes": "Notes"}


def section(text):
    fm = frontmatter(text)
    course = re.search(r'(?m)^course:\s*"?\[\[([^\]|]+)', fm)
    if course:
        return f"courses/{course.group(1).strip()}"
    return "research" if re.search(r"\[\[Research\]\]", fm) else "notes"


def notebook(src, out_dir):
    """Render one notebook to out_dir/<stem>.md (+ <stem>_files/ images) and copy the .ipynb beside it."""
    with tempfile.TemporaryDirectory() as tmp:
        shutil.copy2(src, tmp)
        subprocess.run(["uvx", "--from", "nbconvert", "jupyter-nbconvert", "--to", "markdown", src.name], cwd=tmp, check=True, capture_output=True)
        md = pathlib.Path(tmp, src.stem + ".md").read_text(encoding="utf-8")
        if SECRET.search(md):
            sys.exit(f"refusing to publish notebook that looks like it contains secrets: {src}")
        out_dir.mkdir(parents=True, exist_ok=True)
        files = pathlib.Path(tmp, src.stem + "_files")
        if files.exists():
            shutil.copytree(files, out_dir / files.name, dirs_exist_ok=True)
        dl = re.sub(r"[^a-z0-9.]+", "-", src.name.lower())  # the file name Quartz would slug it to anyway
        shutil.copy2(src, out_dir / dl)
        head = f'---\ntitle: "{src.stem}"\npublish: true\ntags: [notebook]\n---\n\n> [!info] Jupyter notebook, rendered with its saved outputs. [Download {src.name}](./{dl})\n\n'
        (out_dir / (src.stem + ".md")).write_text(head + md, encoding="utf-8")


def sync(dry=False):
    index = {}
    for p in vault_files():
        index.setdefault(p.name, p); index.setdefault(p.name.lower(), p)
    notes = [p for p in vault_files() if p.suffix == ".md" and not p.name.endswith(".excalidraw.md") and published(p.read_text(encoding="utf-8", errors="ignore"))]
    leaks = [p for p in notes if SECRET.search(p.read_text(encoding="utf-8", errors="ignore"))]
    if leaks:
        sys.exit("refusing to publish notes that look like they contain secrets:\n  " + "\n  ".join(str(p.relative_to(VAULT)) for p in leaks))
    if dry:
        print("\n".join(str(p.relative_to(VAULT)) for p in notes) or "(no notes have publish: true)"); return notes
    for old in CONTENT.rglob("*"):
        if old.is_file() and old.relative_to(CONTENT).as_posix() not in KEEP:
            old.unlink()
    (CONTENT / "attachments").mkdir(parents=True, exist_ok=True)
    missing = []
    for p in notes:
        text = p.read_text(encoding="utf-8")
        def swap(m):
            target = m.group(1).strip()
            low = target.lower()
            if low.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf")) and not low.endswith(".excalidraw.svg"):
                hit = find(target, index)
                if hit:
                    shutil.copy2(hit, CONTENT / "attachments" / hit.name); return m.group(0)
                missing.append(f"{p.name}: {target}"); return m.group(0)
            if low.endswith((".excalidraw", ".excalidraw.md")) or find(target + ".excalidraw.md", index) or find(target + ".md", index) and find(target + ".md", index).name.endswith(".excalidraw.md"):
                svg = excalidraw_svg(target, index)
                if svg:
                    shutil.copy2(svg, CONTENT / "attachments" / svg.name); return f"![[{svg.name}]]"
                missing.append(f"{p.name}: {target} (no exported SVG; turn on Excalidraw auto-export)"); return m.group(0)
            return m.group(0)  # a note embed: Quartz resolves it if that note is published too
        def nb(m):
            hit = find(m.group(1).strip(), index)
            if not hit:
                missing.append(f"{p.name}: {m.group(1)}"); return m.group(0)
            notebook(hit, CONTENT / "notebooks")
            return f"[[notebooks/{hit.stem}{m.group(2) or '|' + hit.stem}]]"
        text = NBLINK.sub(nb, text)
        dest = CONTENT / section(text) / p.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(EMBED.sub(swap, text), encoding="utf-8")
    for d in CONTENT.rglob("*"):  # section titles for the sidebar; a course folder keeps its course name
        if d.is_dir() and not (d / "index.md").exists() and any(d.rglob("*.md")):
            title = SECTIONS.get(d.name, d.name)
            (d / "index.md").write_text(f'---\ntitle: "{title}"\npublish: true\n---\n', encoding="utf-8")
    for d in sorted((p for p in CONTENT.rglob("*") if p.is_dir()), reverse=True):  # drop folders emptied by this sync
        if not any(d.iterdir()):
            d.rmdir()
    print(f"synced {len(notes)} notes into content/")
    for x in missing:
        print("  missing:", x)
    return notes


def test():
    assert published("---\npublish: true\ntitle: x\n---\nbody")
    assert not published("---\npublish: false\n---\n") and not published("no frontmatter\npublish: true")
    assert SECRET.search("OPENAI_API_KEY=sk-abcdefghijklmnop1234") and SECRET.search("password: hunter2hunter2")
    assert not SECRET.search("we compared passwords policies in general")
    assert EMBED.findall("a ![[Drawing.excalidraw|600]] b ![[img.png]] c ![[Note#Section]]") == ["Drawing.excalidraw", "img.png", "Note"]
    assert section('---\ncategories:\n  - "[[Research]]"\n---\n') == "research"
    assert section('---\ncourse: "[[Deep Learning]]"\n---\n') == "courses/Deep Learning" and section("---\ntype: note\n---\n") == "notes"
    assert [m.group(1) for m in NBLINK.finditer("see [[Lab 1.ipynb]] and ![[x.ipynb|run]] not [[x.py]]")] == ["Lab 1.ipynb", "x.ipynb"]
    print("ok")


if __name__ == "__main__":
    if "--test" in sys.argv:
        test()
    else:
        sync(dry="--dry-run" in sys.argv)
