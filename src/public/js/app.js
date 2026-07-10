/* General UI interactions: sidebar toggle, module pinning, dropdowns, modals,
   confirm dialogs, search autocomplete, flash dismissal, dynamic form rows,
   command palette, keyboard shortcuts. */
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initModulePinning();
    initDropdowns();
    initModals();
    initConfirmDialogs();
    initFlashDismiss();
    initSearch();
    initPasswordToggle();
    initDynamicRows();
    initTableCheckAll();
    initAvatarFallback();
    initCommandPalette();
    initKeyboardShortcuts();
    initSmoothPageTransitions();
  });

  /* ---------- Smooth page transitions ---------- */
  function initSmoothPageTransitions() {
    // Add fade-in to main content on load
    var main = document.querySelector('main');
    if (main) {
      main.classList.add('animate-fade-in');
    }
  }

  /* ---------- Broken avatar/file image fallback ----------
     If an uploaded avatar or image file is missing (404), swap the
     broken <img> for a neutral placeholder so the UI stays clean. */
  function initAvatarFallback() {
    var PLACEHOLDER =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#e2e8f0"/><circle cx="20" cy="15" r="6" fill="#94a3b8"/><path d="M8 34c0-6 5-10 12-10s12 4 12 10" fill="#94a3b8"/></svg>'
      );
    document.addEventListener(
      'error',
      function (e) {
        var img = e.target;
        if (img && img.tagName === 'IMG' && /avatar|uploads/i.test(img.src + ' ' + (img.alt || ''))) {
          if (img.dataset.fallbackApplied) return;
          img.dataset.fallbackApplied = '1';
          img.src = PLACEHOLDER;
          img.classList.add('bg-slate-100');
        }
      },
      true // capture phase — needed to catch image error events
    );
  }

  /* ---------- Premium Sidebar System ----------
     Features:
     - Smooth expand/collapse with cubic-bezier transitions
     - Collapsed tooltips on hover
     - Mobile overlay drawer with backdrop + scroll lock
     - Keyboard accessibility (Enter, Space, Escape)
     - Active route detection
     - Module-level pinning (see initModulePinning)
  */
  function initSidebar() {
    var toggle = document.getElementById('sidebar-toggle');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    if (!toggle || !sidebar) return;

    var DESKTOP_BP = 1024;
    var STORAGE_KEY = 'hrm-sidebar';
    var body = document.body;

    function isDesktop() {
      return window.innerWidth >= DESKTOP_BP;
    }

    // Read persisted state
    function readState() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { desktop: 'open', mobile: 'closed' };
        var s = JSON.parse(raw);
        return {
          desktop: s.desktop === 'collapsed' ? 'collapsed' : 'open',
          mobile: 'closed',
        };
      } catch (e) {
        return { desktop: 'open', mobile: 'closed' };
      }
    }

    function writeState(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ desktop: state.desktop }));
      } catch (e) {}
    }

    var state = readState();

    function apply() {
      var desktop = isDesktop();
      // Clear all modifier classes first
      body.classList.remove('sidebar-collapsed', 'sidebar-open', 'sidebar-drawer-open');
      sidebar.classList.remove('sidebar-drawer');
      toggle.setAttribute('aria-expanded', 'false');
      updateTooltip('Open Sidebar');
      updateIcon(false);

      if (desktop) {
        if (state.desktop === 'collapsed') {
          body.classList.add('sidebar-collapsed');
        } else {
          body.classList.add('sidebar-open');
          toggle.setAttribute('aria-expanded', 'true');
          updateTooltip('Close Sidebar');
          updateIcon(true);
        }
        if (overlay) {
          overlay.classList.add('pointer-events-none');
          overlay.classList.remove('opacity-100');
          overlay.style.opacity = '0';
        }
        body.style.overflow = '';
      } else {
        // Mobile/tablet: drawer mode
        sidebar.classList.add('sidebar-drawer');
        body.classList.add('sidebar-collapsed');
        if (state.mobile === 'open') {
          body.classList.add('sidebar-drawer-open');
          toggle.setAttribute('aria-expanded', 'true');
          updateTooltip('Close Sidebar');
          updateIcon(true);
          if (overlay) {
            overlay.classList.remove('pointer-events-none');
            overlay.style.opacity = '0.5';
          }
          body.style.overflow = 'hidden';
        } else {
          if (overlay) {
            overlay.classList.add('pointer-events-none');
            overlay.style.opacity = '0';
          }
          body.style.overflow = '';
        }
      }
    }

    function updateTooltip(text) {
      var tip = toggle.querySelector('.tooltip-text');
      if (tip) tip.textContent = text;
      toggle.setAttribute('title', text);
      toggle.setAttribute('aria-label', text);
    }

    function updateIcon(open) {
      var bars = toggle.querySelectorAll('.sb-bar');
      if (bars.length < 3) return;
      if (open) {
        bars[0].style.transform = 'translateY(5px) rotate(45deg)';
        bars[0].style.width = '12px';
        bars[0].style.left = '2px';
        bars[1].style.opacity = '0';
        bars[1].style.transform = 'scaleX(0)';
        bars[2].style.transform = 'translateY(-5px) rotate(-45deg)';
        bars[2].style.width = '12px';
        bars[2].style.left = '2px';
      } else {
        bars[0].style.transform = '';
        bars[0].style.width = '';
        bars[0].style.left = '';
        bars[1].style.opacity = '';
        bars[1].style.transform = '';
        bars[2].style.transform = '';
        bars[2].style.width = '';
        bars[2].style.left = '';
      }
    }

    function toggleSidebar() {
      if (isDesktop()) {
        state.desktop = state.desktop === 'open' ? 'collapsed' : 'open';
        writeState(state);
      } else {
        state.mobile = state.mobile === 'open' ? 'closed' : 'open';
      }
      apply();
    }

    function openDrawer() {
      if (!isDesktop()) {
        state.mobile = 'open';
        apply();
      }
    }
    function closeDrawer() {
      if (!isDesktop()) {
        state.mobile = 'closed';
        apply();
      }
    }

    // --- Event wiring ---
    toggle.addEventListener('click', toggleSidebar);
    toggle.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSidebar();
      }
    });

    if (overlay) overlay.addEventListener('click', closeDrawer);

    // Escape closes mobile drawer
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !isDesktop() && state.mobile === 'open') {
        closeDrawer();
        toggle.focus();
      }
    });

    // Re-apply on resize (debounced)
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (isDesktop() && state.mobile === 'open') state.mobile = 'closed';
        apply();
      }, 120);
    });

    // Expose for programmatic control
    window.HRM_Sidebar = {
      open: openDrawer,
      close: closeDrawer,
      toggle: toggleSidebar,
      apply: apply,
      state: state,
    };

    apply();
  }

  /* ---------- Module Pinning ----------
     Allows users to pin individual sidebar menu items to a dedicated
     "Pinned" section at the top of the sidebar. Pinned items are
     persisted in localStorage and restored on every page load.

     Storage key: hrm-sidebar-pinned-modules
     Format: JSON array of { path, icon, label } objects
  */
  function initModulePinning() {
    var PIN_KEY = 'hrm-sidebar-pinned-modules';
    var pinnedSection = document.getElementById('sidebar-pinned-section');
    var pinnedList = document.getElementById('sidebar-pinned-list');
    var nav = document.getElementById('sidebar-nav');
    if (!pinnedSection || !pinnedList || !nav) return;

    // Read pinned modules from localStorage
    function readPinned() {
      try {
        var raw = localStorage.getItem(PIN_KEY);
        if (!raw) return [];
        var arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        return [];
      }
    }

    // Write pinned modules to localStorage
    function writePinned(pinned) {
      try {
        localStorage.setItem(PIN_KEY, JSON.stringify(pinned));
      } catch (e) {}
    }

    // Render the pinned section
    function renderPinned() {
      var pinned = readPinned();
      // Clear current pinned items
      pinnedList.innerHTML = '';

      if (pinned.length === 0) {
        pinnedSection.classList.add('hidden');
        return;
      }
      pinnedSection.classList.remove('hidden');

      // Build pinned link elements
      pinned.forEach(function (item) {
        var link = document.createElement('a');
        link.href = item.path;
        link.className = 'sidebar-link pinned-item';
        link.title = item.label;
        link.setAttribute('aria-label', item.label);
        link.setAttribute('data-nav-label', item.label.toLowerCase());
        link.setAttribute('data-nav-path', item.path);
        link.innerHTML =
          '<i class="fa-solid fa-' + item.icon + ' sidebar-link-icon"></i>' +
          '<span class="sidebar-label">' + item.label + '</span>' +
          '<button type="button" class="sidebar-module-pin pinned active" data-pin-path="' + item.path + '" data-pin-icon="' + item.icon + '" data-pin-label="' + item.label + '" title="Unpin" aria-label="Unpin ' + item.label + '" tabindex="-1">' +
            '<i class="fa-solid fa-thumbtack"></i>' +
          '</button>' +
          '<span class="sidebar-tooltip">' + item.label + '</span>';
        // Mark active if current path matches
        var currentPath = window.location.pathname;
        if (currentPath === item.path || currentPath.indexOf(item.path + '/') === 0) {
          link.classList.add('active');
        }
        pinnedList.appendChild(link);
      });
    }

    // Update the pin button state on original sidebar items
    function updateOriginalPinButtons() {
      var pinned = readPinned();
      var pinnedPaths = pinned.map(function (p) { return p.path; });
      nav.querySelectorAll('.sidebar-module-pin').forEach(function (btn) {
        var path = btn.getAttribute('data-pin-path');
        if (pinnedPaths.indexOf(path) !== -1) {
          btn.classList.add('active');
          btn.setAttribute('title', 'Unpin from top');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('title', 'Pin to top');
        }
      });
    }

    // Toggle pin state for a module
    function togglePin(path, icon, label) {
      var pinned = readPinned();
      var idx = -1;
      for (var i = 0; i < pinned.length; i++) {
        if (pinned[i].path === path) { idx = i; break; }
      }
      if (idx === -1) {
        // Pin it
        pinned.push({ path: path, icon: icon, label: label });
      } else {
        // Unpin it
        pinned.splice(idx, 1);
      }
      writePinned(pinned);
      renderPinned();
      updateOriginalPinButtons();
    }

    // Wire up pin buttons on original sidebar items (event delegation)
    nav.addEventListener('click', function (e) {
      var btn = e.target.closest('.sidebar-module-pin');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var path = btn.getAttribute('data-pin-path');
      var icon = btn.getAttribute('data-pin-icon');
      var label = btn.getAttribute('data-pin-label');
      togglePin(path, icon, label);
    });

    // Wire up pin buttons in the pinned section (event delegation)
    pinnedList.addEventListener('click', function (e) {
      var btn = e.target.closest('.sidebar-module-pin');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var path = btn.getAttribute('data-pin-path');
      var icon = btn.getAttribute('data-pin-icon');
      var label = btn.getAttribute('data-pin-label');
      togglePin(path, icon, label);
    });

    // Initial render
    renderPinned();
    updateOriginalPinButtons();

    // Expose for programmatic control
    window.HRM_ModulePin = {
      pin: function (path, icon, label) {
        var pinned = readPinned();
        if (pinned.findIndex(function (p) { return p.path === path; }) === -1) {
          pinned.push({ path: path, icon: icon, label: label });
          writePinned(pinned);
          renderPinned();
          updateOriginalPinButtons();
        }
      },
      unpin: function (path) {
        var pinned = readPinned().filter(function (p) { return p.path !== path; });
        writePinned(pinned);
        renderPinned();
        updateOriginalPinButtons();
      },
      toggle: togglePin,
      list: readPinned,
    };
  }

  /* ---------- Command Palette ----------
     Opens with Cmd/Ctrl+K or "/" (when not in an input).
     Quick navigation to any sidebar link. */
  function initCommandPalette() {
    var overlay = document.getElementById('cmdk-overlay');
    var input = document.getElementById('cmdk-input');
    var results = document.getElementById('cmdk-results');
    if (!overlay || !input || !results) return;

    var items = [];
    var selectedIndex = 0;

    function buildItems() {
      items = [];
      var seen = {};
      document.querySelectorAll('#sidebar-nav .sidebar-link').forEach(function (link) {
        var href = link.getAttribute('href');
        var label = link.querySelector('.sidebar-label') ?
          link.querySelector('.sidebar-label').textContent.trim() :
          link.getAttribute('title') || link.textContent.trim();
        var icon = link.querySelector('.sidebar-link-icon') ?
          link.querySelector('.sidebar-link-icon').outerHTML : '';
        if (href && href !== '#' && !seen[href]) {
          seen[href] = true;
          items.push({ href: href, label: label, icon: icon, group: 'Navigation' });
        }
      });
      // Add common actions
      items.push({ href: '/profile', label: 'My Profile', icon: '<i class="fa-solid fa-user sidebar-link-icon"></i>', group: 'Account' });
      items.push({ href: '/logout', label: 'Sign Out', icon: '<i class="fa-solid fa-right-from-bracket sidebar-link-icon"></i>', group: 'Account' });
    }

    function render(filter) {
      var filtered = items;
      if (filter) {
        var q = filter.toLowerCase();
        filtered = items.filter(function (it) { return it.label.toLowerCase().indexOf(q) !== -1; });
      }
      selectedIndex = 0;
      if (!filtered.length) {
        results.innerHTML = '<div class="px-4 py-8 text-center text-sm text-slate-400">No results found</div>';
        return;
      }
      // Group items
      var grouped = {};
      filtered.forEach(function (it) {
        if (!grouped[it.group]) grouped[it.group] = [];
        grouped[it.group].push(it);
      });
      var html = '';
      var globalIdx = 0;
      Object.keys(grouped).forEach(function (group) {
        html += '<div class="cmdk-group-label">' + group + '</div>';
        grouped[group].forEach(function (it) {
          html += '<div class="cmdk-item' + (globalIdx === 0 ? ' active' : '') + '" data-idx="' + globalIdx + '" data-href="' + it.href + '">' +
            '<div class="cmdk-item-icon">' + it.icon + '</div>' +
            '<span class="cmdk-item-label">' + it.label + '</span>' +
            '<span class="cmdk-item-hint">' + it.href + '</span>' +
            '</div>';
          globalIdx++;
        });
      });
      results.innerHTML = html;
      // Attach click handlers
      results.querySelectorAll('.cmdk-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var href = el.getAttribute('data-href');
          if (href) window.location.href = href;
        });
        el.addEventListener('mouseenter', function () {
          var idx = parseInt(el.getAttribute('data-idx'));
          setActive(idx);
        });
      });
    }

    function setActive(idx) {
      var els = results.querySelectorAll('.cmdk-item');
      els.forEach(function (el, i) {
        el.classList.toggle('active', i === idx);
      });
      selectedIndex = idx;
      // Scroll into view
      var active = results.querySelector('.cmdk-item.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    function open() {
      buildItems();
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      input.value = '';
      render('');
      setTimeout(function () { input.focus(); }, 50);
    }

    function close() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }

    function isOpen() {
      return overlay.classList.contains('open');
    }

    // Events
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      var els = results.querySelectorAll('.cmdk-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, els.length - 1);
        setActive(selectedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        setActive(selectedIndex);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var active = results.querySelector('.cmdk-item.active');
        if (active) {
          var href = active.getAttribute('data-href');
          if (href) window.location.href = href;
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    window.HRM_CommandPalette = { open: open, close: close, toggle: function () { isOpen() ? close() : open(); } };
  }

  /* ---------- Global keyboard shortcuts ---------- */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      var isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

      // Cmd/Ctrl+K — open command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.HRM_CommandPalette) window.HRM_CommandPalette.toggle();
        return;
      }

      // "g d" — go to dashboard (sequential shortcut)
      // Implementation omitted to keep things simple
    });
  }

  /* ---------- User menu dropdown ---------- */
  function initDropdowns() {
    const btn = document.getElementById('user-menu-btn');
    const menu = document.getElementById('user-menu-dropdown');
    if (!btn || !menu) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden');
    });
  }

  /* ---------- Generic modals (data-modal-open) ---------- */
  function initModals() {
    // Openers
    document.querySelectorAll('[data-modal-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-modal-open');
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('hidden');

        // Pre-fill form fields from data attributes (for edit modals)
        const title = btn.getAttribute('data-modal-title');
        if (title) {
          const titleEl = modal.querySelector('#' + id + '-title');
          if (titleEl) titleEl.textContent = title;
        }
        modal.querySelectorAll('[data-modal-fill]').forEach((el) => {});

        // Custom fill logic — only run the fill function matching the opened modal.
        const fillMap = {
          'dept-modal': fillDepartmentModal,
          'desig-modal': fillDesignationModal,
          'holiday-modal': fillHolidayModal,
          'leave-modal': fillLeaveCreateModal,
          'leave-edit-modal': fillLeaveEditModal,
          'review-modal': fillLeaveReviewModal,
          'loan-modal': fillLoanCreateModal,
          'loan-payment-modal': fillLoanPaymentModal,
          'loan-edit-modal': fillLoanEditModal,
          'period-edit-modal': fillPeriodEditModal,
          'adjust-modal': fillAdjustModal,
        };
        const fillFn = fillMap[id];
        if (fillFn) {
          try { fillFn(modal, btn); } catch (e) { console.error('Modal fill error:', e); }
        }
      });
    });

    // Closers
    document.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', () => {
        const modal = el.closest('.fixed.inset-0');
        if (modal) modal.classList.add('hidden');
      });
    });
  }

  function fillDepartmentModal(modal, btn) {
    const id = btn.getAttribute('data-modal-id');
    if (!id) return;
    modal.querySelector('#dept-form').action = '/departments/' + id + '?_method=PUT';
    modal.querySelector('#dept-method').value = 'PUT';
    modal.querySelector('#dept-id').value = id;
    modal.querySelector('#dept-name').value = btn.getAttribute('data-modal-name') || '';
    modal.querySelector('#dept-code').value = btn.getAttribute('data-modal-code') || '';
    modal.querySelector('#dept-description').value = btn.getAttribute('data-modal-description') || '';
    modal.querySelector('#dept-status').value = btn.getAttribute('data-modal-status') || 'active';
  }

  function fillDesignationModal(modal, btn) {
    const id = btn.getAttribute('data-modal-id');
    if (!id) return;
    modal.querySelector('#desig-form').action = '/designations/' + id + '?_method=PUT';
    modal.querySelector('#desig-method').value = 'PUT';
    modal.querySelector('#desig-id').value = id;
    modal.querySelector('#desig-name').value = btn.getAttribute('data-modal-name') || '';
    modal.querySelector('#desig-department').value = btn.getAttribute('data-modal-department') || '';
    modal.querySelector('#desig-description').value = btn.getAttribute('data-modal-description') || '';
    modal.querySelector('#desig-status').value = btn.getAttribute('data-modal-status') || 'active';
  }

  function fillHolidayModal(modal, btn) {
    const id = btn.getAttribute('data-modal-id');
    if (!id) return;
    modal.querySelector('#holiday-form').action = '/holidays/' + id + '?_method=PUT';
    modal.querySelector('#holiday-method').value = 'PUT';
    modal.querySelector('#holiday-id').value = id;
    modal.querySelector('#holiday-name').value = btn.getAttribute('data-modal-name') || '';
    modal.querySelector('#holiday-date').value = btn.getAttribute('data-modal-date') || '';
    modal.querySelector('#holiday-type').value = btn.getAttribute('data-modal-type') || 'national';
    modal.querySelector('#holiday-recurring').checked = btn.getAttribute('data-modal-recurring') === 'true';
    modal.querySelector('#holiday-description').value = btn.getAttribute('data-modal-description') || '';
  }

  function fillLoanCreateModal(modal, btn) {
    const form = modal.querySelector('form');
    if (!form) return;
    form.reset();
  }

  function fillLeaveCreateModal(modal, btn) {
    const form = modal.querySelector('form');
    if (!form) return;
    form.reset();
    if (typeof user !== 'undefined' && user && user.employee) {
      var empId = String(user.employee._id || user.employee);
      var select = form.querySelector('select[name="employee"]');
      if (select) {
        Array.from(select.options).forEach(function(opt) {
          if (String(opt.value) === empId) opt.selected = true;
        });
      }
    }
  }

  function fillLeaveEditModal(modal, btn) {
    var id = btn.getAttribute('data-modal-id');
    if (!id) return;
    var form = modal.querySelector('#leave-edit-form');
    if (!form) return;
    form.action = '/leave/' + id + '?_method=PUT';
    var setVal = function(sel, val) { var el = modal.querySelector(sel); if (el) el.value = val || ''; };
    setVal('#leave-edit-employee', btn.getAttribute('data-modal-employee'));
    setVal('#leave-edit-leavetype', btn.getAttribute('data-modal-leavetype'));
    setVal('#leave-edit-from', btn.getAttribute('data-modal-from'));
    setVal('#leave-edit-to', btn.getAttribute('data-modal-to'));
    setVal('#leave-edit-reason', btn.getAttribute('data-modal-reason'));
    setVal('#leave-edit-status', btn.getAttribute('data-modal-status'));
  }

  function fillLeaveReviewModal(modal, btn) {
    const id = btn.getAttribute('data-modal-id');
    const action = btn.getAttribute('data-modal-action');
    const form = modal.querySelector('#review-form');
    form.action = '/leave/' + id + '/review';
    modal.querySelector('#review-status').value = action;
    modal.querySelector('#review-modal-title').textContent = action === 'approved' ? 'Approve Leave' : 'Reject Leave';
  }

  function fillLoanPaymentModal(modal, btn) {
    const id = btn.getAttribute('data-modal-id');
    const form = modal.querySelector('#payment-form');
    if (!form || !id) return;
    form.action = '/payroll/loans/' + id + '/payment';
  }

  function fillLoanEditModal(modal, btn) {
    const id = btn.getAttribute('data-modal-id');
    if (!id) return;
    const form = modal.querySelector('#loan-edit-form');
    if (!form) return;
    form.action = '/payroll/loans/' + id + '?_method=PUT';
    modal.querySelector('#loan-edit-employee').value = btn.getAttribute('data-modal-employee') || '';
    modal.querySelector('#loan-edit-employee-name').value = btn.getAttribute('data-modal-employee-name') || '';
    modal.querySelector('#loan-edit-type').value = btn.getAttribute('data-modal-type') || 'loan';
    modal.querySelector('#loan-edit-principal').value = btn.getAttribute('data-modal-principal') || '';
    modal.querySelector('#loan-edit-installment').value = btn.getAttribute('data-modal-installment') || '';
    modal.querySelector('#loan-edit-description').value = btn.getAttribute('data-modal-description') || '';
    modal.querySelector('#loan-edit-status').value = btn.getAttribute('data-modal-status') || 'active';
  }

  function fillPeriodEditModal(modal, btn) {
    const id = btn.getAttribute('data-modal-id');
    if (!id) return;
    const form = modal.querySelector('#period-edit-form');
    if (!form) return;
    form.action = '/payroll/periods/' + id + '?_method=PUT';
    modal.querySelector('#period-edit-name').value = btn.getAttribute('data-modal-name') || '';
    modal.querySelector('#period-edit-month').value = btn.getAttribute('data-modal-month') || '';
    modal.querySelector('#period-edit-year').value = btn.getAttribute('data-modal-year') || '';
    modal.querySelector('#period-edit-start-date').value = btn.getAttribute('data-modal-start-date') || '';
    modal.querySelector('#period-edit-end-date').value = btn.getAttribute('data-modal-end-date') || '';
    modal.querySelector('#period-edit-payment-date').value = btn.getAttribute('data-modal-payment-date') || '';
    modal.querySelector('#period-edit-notes').value = btn.getAttribute('data-modal-notes') || '';
  }

  function fillAdjustModal(modal, btn) {
    // Adjust modal fields are already pre-filled server-side
  }

  /* ---------- Confirm dialogs ---------- */
  function initConfirmDialogs() {
    document.querySelectorAll('[data-confirm]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const message = btn.getAttribute('data-confirm');
        const action = btn.getAttribute('data-confirm-action');
        const method = btn.getAttribute('data-confirm-method') || 'POST';
        if (!action) return;
        if (!confirm(message)) return;
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = action;
        form.style.display = 'none';
        if (method !== 'POST') {
          const m = document.createElement('input');
          m.type = 'hidden';
          m.name = '_method';
          m.value = method;
          form.appendChild(m);
        }
        document.body.appendChild(form);
        form.submit();
      });
    });
  }

  /* ---------- Flash auto-dismiss ---------- */
  function initFlashDismiss() {
    document.querySelectorAll('#flash-container .alert-close').forEach((btn) => {
      btn.addEventListener('click', () => btn.closest('.p-3').remove());
    });
    // Auto-dismiss after 5s
    setTimeout(() => {
      document.querySelectorAll('#flash-container > div').forEach((el) => {
        el.style.transition = 'opacity .5s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
      });
    }, 5000);
  }

  /* ---------- Global search autocomplete ---------- */
  function initSearch() {
    const input = document.getElementById('global-search');
    const results = document.getElementById('search-results');
    if (!input || !results) return;
    let timer = null;

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) {
        results.classList.add('hidden');
        return;
      }
      timer = setTimeout(async () => {
        try {
          const res = await fetch('/employees/search?q=' + encodeURIComponent(q));
          const data = await res.json();
          renderResults(data.results || []);
        } catch (e) {
          results.classList.add('hidden');
        }
      }, 250);
    });

    function renderResults(items) {
      if (!items.length) {
        results.innerHTML = '<div class="p-3 text-sm text-slate-400">No employees found.</div>';
      } else {
        results.innerHTML = items.map((e) => (
          '<a href="/employees/' + e._id + '" class="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800">' +
          '<div class="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-semibold uppercase">' + (e.firstName[0] + e.lastName[0]) + '</div>' +
          '<div><div class="text-sm font-medium">' + e.firstName + ' ' + e.lastName + '</div><div class="text-xs text-slate-500">' + e.employeeId + ' · ' + e.email + '</div></div>' +
          '</a>'
        )).join('');
      }
      results.classList.remove('hidden');
    }

    document.addEventListener('click', (e) => {
      if (!results.contains(e.target) && e.target !== input) results.classList.add('hidden');
    });
  }

  /* ---------- Password visibility toggle ---------- */
  function initPasswordToggle() {
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.getAttribute('data-toggle-password'));
        if (!target) return;
        const isPw = target.type === 'password';
        target.type = isPw ? 'text' : 'password';
        btn.innerHTML = isPw ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      });
    });
  }

  /* ---------- Dynamic component rows (salary structure form) ---------- */
  function initDynamicRows() {
    document.querySelectorAll('[data-add-row]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.getAttribute('data-add-row');
        const container = document.getElementById(group + '-container');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'flex gap-2';
        row.innerHTML =
          '<input name="' + group + '_name" class="input flex-1" placeholder="Name" />' +
          '<input name="' + group + '_amount" type="number" step="0.01" class="input w-32" placeholder="Amount" />' +
          '<button type="button" class="btn-icon btn-ghost text-rose-600" data-remove-row><i class="fa-solid fa-xmark"></i></button>';
        container.appendChild(row);
      });
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-row]');
      if (btn) btn.closest('.flex.gap-2').remove();
    });
  }

  /* ---------- Table select-all ---------- */
  function initTableCheckAll() {
    const checkAll = document.querySelector('[data-check-all]');
    if (!checkAll) return;
    checkAll.addEventListener('change', () => {
      document.querySelectorAll('[data-check-item]').forEach((cb) => {
        cb.checked = checkAll.checked;
      });
    });
  }
})();
