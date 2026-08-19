# 海南话字典 — 网站生成规则 / Site Build Rules

Short guide to how the website is generated from the master Excel.
**Never edit the HTML.** Fix the Excel, re-run the generator, re-upload.

---

## 1. Source of truth

| Input | Sheet | Used for |
|---|---|---|
| `Hainanese_dictionary_master_with_鼾.xlsx` | `All Rows` | every entry |
| same file | `Unique Romanizations` | audio filename for each reading |
| `词.xlsx` | `Sheet1` | 联绵词 placed under 常用词 |

`All Rows` columns used: page, character, Mandarin pinyin, Hainanese romanization (col F),
Chinese definition, English definition.

## 2. Arrangement

1. **One page per Hainanese syllable** (tone stripped) — `geng.html`, `din.html`.
2. Within a page: **sorted by tone**, then by source page number.
3. **No tone headings.** Tone is carried by the circle badge on the reading, the chips in the
   sticky bar, and a heavier divider line where the tone changes.
4. Source page order is used as the within-tone sort because stroke counts are not in the data.
   Swap in a stroke column later and the sort key changes in one place.

## 3. What counts as an entry

- **One entry per distinct Hainanese reading.** Two Mandarin readings sharing one Hainanese
  reading = one entry (a *merge*), senses numbered continuously.
- Several Mandarin readings inside one entry get `〔pīnyīn〕` sub-headings; numbering still runs
  straight through.
- Where a character has several *unmarked* Hainanese readings with the same meanings, the first
  is the **canonical entry** and the others are **pointer entries** — full headword block,
  but the body says 释义见 X and links there. Definitions are written once, never duplicated.

## 4. Cross-references (另见)

- Every entry lists **all other** Hainanese readings of that character — never itself.
- Generated from column F, so the links are always symmetric. Three readings → each block
  shows the other two.
- Chips use the same teal serif and circle tone badge as the headword reading, one size down.

## 5. Marked readings (文读 白读 俗读 误读 又读)

| In column F | On the site |
|---|---|
| Marker with a sense scope (`[❶话ge³假]`) | Chip beside that sense |
| Marker without a scope | Chip in the headword block |
| No marker, extra reading | Pointer entry (see §3) |

Marker words are shown in plain language and carry a hover explanation.

## 6. Labels

〈书〉〈方〉〈旧〉〈古〉〈外〉〈俗〉〈话〉〈引〉〈喻〉〈罕〉 and the English forms
〈lit.〉〈dial.〉〈arch.〉 etc. are rendered as hover chips with a full explanation.
Explanations are written fresh, not copied from the source's 凡例.

## 7. Audio

- Filename comes from the `Unique Romanizations` sheet — `geng1.wav`, `hheng2.wav`.
- Files live in `audio/`. A missing file degrades to a short "尚未上传" message; it never breaks
  the page.
- Homophones share one file by design.

## 8. Search

- Matches **character**, **Hainanese romanization**, and **Mandarin pinyin**.
- Tone-insensitive both ways: `geng` finds `gēng` and `geng¹`; `geng1` also works.
- Runs entirely in the browser from one JSON index. No server, no database.

## 9. 常用词

The master holds 146 multi-character headwords (联绵词 — 玻璃, 佝偻, 蝴蝶). These are **not**
given their own headword entries. Each is shown under 常用词 of one of its characters, carrying
its own reading, audio, Chinese and English definitions straight from its master row.

- Host = the **first** character when that character is itself a headword; otherwise the second.
  In the current data that is 4 first / 129 second, because for most 联绵词 the source only
  files the second character (璃, 蝶, 偻).
- The word attaches to the reading block whose romanization matches its own syllable, so a
  compound appears once, under the right pronunciation — not on every block of the host.
- Compound audio filenames concatenate the single-syllable names: `deng1dang1.wav`.
- 13 words have neither character as a headword (倥偬 傀儡 陀螺 …). They keep their own entries
  for now so their definitions are not lost.
- Entries with no 常用词 show an empty placeholder, ready for later expansion.

## 10. Where the site lives

The repo is the organisation's GitHub Pages site, served from the **root of `master`**:

| Folder | URL |
|---|---|
| `hainanese-dictionary/` | <https://hainanese-language.github.io/hainanese-dictionary/> |
| `submit/` | <https://hainanese-language.github.io/submit/> |
| `index.html` (root) | <https://hainanese-language.github.io/> — landing page linking to both |
| `docs/` | redirect stub only; the old `/docs/` links bounce to `/hainanese-dictionary/` |

Every link inside the generated pages is relative, so the dictionary folder can be renamed
and only `build.py` needs to know. `.nojekyll` at the root keeps Pages from running Jekyll
over the generated files.

## 11. Maintenance

1. Edit the Excel.
2. Run `python3 build.py` (it writes `hainanese-dictionary/` and restores the audio).
3. Push to GitHub; the host publishes automatically.

Always regenerate everything — it takes seconds, and a partial rebuild leaves stale 另见 links.
Only changed files actually upload.
