/* global supabase */
const client = supabase.createClient('https://drdacuwizhrrfqxwkwiu.supabase.co', 'sb_publishable_kA7stlDHnVRNRE-kPjKaHg_1l6C1NPg');
const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const household = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78';

let transactions = [], goals = [], wallets = [], transfers = [];
let editing = null, pendingId = null, walletPendingId = null, transferPendingId = null, loading = false;

function notice(text) {
  $('#message').textContent = text;
  const dialog = document.querySelector('dialog[open] .dialogMessage');
  if (dialog) dialog.textContent = text;
}

let historyDate = today(), historyCalendarYear, historyCalendarMonth;

function page(name, resetDate = true) {
  if (name === 'history' && resetDate) {
    historyDate = today();
    updateHistoryDate();
    render();
  }
  for (const p of ['home', 'history', 'savings', 'wallets']) {
    const el = $('#' + p), active = p === name, wasHidden = el.hidden;
    el.hidden = !active;
    if (active && wasHidden) {
      el.classList.remove('page-enter');
      void el.offsetWidth;
      el.classList.add('page-enter');
    }
    document.querySelectorAll('nav [data-page]').forEach(b => b.toggleAttribute('aria-current', b.dataset.page === name));
  }
}

function renderHeaderAndWeek() {
  const now = new Date();
  const todayStr = today();
  const formattedToday = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }).format(now);
  const labelEl = $('#todayDateLabel');
  if (labelEl) labelEl.textContent = `${formattedToday} · Rumah tangga`;

  const strip = $('#weekStrip');
  if (!strip) return;
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const isToday = iso === todayStr;
    html += `<button type="button" class="week-day${isToday ? ' is-today' : ''}" data-week-date="${iso}" aria-label="Lihat transaksi ${dayNames[i]} ${d.getDate()}">
      <span class="week-day-name">${dayNames[i]}</span>
      <span class="week-day-num">${d.getDate()}</span>
    </button>`;
  }
  strip.innerHTML = html;
}

function totals(rows) {
  return rows.reduce((a, t) => {
    const n = Number(t.amount);
    if (t.kind === 'income') a.income += n;
    else if (t.kind === 'expense') a.expense += n;
    else if (t.kind === 'saving') a.saving += n;
    else if (t.kind === 'saving_withdrawal') a.withdrawal += n;
    return a;
  }, { income: 0, expense: 0, saving: 0, withdrawal: 0 });
}

function goalSaved(g) {
  return transactions
    .filter(t => t.goal_id === g.id)
    .reduce((n, t) => n + (t.kind === 'saving' ? Number(t.amount) : t.kind === 'saving_withdrawal' ? -Number(t.amount) : 0), 0);
}

function goalMarkup(g, home = false) {
  const saved = goalSaved(g), target = Number(g.target);
  const pct = target > 0 ? Math.round(saved / target * 100) : 0;
  const progress = Math.max(0, Math.min(100, pct));
  const iconSvg = `<span class="goal-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-.8-1.5-1.2-3-1.2-1.7 0-2.8.8-2.8 2s1.1 1.8 2.8 2.1 2.8.9 2.8 2.1-1.1 2-2.8 2c-1.5 0-2.5-.4-3-1.2M12 6.7v10.6"/></svg></span>`;

  if (home) {
    return `<div class="goal-card">
      <div class="goal-card-head">
        ${iconSvg}
        <div class="goal-detail">
          <strong>${esc(g.name)}</strong>
          <span>${money(saved)} / ${money(target)}</span>
        </div>
        <strong class="goal-percent">${pct}%</strong>
      </div>
      <div class="progress"><i style="width:${progress}%"></i></div>
    </div>`;
  }

  const remaining = Math.max(0, target - saved);
  return `<article class="savings-goal-card">
    <div class="savings-goal-head">
      ${iconSvg}
      <div class="savings-goal-title">
        <strong>${esc(g.name)}</strong>
        <span>Target ${money(target)}</span>
      </div>
      <strong class="savings-goal-percent">${pct}%</strong>
    </div>
    <div class="progress" role="progressbar" aria-label="Progres ${esc(g.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
      <i style="width:${progress}%"></i>
    </div>
    <div class="savings-goal-foot">
      <span>${money(saved)} terkumpul</span>
      <span>${remaining > 0 ? `Sisa ${money(remaining)}` : 'Target tercapai'}</span>
    </div>
  </article>`;
}

function kindIcon(kind) {
  if (kind === 'income') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
  }
  if (kind === 'expense') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  }
  if (kind === 'transfer') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function render() {
  const all = totals(transactions);
  const monthly = totals(transactions.filter(t => t.transaction_date.startsWith($('#month').value)));

  $('#balance').textContent = money(all.income - all.expense - all.saving + all.withdrawal);
  $('#income').textContent = money(monthly.income);
  $('#expense').textContent = money(monthly.expense);

  const savedTotal = goals.reduce((n, g) => n + goalSaved(g), 0);
  const targetTotal = goals.reduce((n, g) => n + Number(g.target), 0);
  const overallPct = targetTotal ? Math.round(savedTotal / targetTotal * 100) : 0;
  const overallProgress = Math.max(0, Math.min(100, overallPct));

  $('#savingsOverview').innerHTML = goals.length > 1
    ? `<div class="savings-overview-card">
        <div class="savings-overview-head">
          <div>
            <span>Total terkumpul</span>
            <strong>${money(savedTotal)}</strong>
          </div>
          <strong class="savings-overview-percent">${overallPct}%</strong>
        </div>
        <div class="progress" role="progressbar" aria-label="Progres seluruh tabungan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${overallProgress}">
          <i style="width:${overallProgress}%"></i>
        </div>
        <div class="savings-overview-foot">
          <span>${money(savedTotal)} dari ${money(targetTotal)}</span>
          <span>${goals.length} target</span>
        </div>
      </div>`
    : '';

  const cards = goals.map(g => goalMarkup(g)).join('') || '<p class="empty">Belum ada target tabungan.</p>';
  $('#goals').innerHTML = cards;
  $('#homeGoals').innerHTML = goals.length ? goalMarkup(goals[0], true) : '<p class="empty">Belum ada target tabungan.</p>';

  const entries = [
    ...transactions.map(t => {
      const kindLabel = t.kind === 'saving'
        ? 'Setoran tabungan'
        : t.kind === 'saving_withdrawal'
          ? 'Penarikan tabungan'
          : t.kind === 'income'
            ? 'Pemasukan'
            : 'Pengeluaran';
      const sign = t.kind === 'income' || t.kind === 'saving_withdrawal' ? '+' : '−';
      return {
        date: t.transaction_date,
        created: t.created_at || '',
        html: `<div class="row row--${esc(t.kind)}">
          <button type="button" data-id="${esc(t.id)}">
            <div class="row-main">
              <span class="row-badge" aria-hidden="true">${kindIcon(t.kind)}</span>
              <div class="row-body">
                <div class="rowhead">
                  <strong>${esc(t.category)}</strong>
                  <strong class="row-amount">${sign} ${money(Number(t.amount))}</strong>
                </div>
                <p>${esc(t.wallet)} · ${kindLabel}</p>
              </div>
            </div>
          </button>
        </div>`
      };
    }),
    ...transfers.map(t => ({
      date: t.transfer_date,
      created: t.created_at || '',
      html: `<div class="row row--transfer">
        <div class="row-main">
          <span class="row-badge" aria-hidden="true">${kindIcon('transfer')}</span>
          <div class="row-body">
            <div class="rowhead">
              <strong>Transfer dompet</strong>
              <strong class="row-amount">${money(Number(t.amount))}</strong>
            </div>
            <p>${esc(t.source_wallet)} → ${esc(t.destination_wallet)}</p>
          </div>
        </div>
      </div>`
    }))
  ];

  entries.sort((a, b) => b.date.localeCompare(a.date) || b.created.localeCompare(a.created));
  $('#transactions').innerHTML = entries.filter(e => e.date === historyDate).map(e => e.html).join('') || '<p class="empty">Tidak ada transaksi pada tanggal ini.</p>';
}

async function readAll(table, order, ascending) {
  let rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('household_id', household)
      .order(order, { ascending })
      .order('id', { ascending })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function allWallets() {
  const result = [...wallets];
  for (const t of transactions) {
    if (!result.some(w => w.name === t.wallet)) result.push({ name: t.wallet, kind: 'other' });
  }
  return result;
}

function walletBalance(name) {
  if (name.trim().toLowerCase() === 'tabungan') {
    const t = totals(transactions);
    return t.saving - t.withdrawal;
  }
  const t = totals(transactions.filter(t => t.wallet === name));
  return t.income - t.expense - t.saving + t.withdrawal + transfers.reduce(
    (sum, x) => sum + (x.destination_wallet === name ? Number(x.amount) : 0) - (x.source_wallet === name ? Number(x.amount) : 0),
    0
  );
}

function walletLogo(name) {
  const n = name.trim().toLowerCase();
  const brand = /\bocbc\b/.test(n) ? 'ocbc' : /\bbca\b/.test(n) ? 'bca' : /\b(?:shopee[\s-]*pay|spay)\b/.test(n) ? 'shopeepay' : null;
  return brand ? `<img class="wallet-logo" src="logos/${brand}.svg" alt="" loading="lazy">` : '';
}

function renderWallets() {
  const labels = { cash: 'Tunai', bank: 'Rekening bank', ewallet: 'E-wallet', other: 'Lainnya' };
  $('#walletList').innerHTML = allWallets().map(w =>
    `<div class="wallet-card">
      <div class="rowhead">
        <span class="wallet-identity">${walletLogo(w.name)}<strong>${esc(w.name)}</strong></span>
        <strong>${money(walletBalance(w.name))}</strong>
      </div>
      <p>${w.name === 'Tabungan' ? 'Tabungan' : labels[w.kind] || 'Lainnya'}</p>
    </div>`
  ).join('') || '<p class="empty">Belum ada dompet. Tambahkan dompet untuk mencatat transaksi.</p>';
}

$('#balanceButton').onclick = () => {
  const entries = allWallets().filter(w => w.name.trim().toLowerCase() !== 'tabungan');
  $('#balanceWalletList').innerHTML = entries.map(w =>
    `<div class="balance-wallet-row">
      <span class="wallet-identity">${walletLogo(w.name)}<span>${esc(w.name)}</span></span>
      <strong>${money(walletBalance(w.name))}</strong>
    </div>`
  ).join('') || '<p class="balance-empty">Belum ada dompet.</p>';
  $('#balanceDialog').showModal();
};

$('#balanceClose').onclick = () => $('#balanceDialog').close();

async function refresh() {
  if (!household || loading) return;
  loading = true;
  try {
    const [a, b, c, d] = await Promise.all([
      readAll('transactions', 'transaction_date', false),
      readAll('goals', 'created_at', true),
      readAll('wallets', 'created_at', true),
      readAll('wallet_transfers', 'transfer_date', false)
    ]);
    transactions = a;
    goals = b;
    wallets = c;
    transfers = d;
    render();
    renderWallets();
  } catch (e) {
    notice('Gagal memuat data. Periksa koneksi dan coba lagi.');
  } finally {
    loading = false;
  }
}

renderHeaderAndWeek();
$('#content').hidden = false;
notice('');
refresh();

$('#weekStrip')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-week-date]');
  if (!btn) return;
  historyDate = btn.dataset.weekDate;
  updateHistoryDate();
  render();
  page('history', false);
});

document.querySelectorAll('[data-page]').forEach(b => b.onclick = () => page(b.dataset.page));
$('#month').value = today().slice(0, 7);
$('#month').onchange = render;

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
let monthYear;

function updateMonthButton() {
  const [y, m] = $('#month').value.split('-');
  $('#monthButton').textContent = monthNames[Number(m) - 1] + ' ' + y;
}

function showMonths() {
  const selected = $('#month').value;
  $('#monthTitle').textContent = monthYear;
  $('#monthGrid').innerHTML = monthNames.map((name, i) => {
    const value = monthYear + '-' + String(i + 1).padStart(2, '0');
    return `<button type="button" data-month="${value}" aria-pressed="${value === selected}">${name.slice(0, 3)}</button>`;
  }).join('');
}

function updateHistoryDate() {
  const [y, m, d] = historyDate.split('-').map(Number);
  $('#historyDateLabel').textContent = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

function showHistoryCalendar() {
  const title = new Date(historyCalendarYear, historyCalendarMonth, 1);
  $('#historyCalendarTitle').textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(title);
  const offset = title.getDay(), count = new Date(historyCalendarYear, historyCalendarMonth + 1, 0).getDate();
  let html = '<span></span>'.repeat(offset);
  for (let day = 1; day <= count; day++) {
    const value = historyCalendarYear + '-' + String(historyCalendarMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    html += `<button type="button" data-date="${value}" aria-pressed="${value === historyDate}" aria-label="${day} ${monthNames[historyCalendarMonth]} ${historyCalendarYear}">${day}</button>`;
  }
  $('#historyCalendarGrid').innerHTML = html;
}

updateHistoryDate();

$('#historyDateButton').onclick = () => {
  const [y, m] = historyDate.split('-').map(Number);
  historyCalendarYear = y;
  historyCalendarMonth = m - 1;
  showHistoryCalendar();
  $('#historyDateDialog').showModal();
};

function changeHistoryMonth(delta) {
  const d = new Date(historyCalendarYear, historyCalendarMonth + delta, 1);
  historyCalendarYear = d.getFullYear();
  historyCalendarMonth = d.getMonth();
  showHistoryCalendar();
}

$('#historyPrevMonth').onclick = () => changeHistoryMonth(-1);
$('#historyNextMonth').onclick = () => changeHistoryMonth(1);

$('#historyCalendarGrid').onclick = e => {
  const b = e.target.closest('[data-date]');
  if (!b) return;
  historyDate = b.dataset.date;
  updateHistoryDate();
  render();
  $('#historyDateDialog').close();
};

$('#historyToday').onclick = () => {
  historyDate = today();
  updateHistoryDate();
  render();
  $('#historyDateDialog').close();
};

$('#historyDateClose').onclick = () => $('#historyDateDialog').close();

updateMonthButton();

$('#monthButton').onclick = () => {
  monthYear = Number($('#month').value.slice(0, 4));
  showMonths();
  $('#monthDialog').showModal();
};

$('#prevYear').onclick = () => { monthYear--; showMonths(); };
$('#nextYear').onclick = () => { monthYear++; showMonths(); };

$('#monthGrid').onclick = e => {
  const b = e.target.closest('[data-month]');
  if (!b) return;
  $('#month').value = b.dataset.month;
  updateMonthButton();
  render();
  $('#monthDialog').close();
};

$('#monthClose').onclick = () => $('#monthDialog').close();

function kindChanged() {
  const kind = $('#transactionForm').elements.kind.value;
  const saving = kind === 'saving' || kind === 'saving_withdrawal';
  $('#goalField').hidden = !saving;
  $('#transactionForm').elements.goal_id.required = saving;
  $('#walletLabel').textContent = kind === 'saving' ? 'Dompet asal' : kind === 'saving_withdrawal' ? 'Dompet tujuan' : 'Dompet';
}

function openTransaction(t = null, kind = 'expense') {
  editing = t;
  pendingId = t?.id || crypto.randomUUID();
  const f = $('#transactionForm');
  f.reset();
  f.elements.kind.value = kind;
  const choices = allWallets().filter(w => w.name.trim().toLowerCase() !== 'tabungan');
  f.elements.wallet.innerHTML = '<option value="">Pilih dompet</option>' + choices.map(w => `<option value="${esc(w.name)}">${esc(w.name)}</option>`).join('');
  $('#walletHint').hidden = choices.length > 0;
  f.elements.goal_id.innerHTML = '<option value="">Pilih target</option>' + goals.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  f.elements.transaction_date.value = today();
  if (kind === 'saving_withdrawal') f.elements.category.value = 'Penarikan tabungan';
  if (t) {
    for (const k of ['kind', 'amount', 'transaction_date', 'category', 'wallet', 'goal_id']) {
      f.elements[k].value = t[k] || '';
    }
  }
  $('#transactionTitle').textContent = t ? 'Ubah transaksi' : kind === 'saving_withdrawal' ? 'Tarik tabungan' : 'Catat transaksi';
  $('#deleteTransaction').hidden = !t;
  kindChanged();
  $('#transactionDialog').showModal();
}

async function openSavings(button) {
  button.disabled = true;
  const { error } = await client
    .from('wallets')
    .upsert({ id: crypto.randomUUID(), household_id: household, name: 'Tabungan', kind: 'other' }, { onConflict: 'household_id,name', ignoreDuplicates: true });
  button.disabled = false;
  if (error) {
    notice('Gagal menyiapkan dompet Tabungan. Coba lagi.');
    return;
  }
  await refresh();
  openTransaction(null, 'saving');
}

const fab = $('#fab'), fabMenu = $('#fabMenu');

function closeFab() {
  fabMenu.hidden = true;
  fab.setAttribute('aria-expanded', 'false');
}

fab.onclick = () => {
  const opening = fabMenu.hidden;
  fabMenu.hidden = !opening;
  fab.setAttribute('aria-expanded', String(opening));
};

document.addEventListener('click', e => {
  if (!e.target.closest('.fab-wrap')) closeFab();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !fabMenu.hidden) {
    closeFab();
    fab.focus();
  }
});

document.querySelectorAll('[data-new-kind]').forEach(b => b.onclick = () => {
  closeFab();
  return b.dataset.newKind === 'saving' ? openSavings(b) : openTransaction(null, b.dataset.newKind);
});

$('#withdrawSavings').onclick = () => openTransaction(null, 'saving_withdrawal');
$('#newHistory').onclick = () => openTransaction();

$('#transactions').onclick = e => {
  const b = e.target.closest('[data-id]');
  if (b) openTransaction(transactions.find(t => t.id === b.dataset.id));
};

$('#transactionForm').elements.kind.onchange = kindChanged;

document.querySelectorAll('.close').forEach(b => b.onclick = () => b.closest('dialog').close());

$('#transactionForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target;
  const kind = f.elements.kind.value;
  const savings = kind === 'saving' || kind === 'saving_withdrawal';
  if (savings && !f.elements.goal_id.value) {
    notice('Pilih target tabungan terlebih dahulu.');
    return;
  }
  const item = {
    id: pendingId,
    household_id: household,
    kind,
    amount: Number(f.elements.amount.value),
    transaction_date: f.elements.transaction_date.value,
    category: f.elements.category.value.trim(),
    wallet: f.elements.wallet.value.trim(),
    goal_id: savings ? f.elements.goal_id.value : null
  };
  if (!item.category || !item.wallet) {
    notice('Kategori dan dompet wajib diisi.');
    return;
  }
  const button = f.querySelector('button[type=submit],button:not([type])');
  button.disabled = true;
  const { error } = await client.from('transactions').upsert(item);
  button.disabled = false;
  if (error) {
    notice(error.message?.includes('insufficient_goal_savings') ? 'Saldo target tabungan tidak cukup.' : 'Gagal menyimpan. Isian tetap ada; coba lagi.');
    return;
  }
  $('#transactionDialog').close();
  notice('Transaksi tersimpan.');
  await refresh();
  page('home');
};

$('#deleteTransaction').onclick = async () => {
  if (!editing || !confirm('Hapus transaksi ini?')) return;
  const { error } = await client.from('transactions').delete().eq('id', editing.id).eq('household_id', household);
  if (error) {
    notice(error.message?.includes('insufficient_goal_savings') ? 'Setoran tidak dapat dihapus karena sebagian sudah ditarik.' : 'Gagal menghapus transaksi.');
    return;
  }
  $('#transactionDialog').close();
  notice('Transaksi dihapus.');
  await refresh();
};

$('#newGoal').onclick = () => {
  pendingId = crypto.randomUUID();
  $('#goalForm').reset();
  $('#goalDialog').showModal();
};

$('#goalForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target, name = f.elements.name.value.trim();
  if (!name) {
    notice('Nama target wajib diisi.');
    return;
  }
  const button = f.querySelector('button[type=submit],button:not([type])');
  button.disabled = true;
  const { error } = await client.from('goals').upsert({ id: pendingId, household_id: household, name, target: Number(f.elements.target.value) });
  button.disabled = false;
  if (error) {
    notice('Gagal menyimpan target. Isian tetap ada; coba lagi.');
    return;
  }
  $('#goalDialog').close();
  notice('Target tersimpan.');
  await refresh();
};

$('#newWallet').onclick = () => {
  walletPendingId = crypto.randomUUID();
  $('#walletForm').reset();
  $('#walletDialog .dialogMessage').textContent = '';
  $('#walletDialog').showModal();
};

$('#walletForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target, name = f.elements.name.value.trim();
  if (!name) {
    notice('Nama dompet wajib diisi.');
    return;
  }
  const button = f.querySelector('button[type=submit],button:not([type])');
  button.disabled = true;
  const { error } = await client.from('wallets').upsert({ id: walletPendingId, household_id: household, name, kind: f.elements.kind.value }, { onConflict: 'id', ignoreDuplicates: true });
  button.disabled = false;
  if (error) {
    notice(error.code === '23505' ? 'Nama dompet sudah ada.' : 'Gagal menyimpan dompet. Isian tetap ada; coba lagi.');
    return;
  }
  $('#walletDialog').close();
  notice('Dompet tersimpan.');
  await refresh();
};

$('#newTransfer').onclick = () => {
  const choices = wallets.filter(w => w.name.trim().toLowerCase() !== 'tabungan');
  if (choices.length < 2) {
    notice('Tambahkan minimal dua dompet biasa untuk transfer. Gunakan menu Tabungan untuk setoran atau penarikan.');
    return;
  }
  transferPendingId = crypto.randomUUID();
  const f = $('#transferForm');
  f.reset();
  const options = '<option value="">Pilih dompet</option>' + choices.map(w => `<option value="${esc(w.name)}">${esc(w.name)}</option>`).join('');
  f.elements.source_wallet.innerHTML = options;
  f.elements.destination_wallet.innerHTML = options;
  f.elements.transfer_date.value = today();
  $('#transferDialog .dialogMessage').textContent = '';
  $('#transferDialog').showModal();
};

$('#transferForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target, source = f.elements.source_wallet.value, destination = f.elements.destination_wallet.value;
  if (source === destination) {
    notice('Dompet asal dan tujuan harus berbeda.');
    return;
  }
  const item = {
    id: transferPendingId,
    household_id: household,
    source_wallet: source,
    destination_wallet: destination,
    amount: Number(f.elements.amount.value),
    transfer_date: f.elements.transfer_date.value
  };
  const button = f.querySelector('button[type=submit],button:not([type])');
  button.disabled = true;
  const { error } = await client.from('wallet_transfers').upsert(item, { onConflict: 'id', ignoreDuplicates: true });
  button.disabled = false;
  if (error) {
    notice(error.message?.includes('insufficient_wallet_balance') ? 'Saldo dompet asal tidak cukup.' : 'Gagal menyimpan transfer. Periksa isian dan coba lagi.');
    return;
  }
  $('#transferDialog').close();
  notice('Transfer tersimpan.');
  await refresh();
};

setInterval(() => { if (!document.hidden) refresh(); }, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
