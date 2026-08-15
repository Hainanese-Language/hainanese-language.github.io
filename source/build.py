#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Full site build: generate docs/, then put back the audio the generator's clean wipe
removes. Run this rather than generate_site.py on its own.

    python build.py
"""
import os, re, shutil, subprocess, sys, glob

# the console here is cp1252 by default, and everything we print is Chinese
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:
    pass

HERE  = os.path.dirname(os.path.abspath(__file__))
DOCS  = os.path.abspath(os.path.join(HERE, "..", "docs"))
AUDIO = os.path.join(HERE, "audio")

env = dict(os.environ, PYTHONUTF8="1", PYTHONIOENCODING="utf-8")
r = subprocess.run([sys.executable, "generate_site.py", "--out", DOCS],
                   cwd=HERE, env=env, capture_output=True, text=True, encoding="utf-8")
sys.stdout.write(r.stdout or "")
if r.returncode:
    sys.stderr.write(r.stderr or "")
    sys.exit(r.returncode)

# every audio file the built pages actually ask for
want = set()
for f in glob.glob(os.path.join(DOCS, "*.html")):
    with open(f, encoding="utf-8") as fh:
        want.update(re.findall(r'data-src="audio/([^"]+)"', fh.read()))

dest = os.path.join(DOCS, "audio")
os.makedirs(dest, exist_ok=True)
copied = missing = 0
missing_names = []
for fn in sorted(want):
    src = os.path.join(AUDIO, fn)
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(dest, fn))
        copied += 1
    else:
        missing += 1
        missing_names.append(fn)

print("audio referenced: %d   copied: %d   not recorded: %d" % (len(want), copied, missing))
if missing_names:
    print("  (compounds with no single recording, they degrade to 尚未上传): %s%s"
          % (", ".join(missing_names[:5]), " …" if len(missing_names) > 5 else ""))
