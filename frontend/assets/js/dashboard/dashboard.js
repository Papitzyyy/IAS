/**
 * dashboard/dashboard.js
 * ----------------------
 * Loads summary stats, tag coverage, students-without-tag list,
 * recent activity feed, and today's audit count.
 */

var _students   = null;
var _tags       = null;
var _responders = null;
var _logsToday  = null;
var _recentLogs = null;

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

function hasAccess(module) {
  var role = localStorage.getItem('role') || '';
  if (!module || role === 'admin') return true;
  try {
    var p = JSON.parse(localStorage.getItem('permissions') || '{}');
    return !!(p[module] && p[module].length > 0);
  } catch (e) { return false; }
}

// ---------------------------------------------------------------------------
// Render — waits for all data to arrive
// ---------------------------------------------------------------------------

function tryRenderDashboard() {
  // Only render once all expected data has arrived
  // Skipped modules are pre-set to [] or {}, so they won't block rendering
  if (_students === null || _tags === null || _responders === null ||
      _logsToday === null || _recentLogs === null) return;

  // Hide coverage bar and no-tag list if staff can't see students/tags
  var role = localStorage.getItem('role') || '';
  var coverageCard = document.getElementById('coverage-card');
  var noTagSection = document.getElementById('notag-list') && document.getElementById('notag-list').closest('.card');
  if (role === 'staff' && !hasAccess('students')) {
    if (coverageCard) coverageCard.style.display = 'none';
    var noTagCard = document.getElementById('notag-list');
    if (noTagCard) noTagCard.closest('.card').style.display = 'none';
  }

  // Hide activity feed if staff can't see audit
  if (role === 'staff' && !hasAccess('audit')) {
    var feedCard = document.getElementById('activity-feed');
    if (feedCard) feedCard.closest('.card').style.display = 'none';
  }

  var activeStudents   = _students.filter(function (s) { return !s.is_archived; });
  var activeTags       = _tags.filter(function (t) { return t.is_active; }).length;
  var activeResponders = _responders.filter(function (r) { return r.is_active; }).length;
  var todayEvents      = _logsToday.total || 0;

  // ── Stat cards ──
  var el;
  el = document.getElementById('stat-students');   if (el) el.textContent = activeStudents.length;
  el = document.getElementById('stat-tags');       if (el) el.textContent = activeTags;
  el = document.getElementById('stat-responders'); if (el) el.textContent = activeResponders;
  el = document.getElementById('stat-logs');       if (el) el.textContent = todayEvents;

  // ── Tag coverage bar ──
  var total    = activeStudents.length;
  var covered  = activeStudents.filter(function (s) { return s.has_active_tag; }).length;
  var pct      = total > 0 ? Math.round((covered / total) * 100) : 0;
  var barEl    = document.getElementById('coverage-bar');
  var labelEl  = document.getElementById('coverage-label');
  var subEl    = document.getElementById('coverage-sub');
  if (barEl)   barEl.style.width = pct + '%';
  if (labelEl) labelEl.textContent = pct + '%';
  if (subEl)   subEl.textContent = covered + ' of ' + total + ' active students have an active QR tag.';

  // ── Students without a tag ──
  var noTag = activeStudents
    .filter(function (s) { return !s.has_active_tag; })
    .slice(0, 8); // show up to 8
  var noTagEl = document.getElementById('notag-list');
  if (noTagEl) {
    if (!noTag.length) {
      noTagEl.innerHTML =
        '<div style="padding:24px 16px;text-align:center;">' +
        '<p style="font-size:0.82rem;color:var(--green);font-weight:600;">✓ All active students have a QR tag.</p>' +
        '</div>';
    } else {
      noTagEl.innerHTML = noTag.map(function (s) {
        return (
          '<div class="notag-row">' +
          '<div>' +
            '<div class="notag-row-name">' + escapeHTML(s.full_name || '—') + '</div>' +
            '<div class="notag-row-meta">' + escapeHTML(s.student_number || '') +
              (s.program ? ' · ' + escapeHTML(s.program) : '') + '</div>' +
          '</div>' +
          '<span class="badge badge-amber">No tag</span>' +
          '</div>'
        );
      }).join('') +
      (activeStudents.filter(function (s) { return !s.has_active_tag; }).length > 8
        ? '<div style="padding:10px 16px;text-align:center;">' +
          '<a href="tags.html" style="font-size:0.75rem;color:var(--brand);font-weight:600;">View all in QR Tags →</a>' +
          '</div>'
        : '');
    }
  }

  // ── Recent activity feed ──
  var feedEl = document.getElementById('activity-feed');
  if (feedEl) {
    var results = (_recentLogs.results || []);
    if (!results.length) {
      feedEl.innerHTML = '<div style="padding:24px 16px;text-align:center;"><p style="font-size:0.82rem;color:var(--text-muted);">No activity yet.</p></div>';
    } else {
      feedEl.innerHTML = results.map(function (log) {
        var dot = activityDotColor(log.action);
        var label = log.action.replace(/_/g, ' ');
        var time  = timeAgo(log.created_at);
        return (
          '<div class="activity-row">' +
          '<div class="activity-dot ' + dot + '"></div>' +
          '<div style="min-width:0;flex:1;">' +
            '<div class="activity-action">' + escapeHTML(label) + '</div>' +
            (log.detail ? '<div class="activity-detail" title="' + escapeHTML(log.detail) + '">' + escapeHTML(log.detail) + '</div>' : '') +
          '</div>' +
          '<div class="activity-time">' + time + '</div>' +
          '</div>'
        );
      }).join('');
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function activityDotColor(action) {
  if (!action) return 'gray';
  if (action.indexOf('failure') >= 0 || action.indexOf('invalid') >= 0 || action === 'unauthorized_request') return 'red';
  if (action === 'login_success' || action === 'qr_scan') return 'green';
  if (action.indexOf('created') >= 0 || action === 'session_revoked') return 'blue';
  if (action.indexOf('archived') >= 0 || action.indexOf('deactivated') >= 0) return 'amber';
  return 'gray';
}

function timeAgo(isoStr) {
  if (!isoStr) return '';
  var diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60)   return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

function loadDashboard() {
  var role = localStorage.getItem('role') || '';

  // Students
  if (role === 'admin' || hasAccess('students')) {
    apiFetch("GET", "/students?include_archived=true", null, function (data) {
      _students = data || [];
      tryRenderDashboard();
    }, function () { _students = []; tryRenderDashboard(); });
  } else {
    _students = [];
  }

  // Tags
  if (role === 'admin' || hasAccess('tags')) {
    apiFetch("GET", "/tags", null, function (data) {
      _tags = data || [];
      tryRenderDashboard();
    }, function () { _tags = []; tryRenderDashboard(); });
  } else {
    _tags = [];
  }

  // Responders
  if (role === 'admin' || hasAccess('responders')) {
    apiFetch("GET", "/responders", null, function (data) {
      _responders = data || [];
      tryRenderDashboard();
    }, function () { _responders = []; tryRenderDashboard(); });
  } else {
    _responders = [];
  }

  // Audit — today's count
  if (role === 'admin' || hasAccess('audit')) {
    var today = new Date().toISOString().slice(0, 10);
    apiFetch("GET", "/audit?page=1&page_size=1&date=" + today, null, function (data) {
      _logsToday = data || { total: 0 };
      tryRenderDashboard();
    }, function () { _logsToday = { total: 0 }; tryRenderDashboard(); });

    apiFetch("GET", "/audit?page=1&page_size=6", null, function (data) {
      _recentLogs = data || { results: [] };
      tryRenderDashboard();
    }, function () { _recentLogs = { results: [] }; tryRenderDashboard(); });
  } else {
    _logsToday  = { total: 0 };
    _recentLogs = { results: [] };
  }

  tryRenderDashboard();
}

document.addEventListener("DOMContentLoaded", function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get("welcome") === "1" && typeof showToast === "function") {
    showToast("Welcome back! You are now logged in.", "success");
    window.history.replaceState({}, "", "dashboard.html");
  }

  function wireStatCards() {
    var role = localStorage.getItem('role') || '';
    var name = localStorage.getItem('name') || 'there';
    var first = name.split(' ')[0] || name;

    // Cards config: [cardId, href, module]
    var cards = [
      ['card-students',   'students.html',   'students'],
      ['card-tags',       'tags.html',       'tags'],
      ['card-responders', 'responders.html', 'responders'],
      ['card-audit',      'audit.html',      'audit'],
    ];

    var accessibleCount = cards.filter(function (c) { return hasAccess(c[2]); }).length;

    // If staff with zero permissions — show welcome screen, hide everything else
    if (role === 'staff' && accessibleCount === 0) {
      var body = document.querySelector('.page-body');
      if (body) {
        body.innerHTML =
          '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'min-height:60vh;text-align:center;padding:40px 24px;">' +
          '<div style="width:72px;height:72px;background:var(--blue-light);border-radius:20px;' +
          'display:flex;align-items:center;justify-content:center;margin-bottom:20px;">' +
          '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>' +
          '<h2 style="font-size:1.4rem;font-weight:800;color:var(--text-primary);margin:0 0 10px;">Welcome, ' + escapeHTML(first) + '!</h2>' +
          '<p style="font-size:0.9rem;color:var(--text-muted);max-width:400px;line-height:1.7;margin:0 0 8px;">' +
          'You are logged in to the <strong>CRCY Scan and Help</strong> system at EVSU Ormoc Campus.</p>' +
          '<p style="font-size:0.82rem;color:var(--text-muted);max-width:380px;line-height:1.6;">' +
          'Your account has no module access configured yet. Please contact the clinic administrator to have your permissions set up.</p>' +
          '</div>';
      }
      return;
    }

    // For staff with some permissions — hide inaccessible cards, wire accessible ones
    cards.forEach(function (c) {
      var card = document.getElementById(c[0]);
      if (!card) return;
      if (hasAccess(c[2])) {
        card.style.cursor = 'pointer';
        card.onclick = function () { window.location.href = c[1]; };
      } else {
        // Hide cards the staff member can't access
        card.style.display = 'none';
      }
    });
  }

  window.addEventListener('userInfoCached', wireStatCards);
  wireStatCards();

  loadDashboard();
});


// Auto-refresh
function refreshData() {
  loadDashboard();
}
