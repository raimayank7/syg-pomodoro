/* Pomodoro: the focus timer. Everything stays in this browser (localStorage); nothing is sent anywhere.
   The clock is worked out from the end time, so a sleeping tab or phone does not make it run slow. */
(function () {
  'use strict';
  var d = document, box = d.getElementById('pt');
  if (!box) return;
  var $ = function (id) { return d.getElementById(id); };
  var get = function (k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? def : v; } catch (e) { return def; } };
  var put = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  var preset = box.getAttribute('data-preset');            // "50,10,30" on a preset page: used on that page only
  var DEF = { f: 25, s: 5, l: 15, every: 4, auto: false, sound: true, note: false, awake: false };
  var set = get('pomo-set', {}), k;
  for (k in DEF) if (set[k] === undefined) set[k] = DEF[k];
  if (preset) { var p = preset.split(','); set = Object.assign({}, set, { f: +p[0], s: +p[1], l: +p[2] }); }
  var NAMES = { f: 'Focus', s: 'Short break', l: 'Long break' };
  var mode = 'f', left = set.f * 60, endAt = 0, running = false, tick = null, round = get('pomo-round', 0), lock = null;
  var baseTitle = d.title;

  function today() { var n = new Date(); return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2); }
  function fmt(sec) { sec = Math.max(0, Math.round(sec)); return ('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + sec % 60).slice(-2); }

  function paint() {
    var total = set[mode] * 60;
    $('pt-time').textContent = fmt(left);
    $('pt-ring').style.strokeDashoffset = String(565.5 * (1 - (total ? left / total : 0)));
    $('pt-go').textContent = running ? 'Pause' : (left < total ? 'Resume' : 'Start');
    $('pt-mode').textContent = NAMES[mode] + (mode === 'f' ? ' ' + (round % set.every + 1) + ' of ' + set.every : '');
    box.setAttribute('data-mode', mode);
    Array.prototype.forEach.call(d.querySelectorAll('[data-pt-mode]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pt-mode') === mode ? 'true' : 'false'); });
    d.title = running ? fmt(left) + ' ' + NAMES[mode] + ' | Pomodoro' : baseTitle;
  }

  function beep() {
    if (!set.sound) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext, ac = beep.ac || (beep.ac = new AC()), t = ac.currentTime;
      [0, 0.35, 0.7].forEach(function (o, i) {
        var osc = ac.createOscillator(), g = ac.createGain();
        osc.type = 'sine'; osc.frequency.value = mode === 'f' ? 880 : 660;
        g.gain.setValueAtTime(0.0001, t + o); g.gain.exponentialRampToValueAtTime(0.35, t + o + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.28);
        osc.connect(g); g.connect(ac.destination); osc.start(t + o); osc.stop(t + o + 0.3);
      });
    } catch (e) {}
  }
  function notify(text) {
    if (set.note && 'Notification' in window && Notification.permission === 'granted') { try { new Notification('Pomodoro', { body: text, icon: '/icons/icon-192.png' }); } catch (e) {} }
    if (window.SYG) SYG.toast(text);
  }
  function awake(on) {
    if (!('wakeLock' in navigator)) return;
    if (on && set.awake) navigator.wakeLock.request('screen').then(function (l) { lock = l; }).catch(function () {});
    else if (lock) { lock.release().catch(function () {}); lock = null; }
  }

  function log() {
    var all = get('pomo-log', {}), t = today(), row = all[t] || { n: 0, m: 0 };
    row.n += 1; row.m += set.f; all[t] = row;
    var keys = Object.keys(all).sort(); while (keys.length > 60) delete all[keys.shift()];
    put('pomo-log', all);
    var cur = tasks.filter(function (x) { return x.on && !x.done; })[0];
    if (cur) { cur.n = (cur.n || 0) + 1; put('pomo-tasks', tasks); drawTasks(); }
    stats();
  }
  function stats() {
    var all = get('pomo-log', {}), t = today(), row = all[t] || { n: 0, m: 0 }, html = '', max = 1, days = [], i, dt, key;
    $('pt-today').textContent = row.n + (row.n === 1 ? ' pomodoro' : ' pomodoros') + ', ' + (row.m >= 60 ? Math.floor(row.m / 60) + ' h ' + row.m % 60 + ' min' : row.m + ' min') + ' of focus';
    for (i = 6; i >= 0; i--) {
      dt = new Date(); dt.setDate(dt.getDate() - i);
      key = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2);
      days.push([dt.toLocaleDateString('en-IN', { weekday: 'short' }), (all[key] || { n: 0 }).n]);
      max = Math.max(max, days[days.length - 1][1]);
    }
    days.forEach(function (x) { html += '<li><span style="height:' + Math.round(x[1] / max * 100) + '%"></span><b>' + x[1] + '</b><small>' + x[0] + '</small></li>'; });
    $('pt-week').innerHTML = html;
  }

  function done() {
    stop();
    beep();
    if (mode === 'f') {
      log(); round += 1; put('pomo-round', round);
      mode = round % set.every === 0 ? 'l' : 's';
      notify(mode === 'l' ? 'Four done. Take a long break.' : 'Focus time over. Take a short break.');
    } else { mode = 'f'; notify('Break over. Ready for the next focus?'); }
    left = set[mode] * 60; paint();
    if (set.auto) start();
  }
  function start() {
    if (running) return;
    if (left <= 0) left = set[mode] * 60;
    endAt = Date.now() + left * 1000; running = true; awake(true);
    tick = setInterval(function () { left = (endAt - Date.now()) / 1000; if (left <= 0) { left = 0; done(); } else paint(); }, 250);
    paint();
  }
  function stop() { running = false; clearInterval(tick); awake(false); }
  function go(m) { stop(); mode = m; left = set[m] * 60; paint(); }

  $('pt-go').addEventListener('click', function () {
    if (beep.ac && beep.ac.state === 'suspended') beep.ac.resume();
    if (running) { stop(); left = Math.max(0, (endAt - Date.now()) / 1000); paint(); } else start();
  });
  $('pt-reset').addEventListener('click', function () { go(mode); });
  $('pt-skip').addEventListener('click', function () {
    if (mode === 'f') go((round + 1) % set.every === 0 ? 'l' : 's'); else go('f');
    if (window.SYG) SYG.toast('Skipped. Nothing was counted.');
  });
  Array.prototype.forEach.call(d.querySelectorAll('[data-pt-mode]'), function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-pt-mode')); }); });
  d.addEventListener('visibilitychange', function () { if (!d.hidden && running) { left = (endAt - Date.now()) / 1000; if (left <= 0) { left = 0; done(); } else { paint(); awake(true); } } });
  d.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY|A/.test(e.target.tagName)) { e.preventDefault(); $('pt-go').click(); }
  });
  window.addEventListener('beforeunload', function (e) { if (running && mode === 'f') { e.preventDefault(); e.returnValue = ''; } });

  /* settings */
  [['f', 1, 180], ['s', 1, 60], ['l', 1, 90], ['every', 2, 8]].forEach(function (x) {
    var el = $('pt-set-' + x[0]); el.value = set[x[0]];
    el.addEventListener('change', function () {
      var v = Math.round(+el.value); if (!(v >= x[1])) v = x[1]; if (v > x[2]) v = x[2];
      el.value = v; set[x[0]] = v; if (!preset) put('pomo-set', set);
      if (!running && x[0] === mode) left = v * 60;
      paint();
    });
  });
  ['auto', 'sound', 'note', 'awake'].forEach(function (x) {
    var el = $('pt-set-' + x); el.checked = !!set[x];
    el.addEventListener('change', function () {
      set[x] = el.checked;
      if (x === 'note' && el.checked) {
        if (!('Notification' in window)) { el.checked = set.note = false; SYG.toast('This browser has no notifications'); }
        else if (Notification.permission !== 'granted') Notification.requestPermission().then(function (r) { if (r !== 'granted') { el.checked = set.note = false; put('pomo-set', set); SYG.toast('Notifications are blocked in the browser'); } });
      }
      if (x === 'awake' && !('wakeLock' in navigator) && el.checked) { el.checked = set.awake = false; SYG.toast('This browser cannot keep the screen on'); }
      if (x === 'sound' && el.checked) beep();
      var save = get('pomo-set', {}); save[x] = set[x]; put('pomo-set', preset ? save : set);
    });
  });

  /* tasks */
  var tasks = get('pomo-tasks', []);
  function drawTasks() {
    var ul = $('pt-tasks'), html = '';
    tasks.forEach(function (t, i) {
      html += '<li class="' + (t.done ? 'done' : '') + (t.on && !t.done ? ' on' : '') + '"><label><input type="checkbox" data-i="' + i + '"' + (t.done ? ' checked' : '') + '><span>' + SYG.esc(t.t) + '</span></label>' +
        '<em title="Pomodoros done / planned">' + (t.n || 0) + ' / ' + t.e + '</em>' +
        '<button type="button" class="pt-x" data-on="' + i + '" aria-label="Work on this task now">' + (t.on && !t.done ? 'Now' : 'Pick') + '</button>' +
        '<button type="button" class="pt-x" data-del="' + i + '" aria-label="Remove task">×</button></li>';
    });
    ul.innerHTML = html || '<li class="empty">No tasks yet. Add the first thing you will work on.</li>';
    var e = 0, n = 0; tasks.forEach(function (t) { if (!t.done) { e += +t.e; n += Math.min(t.n || 0, +t.e); } });
    $('pt-sum').textContent = tasks.length ? Math.max(0, e - n) + ' pomodoros left on the list, about ' + Math.round(Math.max(0, e - n) * (set.f + set.s) / 6) / 10 + ' hours with breaks' : '';
  }
  $('pt-add').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('pt-new').value.trim(); if (!t) return;
    tasks.push({ t: t.slice(0, 120), e: Math.min(12, Math.max(1, Math.round(+$('pt-est').value) || 1)), n: 0, on: !tasks.some(function (x) { return x.on && !x.done; }) });
    $('pt-new').value = ''; put('pomo-tasks', tasks); drawTasks();
  });
  $('pt-tasks').addEventListener('click', function (e) {
    var b = e.target, i;
    if (b.hasAttribute('data-del')) { tasks.splice(+b.getAttribute('data-del'), 1); }
    else if (b.hasAttribute('data-on')) { i = +b.getAttribute('data-on'); tasks.forEach(function (t, j) { t.on = j === i; }); }
    else if (b.hasAttribute('data-i')) { i = +b.getAttribute('data-i'); tasks[i].done = b.checked; if (b.checked) tasks[i].on = false; }
    else return;
    put('pomo-tasks', tasks); drawTasks();
  });
  $('pt-clear').addEventListener('click', function () { tasks = tasks.filter(function (t) { return !t.done; }); put('pomo-tasks', tasks); drawTasks(); });

  /* a new day starts a new set of four */
  if (get('pomo-day', '') !== today()) { round = 0; put('pomo-round', 0); put('pomo-day', today()); }
  drawTasks(); stats(); paint();
})();
