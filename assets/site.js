/* ShareYourGroup sites: theme button, copy / WhatsApp / share helpers, one sponsor card. (Ads are Google's own script, added by the page frame.) */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var SYG = window.SYG = {};
  SYG.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  SYG.toast = function (msg) {
    var t = d.querySelector('.toast') || d.body.appendChild(d.createElement('div'));
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; t.hidden = false;
    clearTimeout(SYG._tt); SYG._tt = setTimeout(function () { t.hidden = true; }, 2200);
  };
  SYG.copy = function (text, done) {
    var ok = function () { SYG.toast(done || 'Copied'); };
    var old = function () {
      var a = d.createElement('textarea'); a.value = text; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
      d.body.appendChild(a); a.select();
      try { d.execCommand('copy'); ok(); } catch (e) { SYG.toast('Press and hold to copy: ' + text); }
      a.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, old); else old();
  };
  SYG.share = function (title, text, url) {
    if (navigator.share) navigator.share({ title: title, text: text, url: url }).catch(function () {});
    else SYG.copy(text + ' ' + url, 'Copied, ready to paste');
  };
  SYG.json = function (url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  SYG.slug = function (s) { return String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'; };
  /* recent look-ups of this site, kept only in this browser */
  SYG.recent = function (key, item) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
    if (item) {
      list = [item].concat(list.filter(function (x) { return x.u !== item.u; })).slice(0, 6);
      try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
    }
    return list;
  };

  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-theme-btn],[data-copy],[data-share],[data-wa]');
    if (!b) return;
    if (b.hasAttribute('data-theme-btn')) {
      var dark = root.getAttribute('data-theme') ? root.getAttribute('data-theme') === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
      root.setAttribute('data-theme', dark ? 'light' : 'dark');
      try { localStorage.setItem('syg-theme', dark ? 'light' : 'dark'); } catch (e2) {}
    } else if (b.hasAttribute('data-wa')) {
      window.open('https://wa.me/?text=' + encodeURIComponent(b.getAttribute('data-wa')), '_blank', 'noopener');
    } else if (b.hasAttribute('data-copy')) SYG.copy(b.getAttribute('data-copy'), b.getAttribute('data-done') || 'Copied');
    else SYG.share(d.title, b.getAttribute('data-share'), b.getAttribute('data-url') || location.href);
  });

  /* one sponsor card from the shared list. The owner's own support card and India-only offers outside India are left out. */
  function sponsor() {
    var slot = d.querySelector('[data-sponsor]');
    if (!slot || d.body.getAttribute('data-ads') === '0') return;
    var india = /Calcutta|Kolkata/.test((Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '');
    fetch('https://share.groupchaton.com/promos.json', { mode: 'cors' }).then(function (r) { return r.json(); }).then(function (j) {
      var list = (j.promos || []).filter(function (p) { return p && p.href && !p.own && !(p.india && !india); });
      if (!list.length) return;
      var p = list[Math.floor(Math.random() * list.length)];
      var img = p.imgs && p.imgs.length ? p.imgs[Math.floor(Math.random() * p.imgs.length)] : (p.img_icon || '');
      slot.innerHTML = '<a class="sponsor" href="' + SYG.esc(p.href) + '" target="_blank" rel="' + (p.family ? 'noopener' : 'sponsored noopener') + '">' +
        (img ? '<img src="' + SYG.esc(img) + '" alt="" loading="lazy" width="72" height="72">' : '') +
        '<span><small>' + SYG.esc(p.family ? 'From GroupChatOn' : (p.tag || 'Sponsored')) + '</small><b>' + SYG.esc(p.title || '') + '</b>' + (p.line ? '<span>' + SYG.esc(p.line) + '</span>' : '') +
        (p.cta ? '<em>' + SYG.esc(p.cta) + ' →</em>' : '') + '</span></a>';
      slot.hidden = false;
    }).catch(function () {});
  }

  root.classList.add('ready');

  /* fetch the next page when a finger or the mouse rests on its link, so it opens without a wait (never on Save-Data or 2G) */
  var conn = navigator.connection || {}, seen = {};
  function warm(e) {
    var a = e.target.closest && e.target.closest('a[href^="/"]');
    if (!a || conn.saveData || /2g/.test(conn.effectiveType || '') || seen[a.pathname] || a.pathname === location.pathname) return;
    seen[a.pathname] = 1;
    var l = d.createElement('link'); l.rel = 'prefetch'; l.href = a.href; d.head.appendChild(l);
  }
  d.addEventListener('pointerenter', warm, true);
  d.addEventListener('touchstart', warm, { passive: true, capture: true });

  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  if ('requestIdleCallback' in window) requestIdleCallback(sponsor, { timeout: 2500 }); else setTimeout(sponsor, 900);
})();
