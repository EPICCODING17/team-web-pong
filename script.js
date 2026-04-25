const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

let currentPage = localStorage.getItem("savedPage") || "dashboard"; 
let isMobile = window.innerWidth < 1024;

const mainContent = qs("#mainContent");
const navbar = qs("#navbar");
const menuToggle = qs("#menuToggle");

const notif_storage_key = 'notifCenterLog';
const notif_max = 50;

const notifCenter = {
  items: [],
  _idCounter: 0,

  _load() {
    try {
      const raw = localStorage.getItem(notif_storage_key);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.items = parsed.map(n => ({ ...n, time: new Date(n.time) }));
        this._idCounter = this.items.reduce((max, n) => Math.max(max, n.id || 0), 0);
        this.items.forEach(n => {
          if (n.type === 'loading') {
            n.type = 'error';
            n.message = n.message.replace('กำลัง', 'หมดเวลา:') || 'หมดเวลาการดำเนินการ';
          }
        });
        this._save();
      }
    } catch(e) {}
  },

  _save() {
    try {
      localStorage.setItem(notif_storage_key, JSON.stringify(this.items));
    } catch(e) {}
  },

  _trim() {
    if (this.items.length > notif_max) {
      this.items = this.items.slice(0, notif_max);
    }
  },

  add(message, type = 'loading') {
    const id = ++this._idCounter;
    this.items.unshift({ id, message, type, time: new Date() });
    this._trim();
    this._save();
    this.render();
    this._animateBell();
    playNotifySound();
    return id;
  },

  update(id, message, type = 'success') {
    const item = this.items.find(n => n.id === id);
    if (item) {
      item.message = message;
      item.type = type;
      item.time = new Date();
      this._save();
      this.render();
      if (type === 'success' || type === 'error') {
        this._animateBell();
        playNotifySound();
      }
    }
  },

  clear() {
    this.items = [];
    this._save();
    this.render();
  },

  _animateBell() {
    const icon = qs('#notifBellIcon');
    if (!icon) return;
    icon.classList.remove('bell-shake');
    void icon.offsetWidth;
    icon.classList.add('bell-shake');
  },

  _formatTime(d) {
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 5) return 'เมื่อสักครู่';
    if (diff < 60) return `${diff} วินาทีที่แล้ว`;
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  },

_iconHTML(type) {
    if (type === 'loading') return `<div class="notif-icon loading"><i class='bx bx-loader-alt'></i></div>`;
    if (type === 'success') return `<div class="notif-icon success"><i class='bx bx-check'></i></div>`;
    if (type === 'info') return `<div class="notif-icon info" style="color: var(--brand-blue);"><i class='bx bx-info-circle'></i></div>`;
    return `<div class="notif-icon error"><i class='bx bx-x'></i></div>`;
  },

  render() {
    const list = qs('#notifList');
    const badge = qs('#notifBadge');
    const empty = qs('#notifEmpty');
    const clearBtn = qs('#notifClearAllBtn');
    const spinnerRing = qs('#bellSpinnerRing');
    const bellBtn = qs('#notifBellBtn');
    if (!list) return;

    const loadingCount = this.items.filter(n => n.type === 'loading').length;
    const totalCount = this.items.length;

    if (spinnerRing) {
      spinnerRing.classList.toggle('active', loadingCount > 0);
    }
    if (bellBtn) {
      bellBtn.classList.toggle('bell-loading', loadingCount > 0);
    }

    if (badge) {
      badge.textContent = totalCount;
      badge.classList.toggle('visible', totalCount > 0 && loadingCount === 0);
    }

    if (clearBtn) {
      clearBtn.classList.toggle('hidden', totalCount === 0);
    }

    if (totalCount === 0) {
      list.innerHTML = `<div id="notifEmpty" class="notif-empty"><i class='bx bx-bell-off'></i>ไม่มีการแจ้งเตือน</div>`;
      return;
    }

    list.innerHTML = this.items.map(n => `
      <div class="notif-item" data-notif-id="${n.id}">
        ${this._iconHTML(n.type)}
        <div class="flex-1 min-w-0">
          <div class="notif-msg">${n.message}</div>
          <div class="notif-time">${this._formatTime(n.time)}</div>
        </div>
      </div>
    `).join('');
  }
};

const notifyOperation = async (startMsg, doneMsg, asyncFn, errorMsg) => {
  const id = notifCenter.add(startMsg, 'loading');
  try {
    await asyncFn();
    notifCenter.update(id, doneMsg || 'ดำเนินการเสร็จสิ้น', 'success');
  } catch(e) {
    notifCenter.update(id, errorMsg || 'เกิดข้อผิดพลาด', 'error');
  }
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const demoSave = () => {
  notifyOperation('กำลังบันทึกข้อมูล...', 'บันทึกข้อมูลสำเร็จ', () => wait(2000));
};
const demoDelete = () => {
  notifyOperation('กำลังลบข้อมูล...', 'ลบข้อมูลสำเร็จ', () => wait(1500));
};
const demoUpdate = () => {
  notifyOperation('กำลังอัพเดทข้อมูล...', 'อัพเดทข้อมูลสำเร็จ', () => wait(2500));
};
const demoError = () => {
  notifyOperation('กำลังดำเนินการ...', null, () => wait(1500).then(() => { throw new Error('fail'); }), 'เกิดข้อผิดพลาดในการดำเนินการ');
};

setInterval(() => { if (notifCenter.items.length) notifCenter.render(); }, 15000);

const initDropdowns = () => {
  const settingsBtn = qs('#settingsDropdownBtn');
  const settingsMenu = qs('#settingsDropdownMenu');
  
  const profileBtn = qs('#profileDropdownBtn');
  const profileMenu = qs('#profileDropdownMenu');

  const notifBtn = qs('#notifBellBtn');
  const notifMenu = qs('#notifDropdownMenu');
  const notifClearBtn = qs('#notifClearAllBtn');

  const allMenus = [settingsMenu, profileMenu, notifMenu].filter(Boolean);

  const toggleMenu = (menu, ...others) => {
    menu.classList.toggle('show');
    others.forEach(m => { if (m && m.classList.contains('show')) m.classList.remove('show'); });
  };

  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu(notifMenu, settingsMenu, profileMenu);
    });
  }

  if (notifClearBtn) {
    notifClearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifCenter.clear();
    });
  }

  if(settingsBtn && settingsMenu) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(settingsMenu, profileMenu, notifMenu);
      });
  }
  
  if(profileBtn && profileMenu) {
      profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(profileMenu, settingsMenu, notifMenu);
      });
  }

  document.addEventListener('click', (e) => {
      allMenus.forEach(menu => {
        const btn = menu === settingsMenu ? settingsBtn : menu === profileMenu ? profileBtn : notifBtn;
        if (menu && !menu.contains(e.target) && btn && !btn.contains(e.target)) {
          menu.classList.remove('show');
        }
      });
  });
};

const initDarkMode = () => {
  const saved = localStorage.getItem("darkMode");
  if (
    saved === "true" ||
    (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
  
  const toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "darkMode",
      document.documentElement.classList.contains("dark")
    );
  };

  const darkToggleBtns = qsa(".dark-toggle-btn");
  
  darkToggleBtns.forEach(btn => {
    btn.addEventListener("click", toggleDarkMode);
  });
};

let notifyEnabled = localStorage.getItem('notifyEnabled') !== 'false';
let soundEnabled = localStorage.getItem('soundEnabled') !== 'false';

const playNotifySound = () => {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch(e) {}
};

const showToast = (msg, force = false, type = 'success') => {
  if (!notifyEnabled && !force) return;
  
  notifCenter.add(msg, type);

  const toast = qs("#toast");
  if (!toast) return;
  
  const icon = toast.querySelector('i');
  qs("#toastMsg").textContent = msg;
  
  if(type === 'success') {
      icon.className = "bx bx-check-circle text-brand-green text-xl";
  } else if (type === 'error') {
      icon.className = "bx bx-x-circle text-brand-red text-xl";
  } else if (type === 'info') {
      icon.className = "bx bx-info-circle text-brand-blue text-xl";
  }

  toast.classList.add("toast-visible");
  
  setTimeout(() => toast.classList.remove("toast-visible"), 2000);
};

const updateToggleUI = () => {
  const nBtn = qs('#notifyToggleBtn');
  const nKnob = qs('#notifyToggleKnob');
  const sBtn = qs('#soundToggleBtn');
  const sKnob = qs('#soundToggleKnob');
  const sIcon = qs('#soundIcon');
  
  if (nBtn) {
    nBtn.className = `w-11 h-6 rounded-full ${notifyEnabled ? 'bg-brand-green' : 'bg-gray-300 dark:bg-gray-600'} relative transition-colors cursor-pointer`;
    nKnob.style.left = notifyEnabled ? '22px' : '2px';
  }
  if (sBtn) {
    sBtn.className = `w-11 h-6 rounded-full ${soundEnabled ? 'bg-brand-red' : 'bg-gray-300 dark:bg-gray-600'} relative transition-colors cursor-pointer`;
    sKnob.style.left = soundEnabled ? '22px' : '2px';
  }
  if (sIcon) {
    sIcon.className = `bx ${soundEnabled ? 'bx-volume-full' : 'bx-volume-mute'} text-lg text-brand-red`;
  }
};

const toggleNotify = () => {
  notifyEnabled = !notifyEnabled;
  localStorage.setItem('notifyEnabled', notifyEnabled);
  showToast(notifyEnabled ? 'เปิดการแจ้งเตือน' : 'ปิดการแจ้งเตือน', true, notifyEnabled ? 'success' : 'error');
  updateToggleUI();
};

const toggleSound = () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('soundEnabled', soundEnabled);
  if(soundEnabled) {
    playNotifySound();
  }
  showToast(soundEnabled ? 'เปิดเสียงแจ้งเตือน' : 'ปิดเสียงแจ้งเตือน', true, soundEnabled ? 'success' : 'error');
  updateToggleUI();
};

const handleResize = () => {
  isMobile = window.innerWidth < 1024;
};

const navigateTo = (page) => {
  if (page === currentPage) return;

  setTimeout(() => {
    const newBtn = qs(`[data-page="${page}"]`);
    if (newBtn && !newBtn.closest('.submenu')) {
        qsa('.menu-btn.open').forEach(openBtn => {
          openBtn.classList.remove('open');
          const otherSubmenu = openBtn.parentElement.querySelector('.submenu');
          if (otherSubmenu) {
            otherSubmenu.classList.remove('open');
            otherSubmenu.style.maxHeight = '';
            otherSubmenu.style.opacity = '';
            otherSubmenu.style.marginTop = '';
          }
        });
    }
  }, 50);

  const allMenuItems = Array.from(qsa('.menu-item, .submenu-btn')); 
  const oldIndex = allMenuItems.findIndex(el => 
    el.dataset.page === currentPage || el.getAttribute('onclick')?.includes(`'${currentPage}'`)
  );
  const newIndex = allMenuItems.findIndex(el => 
    el.dataset.page === page || el.getAttribute('onclick')?.includes(`'${page}'`)
  );

  const direction = newIndex >= oldIndex ? "up" : "down";
  const outClass = direction === "up" ? "anim-slide-out-up" : "anim-slide-out-down";
  const inClass = direction === "up" ? "anim-slide-in-up" : "anim-slide-in-down";

  const oldPage = qs(`#page-${currentPage}`);
  const newPage = qs(`#page-${page}`);

  qsa(".menu-item").forEach((item) => {
    if (item.dataset.page === page) {
      item.classList.add("active-card");
    } else {
      item.classList.remove("active-card");
    }
  });

  currentPage = page;
  localStorage.setItem("savedPage", currentPage);

  if (oldPage && oldPage !== newPage) {
    oldPage.classList.add(outClass);
    setTimeout(() => {
      oldPage.style.display = "none";
      oldPage.classList.remove(outClass);
      if (newPage) {
        newPage.style.display = "block";
        newPage.classList.add(inClass);
        setTimeout(() => newPage.classList.remove(inClass), 300);
      }
    }, 200);
  } else if (newPage) {
    qsa(".page-section").forEach((s) => (s.style.display = "none"));
    newPage.style.display = "block";
    newPage.classList.add("anim-slide-in-up");
    setTimeout(() => newPage.classList.remove("anim-slide-in-up"), 300);
  }

  const sheet = getActiveSheet();
  if (sheet && sheet.id === 'menuSheet') closeSheet();
};

const filterMenuCards = () => {
  const query = qs("#menuSearchInput").value.toLowerCase().trim();
  const groups = qsa(".menu-category-group");

  groups.forEach(group => {
    let hasVisibleCard = false;
    const cards = group.querySelectorAll(".menu-card");

    cards.forEach(card => {
      const label = card.querySelector(".menu-card-label").innerText.toLowerCase();
      
      if (label.includes(query)) {
        card.style.display = '';
        if (window.getComputedStyle(card).display !== 'none') {
          hasVisibleCard = true;
        }
      } else {
        card.style.display = 'none';
      }
    });

    if (hasVisibleCard) {
      group.style.display = '';
    } else {
      group.style.display = 'none';
    }
  });
};

const init = () => {
  initDarkMode();
  initDropdowns();
  notifCenter._load();
  notifCenter.render();
  updateToggleUI();
  handleResize();

  qsa(".menu-item").forEach((item) => {
    if (item.dataset.page === currentPage) {
      item.classList.add("active-card");
    } else {
      item.classList.remove("active-card");
    }
  });

  qsa(".page-section").forEach((s) => (s.style.display = "none"));
  const activePage = qs(`#page-${currentPage}`);
  if (activePage) {
    activePage.style.display = "block";
  }

  menuToggle?.addEventListener("click", () => {
    openSheet('menuSheet');
  });
  window.addEventListener("resize", handleResize);
};

document.addEventListener('DOMContentLoaded', function() {
  if (typeof init === 'function') init();
});

const sheetOverlay = qs('#globalSheetOverlay');
let sheetStack = [];
let sheetState = 'closed';
let sheetDragging = false;
let sheetStartY = 0;
let sheetStartHeight = 0;
let sheetPointerMoved = false;

const HALF_VH = 55;
const FULL_VH = 95;
const vhToPx = (vh) => window.innerHeight * vh / 100;

const getActiveSheet = () => sheetStack[sheetStack.length - 1] || null;

const openSheet = (sheetId) => {
  const sheetToOpen = qs(`#${sheetId}`);
  if (!sheetToOpen) return;

  if (sheetId === 'profileSheet') changeProfileForm();

  if (sheetStack.includes(sheetToOpen)) return;

  sheetStack.push(sheetToOpen);

  sheetOverlay.classList.add('active');
  sheetToOpen.style.height = '';
  sheetToOpen.classList.remove('sheet-full');
  sheetToOpen.classList.add('sheet-half');
  sheetState = 'half';
};

const closeSheet = () => {
  const sheet = getActiveSheet();
  if (!sheet) return;

  const forms = sheet.querySelectorAll('form');
  forms.forEach(form => form.reset());

  sheet.style.transition = '';
  sheet.style.height = '';
  sheet.classList.remove('sheet-half', 'sheet-full');

  sheetStack.pop();

  if (sheetStack.length === 0) {
    sheetOverlay.classList.remove('active');
    sheetState = 'closed';
  } else {
    sheetState = 'half';
  }
};

const closeAllSheets = () => {
  while (sheetStack.length > 0) {
    const sheet = sheetStack.pop();
    sheet.style.transition = '';
    sheet.style.height = '';
    sheet.classList.remove('sheet-half', 'sheet-full');
  }
  sheetOverlay.classList.remove('active');
  sheetState = 'closed';
};

const switchSheet = (newSheetId, prevSheetId) => {
  if (prevSheetId) {
    const prevSheet = document.getElementById(prevSheetId);
    if (prevSheet) {
      prevSheet.classList.remove('sheet-half', 'sheet-full');
      prevSheet.style.height = '';
    }
  }
  openSheet(newSheetId);
};

const switchBackSheet = (currentSheetId, prevSheetId) => {
  const current = document.getElementById(currentSheetId);
  if (current) {
    current.classList.remove('sheet-half', 'sheet-full');
    current.style.height = '';
    const idx = sheetStack.indexOf(current);
    if (idx !== -1) sheetStack.splice(idx, 1);
  }
  const prev = document.getElementById(prevSheetId);
  if (prev) {
    if (!sheetStack.includes(prev)) sheetStack.push(prev);
    prev.style.height = '';
    prev.classList.remove('sheet-full');
    prev.classList.add('sheet-half');
    sheetState = 'half';
  }
};

const setSheetHalf = () => {
  const sheet = getActiveSheet();
  if (!sheet) return;
  sheet.style.transition = '';
  sheet.style.height = '';
  sheet.classList.remove('sheet-full');
  sheet.classList.add('sheet-half');
  sheetState = 'half';
};

const setSheetFull = () => {
  const sheet = getActiveSheet();
  if (!sheet) return;
  sheet.style.transition = '';
  sheet.style.height = '';
  sheet.classList.remove('sheet-half');
  sheet.classList.add('sheet-full');
  sheetState = 'full';
};

const isScrollable = (el) => {
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (canScroll && el.scrollHeight > el.clientHeight) return true;
    el = el.parentElement;
  }
  return false;
};

const onDragStart = (e) => {
  const sheet = getActiveSheet();
  if (!sheet) return;

  sheetDragging = true;
  sheetPointerMoved = false;
  sheetStartY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  sheetStartHeight = sheet.offsetHeight;
  sheet.style.transition = 'none';
};

const onDragMove = (e) => {
  const sheet = getActiveSheet();
  if (!sheetDragging || !sheet) return;

  sheetPointerMoved = true;

  const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
  const delta = clientY - sheetStartY;

  let newHeight = sheetStartHeight - delta;
  newHeight = Math.max(0, Math.min(vhToPx(FULL_VH), newHeight));

  sheet.classList.remove('sheet-half', 'sheet-full');
  sheet.style.height = newHeight + 'px';

  if (e.cancelable) e.preventDefault();
};

const onDragEnd = (e) => {
  const sheet = getActiveSheet();
  if (!sheetDragging || !sheet) return;

  sheetDragging = false;

  const clientY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;
  const delta = clientY - sheetStartY;
  sheet.style.transition = '';

  if (!sheetPointerMoved) return;

  if (sheetState === 'half') {
    if (delta < -60) setSheetFull();
    else if (delta > 80) closeSheet();
    else setSheetHalf();
  } else if (sheetState === 'full') {
    if (delta > 80) setSheetHalf();
    else setSheetFull();
  }
};

document.addEventListener('mousedown', (e) => {
  const sheet = getActiveSheet();
  if (!sheet) return;

  if (e.target.closest('.drag-handle')) {
    onDragStart(e);
    return;
  }

  if (
    sheet.contains(e.target) &&
    !e.target.closest('input, textarea, select, button, a, canvas, [contenteditable], .no-drag')
  ) {
    onDragStart(e);
  }
});

document.addEventListener('touchstart', (e) => {
  const sheet = getActiveSheet();
  if (!sheet) return;

  if (e.target.closest('.drag-handle')) {
    onDragStart(e);
    return;
  }

  if (isScrollable(e.target)) return;

  if (
    sheet.contains(e.target) &&
    !e.target.closest('input, textarea, select, button, a, canvas, [contenteditable], .no-drag')
  ) {
    onDragStart(e);
  }
}, { passive: true });

document.addEventListener('mousemove', (e) => {
  if (sheetDragging) onDragMove(e);
});

document.addEventListener('touchmove', (e) => {
  if (sheetDragging) onDragMove(e);
}, { passive: false });

document.addEventListener('mouseup', onDragEnd);
document.addEventListener('touchend', onDragEnd);

sheetOverlay.addEventListener('click', () => closeSheet());
