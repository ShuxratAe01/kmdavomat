/**
 * Qidiruvli maktab tanlash.
 * Raqam (12) yoki nom yozilsa — ro‘yxat darhol filtrlanadi.
 *
 * mountSchoolPicker(rootEl, {
 *   schools: [{ id, number, name, login, registered }],
 *   valueKey: 'login' | 'id',
 *   placeholder: '...',
 *   initialValue: optional,
 *   onChange(school | null),
 * })
 * → { getValue(), getSchool(), setValue(v), focus(), destroy() }
 */
function mountSchoolPicker(root, opts = {}) {
  const schools = Array.isArray(opts.schools) ? opts.schools.slice() : [];
  const valueKey = opts.valueKey === 'id' ? 'id' : 'login';
  const placeholder = opts.placeholder || 'Raqam yoki nom yozing… masalan: 12';
  const emptyText = opts.emptyText || 'Maktab topilmadi';
  const onChange = typeof opts.onChange === 'function' ? opts.onChange : () => {};

  root.classList.add('school-picker');
  const inputId = opts.inputId || 'schoolSearch';
  root.innerHTML = `
    <div class="input-wrap school-picker-wrap">
      <svg class="input-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 21h18M5 21V10l7-5 7 5v11" />
        <path d="M10 21v-5h4v5" />
      </svg>
      <input type="text" id="${escapeAttr(inputId)}" class="school-picker-input" role="combobox"
             aria-autocomplete="list" aria-expanded="false" aria-controls=""
             autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
             inputmode="search" placeholder="${escapeAttr(placeholder)}" />
      <button type="button" class="school-picker-clear" hidden aria-label="Tozalash">×</button>
      <span class="school-picker-chevron" aria-hidden="true"></span>
    </div>
    <ul class="school-picker-list" role="listbox" hidden></ul>
    <input type="hidden" class="school-picker-value" value="" />
  `;

  const input = root.querySelector('.school-picker-input');
  const list = root.querySelector('.school-picker-list');
  const hidden = root.querySelector('.school-picker-value');
  const clearBtn = root.querySelector('.school-picker-clear');
  const listId = `sp-list-${Math.random().toString(36).slice(2, 9)}`;
  list.id = listId;
  input.setAttribute('aria-controls', listId);

  let selected = null;
  let open = false;
  let activeIdx = -1;
  let filtered = schools.slice();

  function schoolValue(s) {
    return valueKey === 'id' ? String(s.id) : String(s.login);
  }

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ʻ|ʼ|'/g, '‘')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Raqam yozsa — avvalo aniq raqam, keyin ichida uchraganlar */
  function filterSchools(q) {
    const raw = String(q || '').trim();
    if (!raw) return schools.slice();
    const n = norm(raw);
    const digits = raw.replace(/\D/g, '');
    const exactNum = digits && String(Number(digits)) === digits ? Number(digits) : null;

    const scored = [];
    for (const s of schools) {
      const nameN = norm(s.name);
      const numStr = String(s.number);
      let score = 0;
      if (exactNum != null && s.number === exactNum) score = 100;
      else if (digits && numStr === digits) score = 90;
      else if (digits && numStr.startsWith(digits)) score = 70;
      else if (digits && numStr.includes(digits)) score = 40;
      else if (nameN.startsWith(n)) score = 60;
      else if (nameN.includes(n)) score = 30;
      else if (norm(s.login).includes(n)) score = 20;
      else continue;
      scored.push({ s, score });
    }
    scored.sort((a, b) => b.score - a.score || a.s.number - b.s.number);
    return scored.map((x) => x.s);
  }

  function renderList() {
    if (!filtered.length) {
      list.innerHTML = `<li class="school-picker-empty" role="presentation">${escapeHtml(emptyText)}</li>`;
      return;
    }
    list.innerHTML = filtered
      .map((s, i) => {
        const active = i === activeIdx ? ' is-active' : '';
        const sel = selected && schoolValue(selected) === schoolValue(s) ? ' is-selected' : '';
        const badge = s.registered ? '' : '<span class="sp-badge">yangi</span>';
        return `<li class="school-picker-option${active}${sel}" role="option"
                    data-idx="${i}" aria-selected="${sel ? 'true' : 'false'}">
          <span class="sp-num">${escapeHtml(String(s.number))}</span>
          <span class="sp-name">${escapeHtml(s.name)}</span>
          ${badge}
        </li>`;
      })
      .join('');
  }

  function refreshFilter() {
    // Tanlangan maktab nomi ko‘rsatilayotganda — to‘liq ro‘yxat
    if (selected && input.value === selected.name) filtered = schools.slice();
    else filtered = filterSchools(input.value);
    if (selected) {
      const i = filtered.findIndex((s) => schoolValue(s) === schoolValue(selected));
      activeIdx = i >= 0 ? i : filtered.length ? 0 : -1;
    } else {
      activeIdx = filtered.length ? 0 : -1;
    }
  }

  function setOpen(next) {
    open = next;
    list.hidden = !open;
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
    root.classList.toggle('is-open', open);
    if (open) {
      refreshFilter();
      renderList();
    }
  }

  function pick(school) {
    selected = school || null;
    hidden.value = selected ? schoolValue(selected) : '';
    input.value = selected ? selected.name : '';
    clearBtn.hidden = !selected;
    setOpen(false);
    onChange(selected);
  }

  function syncFromQuery() {
    // Yozayotganda eski tanlovni bekor qilamiz (yangi qidiruv)
    if (selected && input.value !== selected.name) {
      selected = null;
      hidden.value = '';
      clearBtn.hidden = true;
      onChange(null);
    }
    refreshFilter();
    renderList();
    if (!open) setOpen(true);
  }

  input.addEventListener('focus', () => setOpen(true));

  input.addEventListener('input', syncFromQuery);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      if (!filtered.length) return;
      activeIdx = (activeIdx + 1) % filtered.length;
      renderList();
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      if (!filtered.length) return;
      activeIdx = (activeIdx - 1 + filtered.length) % filtered.length;
      renderList();
      list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && filtered[activeIdx]) {
        e.preventDefault();
        pick(filtered[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  });

  list.addEventListener('mousedown', (e) => {
    // blur dan oldin tanlash uchun
    e.preventDefault();
    const li = e.target.closest('.school-picker-option');
    if (!li) return;
    const idx = Number(li.dataset.idx);
    if (filtered[idx]) pick(filtered[idx]);
  });

  clearBtn.addEventListener('click', () => {
    pick(null);
    input.focus();
    setOpen(true);
  });

  document.addEventListener('click', onDocClick);
  function onDocClick(e) {
    if (!root.contains(e.target)) setOpen(false);
  }

  if (opts.initialValue != null && opts.initialValue !== '') {
    const found = schools.find((s) => schoolValue(s) === String(opts.initialValue));
    if (found) pick(found);
  }

  return {
    getValue: () => hidden.value,
    getSchool: () => selected,
    setValue(v) {
      const found = schools.find((s) => schoolValue(s) === String(v));
      pick(found || null);
    },
    focus: () => input.focus(),
    destroy() {
      document.removeEventListener('click', onDocClick);
      root.innerHTML = '';
    },
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}
