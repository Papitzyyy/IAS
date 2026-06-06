/**
 * Shared sidebar renderer — injects the sidebar HTML and wires up logout.
 * Call renderSidebar(activePage) from each page.
 * activePage: 'dashboard' | 'students' | 'tags' | 'responders' | 'audit' | 'profile' | 'staff'
 */
function renderSidebar(activePage) {
  var mainNav = [
    { id: 'dashboard',  label: 'Dashboard',  href: 'dashboard.html',  icon: sidebarIcons.dashboard, module: null },
    { id: 'students',   label: 'Students',   href: 'students.html',   icon: sidebarIcons.students, module: 'students' },
    { id: 'tags',       label: 'QR Tags',    href: 'tags.html',       icon: sidebarIcons.tags, module: 'tags' },
    { id: 'responders', label: 'CRCY Responders', href: 'responders.html', icon: sidebarIcons.responders, module: 'responders' },
  ];
  var systemNav = [
    { id: 'audit',   label: 'Audit Logs', href: 'audit.html',   icon: sidebarIcons.audit, module: 'audit' },
    { id: 'staff',   label: 'Staff',      href: 'staff.html',   icon: sidebarIcons.staff, module: null, adminOnly: true },
  ];

  // Get user role and permissions from session
  var role = localStorage.getItem('role') || '';
  var permissionsStr = localStorage.getItem('permissions') || '{}';
  var permissions = {};
  try {
    permissions = JSON.parse(permissionsStr);
  } catch (e) {
    permissions = {};
  }

  // Helper function to check if user has access to a module
  function hasModuleAccess(module) {
    if (!module || role === 'admin') return true; // Admins and dashboard have access
    if (role === 'staff' && permissions[module]) {
      return permissions[module].includes('read');
    }
    return false;
  }

  // Filter navigation items based on role and permissions
  var filteredMainNav = mainNav.filter(function(n) {
    return hasModuleAccess(n.module);
  });
  var filteredSystemNav = systemNav.filter(function(n) {
    if (n.adminOnly) return role === 'admin';
    return hasModuleAccess(n.module);
  });

  function buildLinks(items) {
    return items.map(function(n) {
      var active = n.id === activePage;
      return '<a href="' + n.href + '" class="sidebar-link' + (active ? ' active' : '') + '" title="' + n.label + '" aria-current="' + (active ? 'page' : 'false') + '">' +
        n.icon +
        '<span>' + n.label + '</span>' +
      '</a>';
    }).join('');
  }

  var html =
    '<a href="#main-content" class="skip-link">Skip to main content</a>' +
    '<aside class="sidebar" id="sidebar" role="navigation" aria-label="Main navigation">' +
      '<div class="sidebar-brand">' +
        '<div class="brand-icon">' + sidebarIcons.brand + '</div>' +
        '<div class="brand-text">' +
          '<span class="brand-name">CRCY</span>' +
          '<span class="brand-sub">Scan &amp; Help</span>' +
        '</div>' +
      '</div>' +

      '<div class="sidebar-user" id="sidebar-user" onclick="openProfileModal()" style="cursor:pointer;" role="button" aria-label="My Profile">' +
        '<div class="user-avatar" id="sidebar-avatar" aria-hidden="true">A</div>' +
        '<div class="user-info">' +
          '<span class="user-name" id="sidebar-name">Admin</span>' +
          '<span class="user-role" id="sidebar-role">Clinic Admin</span>' +
        '</div>' +
      '</div>' +

      '<nav class="sidebar-nav" aria-label="Site pages">' +
        '<span class="sidebar-section-label">Main</span>' +
        buildLinks(filteredMainNav) +
        '<span class="sidebar-section-label" style="margin-top:8px;">System</span>' +
        buildLinks(filteredSystemNav) +
      '</nav>' +

      '<div class="sidebar-footer">' +
        '<button class="sidebar-link logout-btn" id="btn-logout" title="Logout" aria-label="Logout">' +
          sidebarIcons.logout +
          '<span>Logout</span>' +
        '</button>' +
      '</div>' +
    '</aside>' +

    '<div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()" aria-hidden="true"></div>' +

    '<header class="topbar" role="banner">' +
      '<button class="topbar-menu-btn" onclick="toggleSidebar()" title="Open menu" aria-label="Open navigation menu" aria-expanded="false" id="topbar-menu-btn">' +
        sidebarIcons.menu +
      '</button>' +
      '<div class="topbar-title" id="topbar-title"></div>' +
      '<div class="topbar-right">' +
        '<div class="topbar-user-chip" id="topbar-user-chip" onclick="openProfileModal()" style="cursor:pointer;" role="button" aria-label="My Profile">' +
          '<div class="chip-avatar" id="topbar-avatar" aria-hidden="true">A</div>' +
          '<span id="topbar-name">Admin</span>' +
        '</div>' +
      '</div>' +
    '</header>';

  var modalHtml = 
    '<style>' +
      '.profile-modal-grid {' +
        'display: grid;' +
        'grid-template-columns: 1fr 1fr;' +
        'gap: 24px;' +
      '}' +
      '@media (max-width: 640px) {' +
        '.profile-modal-grid {' +
          'grid-template-columns: 1fr !important;' +
          'gap: 16px !important;' +
        '}' +
        '.profile-modal-grid-right {' +
          'border-left: none !important;' +
          'padding-left: 0 !important;' +
          'border-top: 1px solid var(--border) !important;' +
          'padding-top: 16px !important;' +
        '}' +
      '}' +
    '</style>' +
    '<div class="modal-overlay" id="profile-modal-overlay" onclick="handleProfileOverlayClick(event)">' +
      '<div class="modal modal-lg">' +
        '<div class="modal-header">' +
          '<div>' +
            '<h3>My Profile</h3>' +
            '<p>Update your contact details or change your password</p>' +
          '</div>' +
          '<button class="modal-close" onclick="closeProfileModal()">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding: 22px 26px;">' +
          '<div class="profile-modal-grid">' +
            '<!-- Column 1: Account Details -->' +
            '<div>' +
              '<h4 style="margin-top: 0; margin-bottom: 16px; font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">Account Details</h4>' +
              '<div style="margin-bottom: 14px;">' +
                '<label class="field-label" style="display:block; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:5px;">First Name</label>' +
                '<input id="profile-f-first" type="text" class="profile-input" style="width:100%; border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:9px 12px; font-size:0.82rem; outline:none; color:var(--text-primary); background:#fff;" placeholder="Leave blank to keep current" />' +
              '</div>' +
              '<div style="margin-bottom: 14px;">' +
                '<label class="field-label" style="display:block; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:5px;">Middle Name</label>' +
                '<input id="profile-f-middle" type="text" class="profile-input" style="width:100%; border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:9px 12px; font-size:0.82rem; outline:none; color:var(--text-primary); background:#fff;" placeholder="Leave blank to keep current" />' +
              '</div>' +
              '<div style="margin-bottom: 14px;">' +
                '<label class="field-label" style="display:block; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:5px;">Last Name</label>' +
                '<input id="profile-f-last" type="text" class="profile-input" style="width:100%; border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:9px 12px; font-size:0.82rem; outline:none; color:var(--text-primary); background:#fff;" placeholder="Leave blank to keep current" />' +
              '</div>' +
              '<div style="margin-bottom: 14px;">' +
                '<label class="field-label" style="display:block; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:5px;">Email Address</label>' +
                '<input id="profile-f-email" type="email" class="profile-input" style="width:100%; border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:9px 12px; font-size:0.82rem; outline:none; color:var(--text-primary); background:#fff;" placeholder="Leave blank to keep current" />' +
              '</div>' +
            '</div>' +
            '<!-- Column 2: Change Password -->' +
            '<div style="border-left: 1px solid var(--border); padding-left: 24px;" class="profile-modal-grid-right">' +
              '<h4 style="margin-top: 0; margin-bottom: 16px; font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">Change Password</h4>' +
              '<div style="margin-bottom: 14px;">' +
                '<label class="field-label" style="display:block; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:5px;">New Password</label>' +
                '<input id="profile-f-password" type="password" class="profile-input" style="width:100%; border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:9px 12px; font-size:0.82rem; outline:none; color:var(--text-primary); background:#fff;" placeholder="Leave blank to keep current" />' +
              '</div>' +
              '<div style="margin-bottom: 14px;">' +
                '<label class="field-label" style="display:block; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:5px;">Confirm New Password</label>' +
                '<input id="profile-f-confirm" type="password" class="profile-input" style="width:100%; border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:9px 12px; font-size:0.82rem; outline:none; color:var(--text-primary); background:#fff;" placeholder="Repeat new password" />' +
              '</div>' +
              '<!-- OTP step — shown only when password is entered -->' +
              '<div id="profile-otp-section" style="display:none;">' +
                '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;margin-bottom:10px;">' +
                  '<p style="margin:0;font-size:0.72rem;color:#991b1b;">A one-time code has been sent to your email. Enter it below to confirm the password change.</p>' +
                '</div>' +
                '<label class="field-label" style="display:block; font-size:0.72rem; font-weight:600; color:var(--text-secondary); margin-bottom:5px;">One-Time Code</label>' +
                '<input id="profile-f-otp" type="text" inputmode="numeric" maxlength="6" class="profile-input" style="width:100%; border:1.5px solid var(--border); border-radius:var(--radius-sm); padding:9px 12px; font-size:1.4rem; font-family:monospace; font-weight:700; letter-spacing:0.4em; text-align:center; outline:none; color:var(--text-primary); background:#fff;" placeholder="000000" />' +
              '</div>' +
              '<button id="profile-btn-send-otp" type="button" style="display:none;margin-top:8px;width:100%;padding:8px;border:1.5px solid var(--brand);border-radius:var(--radius-sm);background:#fff;color:var(--brand);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:var(--font);" onclick="sendProfileOtp()">Send OTP to my email</button>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); display:flex; justify-content:flex-end; gap:12px; align-items:center;">' +
            '<p id="profile-modal-error" style="display:none; color:var(--red); font-size:0.78rem; margin:0; flex-grow:1; text-align:left;"></p>' +
            '<button class="btn btn-secondary" onclick="closeProfileModal()">Cancel</button>' +
            '<button class="btn btn-primary" onclick="saveProfileModalChanges()">Save Changes</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  html += modalHtml;

  var mount = document.getElementById('sidebar-mount');
  if (mount) mount.innerHTML = html;

  // Add id to main content for skip link
  var mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.id = 'main-content';

  // Wire logout
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#btn-logout');
    if (!btn) return;
    localStorage.clear();
    window.location.href = 'login.html?logged_out=1';
  });

  // Toggle aria-expanded on mobile menu button
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#topbar-menu-btn');
    if (!btn) return;
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
  });

  // Populate user info from session
  var role  = localStorage.getItem('role') || '';
  var email = localStorage.getItem('email') || '';
  var name  = localStorage.getItem('name') || email.split('@')[0] || 'Admin';
  var initial = (name[0] || 'A').toUpperCase();

  ['sidebar-avatar','topbar-avatar'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = initial;
  });
  ['sidebar-name','topbar-name'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = name;
  });
  var roleEl = document.getElementById('sidebar-role');
  if (roleEl) roleEl.textContent = role === 'admin' ? 'Clinic Admin' : role === 'responder' ? 'CRCY Responder' : role === 'staff' ? 'Clinic Staff' : role;

  // Set topbar title to match active page
  var pageLabels = { dashboard: 'Dashboard', students: 'Students', tags: 'QR Tags', responders: 'College Red Cross Youth Responders', audit: 'Audit Logs', staff: 'Clinic Staff', profile: 'My Profile' };
  var titleEl = document.getElementById('topbar-title');
  if (titleEl && pageLabels[activePage]) titleEl.textContent = pageLabels[activePage];

  // Auto-open profile modal if requested in URL parameters
  setTimeout(function() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("open_profile") === "1") {
      openProfileModal();
      var cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, 100);
}

// ---------------------------------------------------------------------------
// Profile Modal Actions & Operations (CRUD - Read & Update)
// ---------------------------------------------------------------------------

window.openProfileModal = function() {
  var overlay = document.getElementById('profile-modal-overlay');
  if (!overlay) return;

  overlay.classList.add('open');

  // Reset all fields and hide OTP section
  document.getElementById('profile-f-first').value    = '';
  document.getElementById('profile-f-middle').value   = '';
  document.getElementById('profile-f-last').value     = '';
  document.getElementById('profile-f-email').value   = '';
  document.getElementById('profile-f-password').value = '';
  document.getElementById('profile-f-confirm').value  = '';
  document.getElementById('profile-f-otp').value      = '';
  document.getElementById('profile-otp-section').style.display  = 'none';
  document.getElementById('profile-btn-send-otp').style.display = 'none';

  var errEl = document.getElementById('profile-modal-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  // Pre-fill placeholders with current values
  var token = localStorage.getItem('access_token');
  fetch('/api/v1/responders/me-info', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) { return r.ok ? r.json() : null; })
  .then(function(d) {
    if (d) {
      document.getElementById('profile-f-first').placeholder  = d.first_name || 'Leave blank to keep current';
      document.getElementById('profile-f-middle').placeholder = d.middle_name || 'Leave blank to keep current';
      document.getElementById('profile-f-last').placeholder   = d.last_name || 'Leave blank to keep current';
      document.getElementById('profile-f-email').placeholder = d.email     || 'Leave blank to keep current';
    }
  })
  .catch(function() {});

  // Show "Send OTP" button when user starts typing a new password
  var pwEl = document.getElementById('profile-f-password');
  if (pwEl) {
    pwEl.oninput = function() {
      var hasPassword = this.value.length > 0;
      document.getElementById('profile-btn-send-otp').style.display = hasPassword ? 'block' : 'none';
      if (!hasPassword) {
        document.getElementById('profile-otp-section').style.display = 'none';
        document.getElementById('profile-f-otp').value = '';
      }
    };
  }
};

window.closeProfileModal = function() {
  var overlay = document.getElementById('profile-modal-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
};

window.handleProfileOverlayClick = function(event) {
  if (event.target.id === 'profile-modal-overlay') {
    closeProfileModal();
  }
};

window.sendProfileOtp = function() {
  var btn = document.getElementById('profile-btn-send-otp');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  var token = localStorage.getItem('access_token');
  fetch('/api/v1/auth/request-password-otp', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
  .then(function(r) {
    if (r.ok) {
      document.getElementById('profile-otp-section').style.display = 'block';
      if (typeof showToast === 'function') showToast('OTP sent to your email.', 'info');
      if (btn) { btn.textContent = 'Resend OTP'; btn.disabled = false; }
    } else {
      var msg = (r.data && r.data.detail) ? r.data.detail : 'Failed to send OTP.';
      if (typeof showToast === 'function') showToast(msg, 'error');
      if (btn) { btn.textContent = 'Send OTP to my email'; btn.disabled = false; }
    }
  })
  .catch(function() {
    if (typeof showToast === 'function') showToast('Connection error.', 'error');
    if (btn) { btn.textContent = 'Send OTP to my email'; btn.disabled = false; }
  });
};

window.saveProfileModalChanges = function() {
  var first_name = document.getElementById('profile-f-first').value.trim();
  var middle_name = document.getElementById('profile-f-middle').value.trim();
  var last_name = document.getElementById('profile-f-last').value.trim();
  var email    = document.getElementById('profile-f-email').value.trim();
  var password = document.getElementById('profile-f-password').value;
  var confirm  = document.getElementById('profile-f-confirm').value;
  var otp      = document.getElementById('profile-f-otp').value.trim();

  var errEl = document.getElementById('profile-modal-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

  if (!first_name && !last_name && !middle_name && !email && !password) {
    if (errEl) { errEl.textContent = 'No changes to save.'; errEl.style.display = 'block'; }
    if (typeof showToast === 'function') showToast('No changes to save.', 'warning');
    return;
  }

  if (email) {
    var emailDomain = '@evsu.edu.ph';
    var e = email.trim().toLowerCase();
    if (!e.endsWith(emailDomain) || e.length <= emailDomain.length + 1) {
      if (errEl) { errEl.textContent = 'Email must be a valid @evsu.edu.ph address.'; errEl.style.display = 'block'; }
      return;
    }
  }

  if (password) {
    if (password !== confirm) {
      if (errEl) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; }
      return;
    }
    var pwErrors = [];
    if (password.length < 12)                                          pwErrors.push('At least 12 characters');
    if (!/[A-Z]/.test(password))                                       pwErrors.push('At least one uppercase letter');
    if (!/[a-z]/.test(password))                                       pwErrors.push('At least one lowercase letter');
    if (!/\d/.test(password))                                          pwErrors.push('At least one number');
    if (!/[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\\|`~]/.test(password))   pwErrors.push('At least one special character');
    if (pwErrors.length) {
      if (errEl) { errEl.textContent = 'Password too weak — ' + pwErrors[0]; errEl.style.display = 'block'; }
      return;
    }
    // OTP required for password change
    if (!otp || otp.length < 6) {
      if (errEl) { errEl.textContent = 'Enter the 6-digit OTP sent to your email to confirm the password change.'; errEl.style.display = 'block'; }
      document.getElementById('profile-otp-section').style.display = 'block';
      return;
    }
  }

  var body = {};
  if (first_name)  body.first_name = first_name;
  if (middle_name) body.middle_name = middle_name;
  if (last_name)   body.last_name = last_name;
  if (email)    body.email     = email;
  if (password) { body.password = password; body.otp = otp; }

  var token = localStorage.getItem('access_token');
  fetch('/api/v1/responders/me', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(function(res) { return res.json().then(function(d) { return { ok: res.ok, data: d }; }); })
  .then(function(r) {
    if (r.ok) {
      var d = r.data;
      if (d.full_name) {
        localStorage.setItem('name', d.full_name);
        var initial = d.full_name[0].toUpperCase();
        ['sidebar-avatar','topbar-avatar'].forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = initial; });
        ['sidebar-name','topbar-name'].forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = d.full_name; });
      }
      if (d.email) localStorage.setItem('email', d.email);
      if (typeof showToast === 'function') showToast('Profile updated successfully.', 'success');
      closeProfileModal();
    } else {
      var msg = 'Update failed.';
      if (r.data && r.data.detail) {
        msg = typeof r.data.detail === 'string' ? r.data.detail
            : Array.isArray(r.data.detail) ? r.data.detail.map(function(e) { return e.msg; }).join(' ')
            : msg;
      }
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
      if (typeof showToast === 'function') showToast(msg, 'error');
    }
  })
  .catch(function() {
    var msg = 'Connection error. Please try again.';
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    if (typeof showToast === 'function') showToast(msg, 'error');
  });
};

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  var btn     = document.getElementById('topbar-menu-btn');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
  if (btn) btn.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
}
function closeSidebar() {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  var btn     = document.getElementById('topbar-menu-btn');
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Close sidebar on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeSidebar();
});

var sidebarIcons = {
  brand:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  menu:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  dashboard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  students:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  tags:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  responders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  audit:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  staff:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  profile:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  logout:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

