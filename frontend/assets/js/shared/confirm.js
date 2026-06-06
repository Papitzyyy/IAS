/**
 * shared/confirm.js
 * -----------------
 * Promise-based confirm dialog — replaces window.confirm.
 * Design: Clear hierarchy, visual feedback, user control
 *
 * Usage:
 *   showConfirm({ title, message, confirmLabel, cancelLabel, danger })
 *     .then(function(ok) { if (ok) { ... } });
 */
(function () {
  var OVERLAY_ID = "confirm-overlay";

  function ensureOverlay() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = OVERLAY_ID;
    el.style.cssText =
      "display:none;position:fixed;inset:0;background:rgba(17,24,39,0.55);z-index:10000;" +
      "align-items:center;justify-content:center;padding:32px 16px;overflow-y:auto;" +
      "backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);";

    el.innerHTML =
      '<div style="background:#fff;border-radius:18px;max-width:420px;width:100%;' +
      'box-shadow:var(--shadow-lg);border:1px solid var(--border);animation:confirm-in 0.25s ease;">' +
      '<div style="padding:32px 32px 24px;">' +
      '<div id="confirm-icon" style="width:56px;height:56px;border-radius:50%;' +
      'display:flex;align-items:center;justify-content:center;margin:0 auto 18px;' +
      'background:#fee2e2;color:var(--red);"></div>' +
      '<h3 id="confirm-title" style="font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:0 0 8px;text-align:center;"></h3>' +
      '<p id="confirm-message" style="font-size:0.88rem;color:var(--text-secondary);margin:0 0 24px;line-height:1.6;text-align:center;"></p>' +
      '</div>' +
      '<div style="padding:16px 32px 24px;border-top:1px solid var(--border);' +
      'display:flex;gap:10px;justify-content:center;background:#fafbfc;">' +
      '<button type="button" id="confirm-cancel" ' +
        'style="padding:9px 20px;border:1.5px solid var(--border);border-radius:var(--radius-sm);' +
        'background:#fff;font-size:0.83rem;font-weight:600;cursor:pointer;color:var(--text-secondary);' +
        'transition:all 0.15s;">Cancel</button>' +
      '<button type="button" id="confirm-ok" ' +
        'style="padding:9px 20px;border:none;border-radius:var(--radius-sm);font-size:0.83rem;' +
        'font-weight:600;color:#fff;cursor:pointer;transition:all 0.15s;box-shadow:0 2px 8px rgba(0,0,0,0.15);">Confirm</button>' +
      "</div></div>";

    document.body.appendChild(el);

    // Inject keyframe animation once
    if (!document.getElementById("confirm-keyframes")) {
      var style = document.createElement("style");
      style.id = "confirm-keyframes";
      style.textContent =
        "@keyframes confirm-in{from{opacity:0;transform:translateY(16px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}";
      document.head.appendChild(style);
    }

    return el;
  }

  window.showConfirm = function (opts) {
    opts = opts || {};
    var overlay  = ensureOverlay();
    var titleEl  = document.getElementById("confirm-title");
    var msgEl    = document.getElementById("confirm-message");
    var btnOk    = document.getElementById("confirm-ok");
    var btnCancel = document.getElementById("confirm-cancel");
    var iconEl   = document.getElementById("confirm-icon");

    titleEl.textContent   = opts.title        || "Are you sure?";
    msgEl.textContent     = opts.message      || "";
    btnOk.textContent     = opts.confirmLabel || "Confirm";
    btnCancel.textContent = opts.cancelLabel  || "Cancel";

    // Set icon and button color based on danger
    if (opts.danger) {
      iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      btnOk.style.background = "var(--red)";
      btnOk.style.boxShadow = "0 2px 8px rgba(220,38,38,0.25)";
    } else {
      iconEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
      btnOk.style.background = "var(--brand)";
      btnOk.style.boxShadow = "0 2px 8px rgba(26,86,219,0.25)";
    }

    // Show as flex
    overlay.style.display = "flex";

    return new Promise(function (resolve) {
      function done(result) {
        overlay.style.display = "none";
        btnOk.onclick     = null;
        btnCancel.onclick = null;
        overlay.onclick   = null;
        resolve(result);
      }
      btnOk.onclick     = function () { done(true);  };
      btnCancel.onclick = function () { done(false); };
      overlay.onclick   = function (e) { if (e.target === overlay) done(false); };
    });
  };
})();
