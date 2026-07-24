import React, { useState, useEffect } from 'react';
import { ref, onValue, get, set, push, remove } from 'firebase/database';
import { database } from '../firebaseConfig';
import { useAuth } from '../contexts/useAuth';
import { useSidebar } from '../contexts/SidebarContext';
import { Plus, Check, Undo2, RotateCcw, Trash2, X, Menu } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const StaffInventory = () => {
  const { currentUser } = useAuth();
  const { toggle } = useSidebar();
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({});
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exactSearch, setExactSearch] = useState(false);
  const [reportForYesterday, setReportForYesterday] = useState(false);

  useEffect(() => {
    const unsub = onValue(ref(database, 'items'), snap => {
      if (snap.exists()) {
        setItems(Object.entries(snap.val()).map(([id, v]) => ({ id, ...v })));
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    get(ref(database, `reports_draft/${currentUser.uid}`)).then(snap => {
      if (snap.exists()) setDraft(snap.val());
    });
  }, [currentUser]);

  // Persist draft to DB whenever it changes
  const saveDraft = (newDraft) => {
    setDraft(newDraft);
    if (currentUser) {
      set(ref(database, `reports_draft/${currentUser.uid}`), newDraft);
    }
  };

  const handleAdd = (itemId, inputVal) => {
    const num = parseFloat(inputVal);
    if (isNaN(num) || num < 0) return false;
    const prev = draft[itemId] || { accumulated: 0, log: [] };
    const newAcc = prev.accumulated + num;
    const newLog = [...(prev.log || []), num];
    saveDraft({ ...draft, [itemId]: { accumulated: newAcc, log: newLog, registered: false } });
    return true;
  };

  const handleRegister = (itemId, inputVal) => {
    const prev = draft[itemId] || { accumulated: 0, log: [] };
    let next = { ...prev };
    if (inputVal !== undefined && inputVal !== '') {
      const num = parseFloat(inputVal);
      if (!isNaN(num) && num >= 0) {
        next.accumulated += num;
        next.log = [...(next.log || []), num];
      }
    }
    saveDraft({ ...draft, [itemId]: { ...next, registered: true } });
  };

  const handleUndo = (itemId) => {
    const d = draft[itemId];
    if (!d || d.log.length === 0) return;
    const lastVal = d.log[d.log.length - 1];
    const newLog = d.log.slice(0, -1);
    const newAcc = d.accumulated - lastVal;
    saveDraft({ ...draft, [itemId]: { accumulated: newAcc, log: newLog, registered: false } });
  };

  const handleReset = (itemId) => {
    if (!draft[itemId]) return;
    if (!window.confirm('Xóa số liệu đã nhập cho mặt hàng này?')) return;
    const newDraft = { ...draft };
    delete newDraft[itemId];
    saveDraft(newDraft);
  };

  const handleSubmitAll = async () => {
    const reportDate = reportForYesterday ? yesterday() : today();
    if (!window.confirm(`Gửi báo cáo kiểm kho cho ngày ${reportDate}?`)) return;
    setSubmitting(true);

    // Get last staff report for defaults
    const allReportsSnap = await get(ref(database, 'staff_reports'));
    let lastReport = {};
    if (allReportsSnap.exists()) {
      const all = Object.values(allReportsSnap.val());
      const sorted = all.sort((a, b) => b.submittedAt - a.submittedAt);
      lastReport = sorted[0]?.items || {};
    }

    // Build items payload — default untouched to last report
    const itemsPayload = {};
    items.forEach(item => {
      const d = draft[item.id];
      const lastCount = lastReport[item.id]?.counted ?? 0;
      itemsPayload[item.id] = {
        name: item.name,
        unit: item.unit,
        counted: d ? d.accumulated : lastCount,
        log: d?.log || [],
        isDefaulted: !d, // flag if we used the default
      };
    });

    const newReportRef = push(ref(database, 'staff_reports'));
    await set(newReportRef, {
      date: reportDate,
      staffId: currentUser.uid,
      staffEmail: currentUser.email,
      submittedAt: Date.now(),
      expiresAt: Date.now() + EXPIRE_MS,
      items: itemsPayload,
    });

    // Clear draft
    await remove(ref(database, `reports_draft/${currentUser.uid}`));
    setDraft({});
    setSubmitting(false);
    setSubmitted(true);
  };

  const handleDeleteAllReports = async () => {
    if (!window.confirm('Xóa tất cả báo cáo? Hành động này không thể hoàn tác!')) return;
    setDeleting(true);
    try {
      await remove(ref(database, 'staff_reports'));
      await remove(ref(database, `reports_draft/${currentUser.uid}`));
      setDraft({});
      setSubmitted(true);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = items.filter(i => exactSearch ? i.name.toLowerCase() === search.toLowerCase() : i.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const aR = draft[a.id]?.registered ? 1 : 0;
    const bR = draft[b.id]?.registered ? 1 : 0;
    return bR - aR;
  });
  const countRegistered = Object.values(draft).filter(d => d.registered).length;

  return (
    <div className="container">
      <header className="app-header">
        <h1>
          <button className="hamburger-btn" onClick={toggle}><Menu size={22} /></button>
          Kiểm Kho
        </h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{countRegistered}/{items.length}</span>
      </header>

      {submitted && <div className="toast success">✅ Đã gửi báo cáo thành công!</div>}

      <div className="search-wrapper" style={{ marginBottom: '1.5rem' }}>
        <input type="text" placeholder="Tìm kiếm sản phẩm..." value={search}
          onChange={e => { setSearch(e.target.value); setExactSearch(false); }}
          onFocus={e => e.target.select()} />
        {search && (
          <button className="search-clear-btn" onClick={() => { setSearch(''); setExactSearch(false); }}>
            <X size={18} />
          </button>
        )}
        {search && !exactSearch && filtered.length > 0 && (
          <div className="search-dropdown">
            {filtered.map(item => (
              <div key={item.id} className="search-dropdown-item"
                onClick={() => { setSearch(item.name); setExactSearch(true); }}>
                {item.name}
                <span className="unit-tag">({item.unit})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inventory-grid">
        {sorted.map(item => (
          <StaffItemCard
            key={item.id}
            item={item}
            draftData={draft[item.id]}
            onAdd={(val) => handleAdd(item.id, val)}
            onRegister={(val) => handleRegister(item.id, val)}
            onUndo={() => handleUndo(item.id)}
            onReset={() => handleReset(item.id)}
          />
        ))}
      </div>

      <div className="submit-bar">
        <label className="yesterday-toggle">
          <input type="checkbox" checked={reportForYesterday} onChange={e => setReportForYesterday(e.target.checked)} disabled={submitting || deleting} />
          Báo cáo cho ngày {yesterday()}
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSubmitAll} className="primary" style={{ flex: 1 }} disabled={submitting || deleting}>
            {submitting ? 'Đang gửi...' : `Gửi Báo Cáo (${countRegistered})`}
          </button>
          <button onClick={handleDeleteAllReports} className="danger" style={{ width: '3rem', flexShrink: 0, justifyContent: 'center' }} disabled={deleting || submitting} title="Xóa tất cả báo cáo">
            {deleting ? '...' : <Trash2 size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

const StaffItemCard = ({ item, draftData, onAdd, onRegister, onUndo, onReset }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const accumulated = draftData?.accumulated ?? 0;
  const log = draftData?.log ?? [];
  const registered = draftData?.registered ?? false;
  const hasData = draftData !== undefined;

  const handleAdd = () => {
    if (input === '') { setError('Vui lòng nhập số lượng'); return; }
    const num = parseFloat(input);
    if (isNaN(num) || num < 0) { setError('Số lượng không hợp lệ (không được âm)'); return; }
    setError('');
    const success = onAdd(input);
    if (success) setInput('');
  };

  const handleRegisterClick = () => {
    onRegister(input);
    setInput('');
  };

  return (
    <div className="inventory-item" style={{ border: registered ? '2px solid var(--success)' : '1px solid var(--border-color)' }}>
      <div className="item-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
        <div>
          <h3>{item.name} {registered && <span className="reported-badge">Đã báo cáo</span>}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.unit}</span>
        </div>
        {registered && <Check color="var(--success)" size={22} />}
      </div>

      {log.length > 0 && (
        <div className="log-row">
            <span>{log.map(v => Number(v.toFixed(3))).join(' + ')} = <strong>{Number(accumulated.toFixed(3))}</strong> {item.unit}</span>
          <button className="undo-btn" onClick={onUndo} title="Hoàn tác lần cộng cuối">
            <Undo2 size={14} />
          </button>
        </div>
      )}

      {hasData && log.length === 0 && accumulated === 0 && registered && (
        <div className="log-row" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Không có số liệu nhập — sẽ dùng số liệu báo cáo trước
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      <div className="staff-input-row">
        <input
          type="number"
          step="any"
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          placeholder={accumulated > 0 ? `${accumulated}` : '0'}
          className="staff-input"
        />
        <button onClick={handleAdd} className="primary add-btn">
          <Plus size={18} /> Cộng
        </button>
      </div>

      <div className="register-row">
        <button onClick={handleRegisterClick} className={`register-btn ${registered ? 'registered' : ''}`}>
          {registered ? '✅ Đã Ghi Nhận' : 'Ghi Nhận'}
        </button>
        {hasData && (
          <button onClick={onReset} className="reset-btn" title="Xóa số liệu đã nhập">
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default StaffInventory;
