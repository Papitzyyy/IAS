/**
 * Toast notifications — improved design with icons, better spacing, and smooth animations.
 * Follows UI principles: Clarity, Feedback, Hierarchy, User Control
 */
(function () {
  var CONTAINER_ID = "toast-container";

  function ensureContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (el) return el;
    el = document.createElement("div");
    el.id = CONTAINER_ID;
    el.setAttribute("aria-live", "polite");
    el.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:12px;max-width:360px;pointer-events:none;";
    document.body.appendChild(el);
    return el;
  }

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  var COLORS = {
    success: { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
    error: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
    info: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
    warning: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  };

  window.showToast = function (message, type, durationMs) {
    type = type || "info";
    durationMs = durationMs == null ? 4000 : durationMs;
    var container = ensureContainer();
    var toast = document.createElement("div");
    toast.setAttribute("role", "status");
    toast.className = "toast-notification";
    toast.style.cssText =
      "background:#fff;border:1px solid var(--border);border-radius:12px;" +
      "padding:14px 16px;box-shadow:var(--shadow-md);pointer-events:auto;" +
      "animation:toast-in 0.3s ease;position:relative;min-width:280px;" +
      "display:flex;align-items:flex-start;gap:12px;transition:all 0.3s ease;";
    
    var colors = COLORS[type] || COLORS.info;
    toast.style.borderLeft = "4px solid " + colors.border;
    
    toast.innerHTML =
      '<div style="flex-shrink:0;margin-top:1px;">' + (ICONS[type] || ICONS.info) + '</div>' +
      '<div style="flex:1;">' +
        '<p style="margin:0;font-size:0.85rem;font-weight:600;color:var(--text-primary);line-height:1.5;">' + message + '</p>' +
      '</div>' +
      '<button onclick="this.parentElement.remove()" style="position:absolute;top:10px;right:10px;" ' +
        'class="btn-icon" title="Close" aria-label="Close toast">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';
    
    container.appendChild(toast);
    
    // Auto-dismiss
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(function () { toast.remove(); }, 300);
    }, durationMs);
  };

  if (!document.getElementById("toast-keyframes")) {
    var style = document.createElement("style");
    style.id = "toast-keyframes";
    style.textContent =
      "@keyframes toast-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}";
    document.head.appendChild(style);
  }
})();
