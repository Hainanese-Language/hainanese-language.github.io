/* 海南话字典 — browser side: search, audio, tooltips, tone jump */
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

  /* ---------- audio ---------- */
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

  /* ---------- tone jump + current-tone highlight ---------- */
  var jump = document.querySelectorAll(".jump a");
  jump.forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      var el = document.querySelector('.entry[data-tone="' + a.dataset.t + '"]');
      if (el) window.scrollTo({ top: el.offsetTop - 118, behavior: "smooth" });
    });
  });
  if (jump.length) {
    window.addEventListener("scroll", function () {
      var els = document.querySelectorAll(".entry"), cur = els[0];
      els.forEach(function (x) { if (x.getBoundingClientRect().top < 132) cur = x; });
      if (!cur) return;
      var t = cur.dataset.tone;
      jump.forEach(function (a) { a.classList.toggle("on", a.dataset.t === t); });
    }, { passive: true });
  }

  /* ---------- search ---------- */
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

  var timer = null;
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

  box.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 90); });
  box.addEventListener("focus", load);
  document.addEventListener("click", function (ev) {
    if (!res.contains(ev.target) && ev.target !== box) res.classList.remove("on");
  });
  box.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { box.value = ""; res.classList.remove("on"); box.blur(); }
    if (ev.key === "Enter") { var a = res.querySelector("a"); if (a) location.href = a.href; }
  });
})();
