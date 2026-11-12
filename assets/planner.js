/* Pomodoro day planner: turns a list of tasks (with pomodoros each) into a timetable with breaks. Runs in the browser only. */
(function () {
  'use strict';
  var d = document, form = d.getElementById('pl');
  if (!form) return;
  var $ = function (id) { return d.getElementById(id); };
  var rows = $('pl-rows'), saved = [];
  try { saved = JSON.parse(localStorage.getItem('pomo-plan') || '[]'); } catch (e) {}
  function addRow(t, n) {
    var li = d.createElement('li');
    li.innerHTML = '<input type="text" maxlength="80" placeholder="Subject or task" aria-label="Subject or task"><input type="number" min="1" max="12" value="2" inputmode="numeric" aria-label="Pomodoros"><button type="button" class="pt-x" aria-label="Remove row">×</button>';
    li.children[0].value = t || ''; if (n) li.children[1].value = n;
    li.children[2].addEventListener('click', function () { if (rows.children.length > 1) li.remove(); });
    rows.appendChild(li);
  }
  (saved.length ? saved : [['', 2], ['', 2], ['', 1]]).forEach(function (r) { addRow(r[0], r[1]); });
  $('pl-more').addEventListener('click', function () { if (rows.children.length < 15) addRow('', 2); });
  function hm(min) { min = ((min % 1440) + 1440) % 1440; var h = Math.floor(min / 60), m = min % 60, ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12; return h + ':' + ('0' + m).slice(-2) + ' ' + ap; }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var list = [], keep = [];
    Array.prototype.forEach.call(rows.children, function (li) {
      var t = li.children[0].value.trim(), n = Math.min(12, Math.max(1, Math.round(+li.children[1].value) || 1));
      if (t) { list.push([t, n]); keep.push([t, n]); }
    });
    if (!list.length) { SYG.toast('Type at least one subject or task'); return; }
    try { localStorage.setItem('pomo-plan', JSON.stringify(keep)); } catch (e2) {}
    var f = Math.min(180, Math.max(5, +$('pl-f').value || 25)), s = Math.min(60, Math.max(1, +$('pl-s').value || 5)), l = Math.min(90, Math.max(5, +$('pl-l').value || 20));
    var st = ($('pl-start').value || '09:00').split(':'), t = +st[0] * 60 + +st[1], t0 = t, count = 0, total = 0, html = '', text = [], mix = $('pl-mix').checked, order = [];
    list.forEach(function (x) { total += x[1]; });
    if (mix) {       // take turns between subjects so one subject does not fill the whole morning
      var left = list.map(function (x) { return x[1]; }), any = true;
      while (any) { any = false; list.forEach(function (x, i) { var take = Math.min(2, left[i]); for (var j = 0; j < take; j++) order.push(x[0]); left[i] -= take; if (left[i] > 0) any = true; }); }
    } else list.forEach(function (x) { for (var j = 0; j < x[1]; j++) order.push(x[0]); });
    order.forEach(function (name, i) {
      count++;
      html += '<tr><td data-l="Time">' + hm(t) + ' to ' + hm(t + f) + '</td><td data-l="What">' + SYG.esc(name) + '</td><td data-l="No.">' + count + '</td></tr>';
      text.push(hm(t) + ' - ' + hm(t + f) + '  ' + name);
      t += f;
      if (i < order.length - 1) {
        var long = count % 4 === 0, b = long ? l : s;
        html += '<tr class="brk"><td data-l="Time">' + hm(t) + ' to ' + hm(t + b) + '</td><td data-l="What">' + (long ? 'Long break' : 'Short break') + '</td><td data-l="No."></td></tr>';
        if (long) text.push(hm(t) + ' - ' + hm(t + b) + '  Long break');
        t += b;
      }
    });
    var span = t - t0, focus = total * f;
    $('pl-out').hidden = false;
    $('pl-body').innerHTML = html;
    $('pl-sum').textContent = total + ' pomodoros: ' + Math.floor(focus / 60) + ' h ' + focus % 60 + ' min of focus, finishing at ' + hm(t) + ' (' + Math.floor(span / 60) + ' h ' + span % 60 + ' min from start to end).';
    $('pl-warn').hidden = total <= 12;
    var msg = 'My plan for today (' + total + ' pomodoros of ' + f + ' min)\n' + text.join('\n') + '\nShort breaks of ' + s + ' min between pomodoros.';
    $('pl-copy').setAttribute('data-copy', msg); $('pl-wa').setAttribute('data-wa', msg);
    $('pl-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('pl-print').addEventListener('click', function () { window.print(); });
})();
