/* 海南话字典 — browser side: search, audio, tooltips, index panel, continuous reading */
(function () {
  "use strict";

  /* ---------- tooltips (hover on desktop, tap on touch) ---------- */
  document.addEventListener("click", function (ev) {
    var chipEl = ev.target.closest && ev.target.closest(".rchip");
    document.querySelectorAll(".gloss.open,.tip.open").forEach(function (g) {
      if (!g.contains(ev.target)) g.classList.remove("open");
    });
    var g = ev.target.closest && ev.target.closest(".gloss,.tip");
    if (g && !chipEl) g.classList.toggle("open");
  });

  /* ---------- audio (delegated, so streamed-in entries work too) ---------- */
  var player = new Audio();
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest(".play");
    if (!b || !b.dataset.src) return;
    ev.preventDefault();
    player.pause();
    player.src = b.dataset.src;
    player.play().catch(function () {
      var old = b.innerHTML;
      b.textContent = "尚未上传";
      setTimeout(function () { b.innerHTML = old; }, 1600);
    });
  });

  /* ---------- keep the sticky bar's real height in a variable ---------- */
  var bar = document.querySelector(".bar");
  function setBar() {
    if (bar) document.documentElement.style.setProperty(
      "--barh", Math.round(bar.getBoundingClientRect().height) + "px");
  }
  setBar();
  if (window.ResizeObserver && bar) new ResizeObserver(setBar).observe(bar);
  window.addEventListener("resize", setBar, { passive: true });

  /* ===================== 音序索引 side panel ===================== */
  var body = document.body,
      pnBody = document.getElementById("pn-body"),
      SYLS = [], COUNTS = {};

  function wide() { return window.matchMedia("(min-width:1000px)").matches; }
  function isOpen() {
    if (body.classList.contains("pn-open")) return true;
    if (body.classList.contains("pn-closed")) return false;
    return wide();
  }
  function setOpen(open, remember) {
    body.classList.toggle("pn-closed", !open);
    body.classList.toggle("pn-open", open);
    if (remember) try { localStorage.setItem("hnd-panel", open ? "open" : "closed"); } catch (e) {}
  }
  try {
    var saved = localStorage.getItem("hnd-panel");
    if (saved === "open") setOpen(true); else if (saved === "closed") setOpen(false);
  } catch (e) {}

  document.addEventListener("click", function (ev) {
    if (ev.target.closest && ev.target.closest(".pn-toggle")) setOpen(!isOpen(), true);
    else if (ev.target.closest && ev.target.closest(".pn-x")) setOpen(false, true);
    else if (ev.target.classList && ev.target.classList.contains("pn-scrim")) setOpen(false, true);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !wide() && isOpen()) setOpen(false, true);
  });

  /* the panel is one shared file, fetched once and cached for the whole site */
  var CUR = body.dataset.syl || null;
  function loadPanel() {
    if (!pnBody) return Promise.resolve(false);
    return fetch("suoyin_panel.html", { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        pnBody.innerHTML = html +
          '<div class="pn-empty" id="pn-empty" style="display:none">没有匹配的音节或字。</div>';
        /* the panel is also the source of syllable order and counts —
           no second index file needed */
        pnBody.querySelectorAll(".pn-g").forEach(function (g) {
          SYLS.push(g.dataset.syl);
          COUNTS[g.dataset.syl] = parseInt(g.querySelector(".ct").textContent, 10) || 0;
        });
        markPanel(CUR);
        var here = pnBody.querySelector('.pn-r[href^="' + CUR + '.html#"]');
        var g = pnBody.querySelector('.pn-g[data-syl="' + CUR + '"]');
        if (g) g.scrollIntoView({ block: "center" });
        if (here) here.classList.add("here");
        return true;
      })
      .catch(function () {
        pnBody.innerHTML = '<div class="pn-empty">索引载入失败。</div>';
        return false;
      });
  }
  function markPanel(syl) {
    if (!pnBody) return;
    pnBody.querySelectorAll(".pn-g.cur").forEach(function (g) { g.classList.remove("cur"); });
    var g = pnBody.querySelector('.pn-g[data-syl="' + syl + '"]');
    if (!g) return;
    g.classList.add("cur");
    var gr = g.getBoundingClientRect(), br = pnBody.getBoundingClientRect();
    if (gr.top < br.top + 30 || gr.bottom > br.bottom - 30) g.scrollIntoView({ block: "center" });
  }

  /* filter the index in place */
  document.addEventListener("input", function (ev) {
    if (ev.target.id !== "pn-q" || !pnBody) return;
    var q = ev.target.value.trim().toLowerCase(), shown = 0;
    pnBody.querySelectorAll(".pn-g").forEach(function (g) {
      var syl = g.dataset.syl, vis = !q || syl.indexOf(q) > -1;
      if (!vis && q) {
        vis = !!g.querySelector('.pn-r[data-c="' + q + '"]');
      }
      g.classList.toggle("pn-hide", !vis);
      if (vis) shown++;
    });
    pnBody.querySelectorAll(".pn-L").forEach(function (L) {
      L.classList.toggle("pn-hide", !L.querySelector(".pn-g:not(.pn-hide)"));
    });
    var em = document.getElementById("pn-empty");
    if (em) em.style.display = shown ? "none" : "block";
  });

  /* ===================== continuous reading ===================== */
  var stream = document.getElementById("stream");

  function initStream() {
    if (!stream || !SYLS.length) return;
    /* prev/next links are the no-JS fallback; streaming replaces them */
    var nav = document.querySelector(".pagenav");
    if (nav) nav.remove();

    var busy = false, userScrolled = false, curSyl = CUR;
    var gateB = document.getElementById("ss-gate"),
        gateT = document.getElementById("ss-gate-top"),
        note  = document.getElementById("ss-note"),
        barSyl = document.getElementById("bar-syl"),
        jump   = document.getElementById("jump");

    function say(t) { if (note) note.textContent = t || ""; }
    function L(s) { return s.charAt(0).toUpperCase(); }
    function idx(s) { return SYLS.indexOf(s); }
    function gate(el, syl, dir) {
      if (!el) return;
      el.innerHTML = syl
        ? '<button class="ss-more" type="button" data-dir="' + dir + '">' +
          (dir === "up" ? "↑ 继续读 " : "继续读 ") + L(syl) + " · " + syl +
          (dir === "up" ? "" : " ↓") + "</button>"
        : "";
    }
    function fetchSyl(syl) {
      return fetch(syl + ".html", { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (t) {
          var d = new DOMParser().parseFromString(t, "text/html");
          var s = d.querySelector("#stream .ss");
          if (s) return s.innerHTML;
          var w = d.querySelector(".wrap");            /* older markup */
          if (!w) throw new Error("no content");
          var n = w.querySelector(".pagenav"); if (n) n.remove();
          return w.innerHTML;
        });
    }
    function section(syl, html) {
      var s = document.createElement("section");
      s.className = "ss"; s.dataset.syl = syl;
      s.innerHTML = html;
      return s;
    }

    function loadNext(force) {
      if (busy) return;
      var cur = stream.lastElementChild; if (!cur) return;
      var i = idx(cur.dataset.syl);
      if (i < 0 || i + 1 >= SYLS.length) {
        if (!document.getElementById("ss-end")) {
          var e = document.createElement("div");
          e.id = "ss-end"; e.className = "ss-end";
          e.textContent = "全书完 · 共 " + SYLS.length + " 个音节";
          (gateB || stream).after(e);
        }
        return;
      }
      var nxt = SYLS[i + 1];
      /* a letter is the book's own chapter break — stop and let the reader choose */
      if (!force && L(nxt) !== L(cur.dataset.syl)) { gate(gateB, nxt, "down"); return; }
      gate(gateB, null); busy = true; say("正在载入 " + nxt + " …");
      fetchSyl(nxt).then(function (h) {
        stream.appendChild(section(nxt, h));
        busy = false; say("");
      }).catch(function () { busy = false; say("载入失败"); });
    }

    function loadPrev(force) {
      if (busy || !userScrolled) return;
      var cur = stream.firstElementChild; if (!cur) return;
      var i = idx(cur.dataset.syl);
      if (i <= 0) return;
      var prv = SYLS[i - 1];
      if (!force && L(prv) !== L(cur.dataset.syl)) { gate(gateT, prv, "up"); return; }
      gate(gateT, null); busy = true; say("正在载入 " + prv + " …");
      fetchSyl(prv).then(function (h) {
        var se = document.scrollingElement || document.documentElement;
        var before = se.scrollHeight;
        stream.insertBefore(section(prv, h), stream.firstChild);
        se.scrollTop += (se.scrollHeight - before);   /* hold the reader's place */
        busy = false; say("");
      }).catch(function () { busy = false; say("载入失败"); });
    }

    document.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest(".ss-more");
      if (!b) return;
      if (b.dataset.dir === "up") { gate(gateT, null); loadPrev(true); }
      else { gate(gateB, null); loadNext(true); }
    });

    /* which syllable is being read — drives bar, tone chips, panel, title, URL */
    function updateCurrent() {
      var secs = stream.children;
      var top = (parseInt(getComputedStyle(document.documentElement)
                  .getPropertyValue("--barh"), 10) || 96) + 12;
      var cur = secs[0];
      for (var i = 0; i < secs.length; i++) {
        if (secs[i].getBoundingClientRect().top <= top) cur = secs[i];
      }
      if (!cur || cur.dataset.syl === curSyl) return;
      curSyl = cur.dataset.syl;
      if (barSyl && barSyl.firstChild) barSyl.firstChild.nodeValue = curSyl;
      document.title = curSyl + " — 海南话字典";
      try { history.replaceState(null, "", curSyl + ".html"); } catch (e) {}
      if (jump) {
        var tones = [], seen = {};
        cur.querySelectorAll(".entry").forEach(function (en) {
          var t = en.dataset.tone;
          if (t && !seen[t]) { seen[t] = 1; tones.push(t); }
        });
        tones.sort();
        jump.innerHTML = tones.map(function (t) {
          return '<a href="#" data-t="' + t + '">' + curSyl + "<sup>" + t + "</sup></a>";
        }).join("");
      }
      markPanel(curSyl);
    }

    /* tone chips scroll within the syllable being read */
    document.addEventListener("click", function (ev) {
      var a = ev.target.closest && ev.target.closest("#jump a");
      if (!a) return;
      ev.preventDefault();
      var sec = stream.querySelector('.ss[data-syl="' + curSyl + '"]');
      var el = sec && sec.querySelector('.entry[data-tone="' + a.dataset.t + '"]');
      if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 118,
                                behavior: "smooth" });
    });

    /* time-throttled, not rAF-driven, so it still runs in a background tab */
    var lastRun = 0, timer = null;
    function work() {
      lastRun = Date.now(); timer = null;
      var se = document.scrollingElement || document.documentElement;
      if (se.scrollHeight - se.scrollTop - se.clientHeight < 1400) loadNext();
      if (se.scrollTop < 500) loadPrev();
      updateCurrent();
    }
    window.addEventListener("scroll", function () {
      userScrolled = true;
      if (Date.now() - lastRun >= 80) { work(); return; }
      if (!timer) timer = setTimeout(work, 80);
    }, { passive: true });

    if (document.documentElement.scrollHeight <= window.innerHeight + 200) loadNext();
  }

  if (pnBody) loadPanel().then(initStream);

  /* ===================== search ===================== */
  var box = document.getElementById("q"), res = document.getElementById("res"), IDX = null;
  if (!box) return;

  function load() {
    if (IDX) return Promise.resolve(IDX);
    return fetch("index.json").then(function (r) { return r.json(); })
      .then(function (d) { IDX = d; return d; });
  }

  /* gēng -> geng, so a query typed without tone marks still matches */
  function plain(s) {
    return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ü/g, "u").toLowerCase().trim();
  }

  function score(rec, q, qn) {
    var r = rec.r, d = rec.d, p = rec.p;
    if (rec.c === q) return 0;                    // exact character
    if (r === qn || d === qn) return 1;           // exact Hainanese, with or without tone
    if ((" " + p + " ").indexOf(" " + qn + " ") > -1) return 2;  // exact pinyin syllable
    if (r.indexOf(qn) === 0 || d.indexOf(qn) === 0) return 3;    // Hainanese prefix
    if (p.indexOf(qn) === 0) return 4;                            // pinyin prefix
    if (rec.c.indexOf(q) > -1) return 5;
    if (p.indexOf(qn) > -1) return 6;
    return -1;
  }

  var timer2 = null;
  function run() {
    var q = box.value.trim(), qn = plain(q);
    if (!q) { res.classList.remove("on"); res.innerHTML = ""; return; }
    load().then(function (data) {
      var hits = [];
      for (var i = 0; i < data.length; i++) {
        var s = score(data[i], q, qn);
        if (s >= 0) hits.push([s, data[i]]);
      }
      hits.sort(function (a, b) { return a[0] - b[0] || a[1].r.length - b[1].r.length; });
      hits = hits.slice(0, 40);
      res.innerHTML = hits.length
        ? hits.map(function (h) {
            var r = h[1];
            return '<a href="' + r.u + '"><span class="c">' + r.c + '</span>' +
                   '<span class="r">' + r.r + (r.t ? '<sup>' + r.t + '</sup>' : '') + '</span>' +
                   '<span class="p">' + (r.p || '') + '</span></a>';
          }).join("")
        : '<div class="none">没有找到。可以试试汉字、海南话拼音（geng 或 geng1）或普通话拼音（geng）。</div>';
      res.classList.add("on");
    });
  }

  box.addEventListener("input", function () { clearTimeout(timer2); timer2 = setTimeout(run, 90); });
  box.addEventListener("focus", load);
  document.addEventListener("click", function (ev) {
    if (!res.contains(ev.target) && ev.target !== box) res.classList.remove("on");
  });
  box.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { box.value = ""; res.classList.remove("on"); box.blur(); }
    if (ev.key === "Enter") { var a = res.querySelector("a"); if (a) location.href = a.href; }
  });
})();
