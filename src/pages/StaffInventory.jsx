import React, { useState, useEffect } from 'react';
import { ref, onValue, get, set, push, remove } from 'firebase/database';
import { database } from '../firebaseConfig';
import { useAuth } from '../contexts/useAuth';
import { Plus, Check } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const StaffInventory = () => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState({}); // { itemId: { accumulated, log, registered } }
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [exactSearch, setExactSearch] = useState(false);

  // Load item list
  useEffect(() => {
    const unsub = onValue(ref(database, 'items'), snap => {
      if (snap.exists()) {
        setItems(Object.entries(snap.val()).map(([id, v]) => ({ id, ...v })));
      }
    });
    return () => unsub();
  }, []);

  // Load draft from DB on mount
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
    const num = parseInt(inputVal);
    if (isNaN(num) || num < 0) return false;
    const prev = draft[itemId] || { accumulated: 0, log: [] };
    const newAcc = prev.accumulated + num;
    const newLog = [...(prev.log || []), num];
    saveDraft({ ...draft, [itemId]: { accumulated: newAcc, log: newLog, registered: false } });
    return true;
  };

  const handleRegister = (itemId) => {
    const d = draft[itemId];
    if (!d) return;
    saveDraft({ ...draft, [itemId]: { ...d, registered: true } });
  };

  const handleSubmitAll = async () => {
    if (!window.confirm('Gửi báo cáo kiểm kho hôm nay?')) return;
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
      date: today(),
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

  const filtered = items.filter(i => exactSearch ? i.name.toLowerCase() === search.toLowerCase() : i.name.toLowerCase().includes(search.toLowerCase()));
  const countRegistered = Object.values(draft).filter(d => d.registered).length;

  return (
    <div className="container" style={{ paddingBottom: '8rem' }}>
      <header className="app-header">
        <h1>Kiểm Kho</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{countRegistered}/{items.length}</span>
      </header>

      {submitted && (
        <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', textAlign: 'center', fontWeight: 600 }}>
          ✅ Đã gửi báo cáo thành công!
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', marginBottom: '1.5rem' }}>
        <input type="text" placeholder="Tìm kiếm sản phẩm..." value={search}
          onChange={e => { setSearch(e.target.value); setExactSearch(false); }}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem', boxSizing: 'border-box' }} />
        {search && !exactSearch && filtered.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border-color)', borderRadius: '0 0 8px 8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {filtered.map(item => (
              <div key={item.id} onClick={() => { setSearch(item.name); setExactSearch(true); }}
                style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-main)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                {item.name}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginLeft: '0.4rem' }}>({item.unit})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inventory-grid">
        {filtered.map(item => (
          <StaffItemCard
            key={item.id}
            item={item}
            draftData={draft[item.id]}
            onAdd={(val) => handleAdd(item.id, val)}
            onRegister={() => handleRegister(item.id)}
          />
        ))}
      </div>

      <div style={{ position: 'fixed', bottom: '72px', left: 0, right: 0, padding: '0.75rem 1rem', background: 'white', borderTop: '1px solid var(--border-color)', zIndex: 30 }}>
        <button onClick={handleSubmitAll} className="primary" disabled={submitting}
          style={{ width: '100%', padding: '1rem' }}>
          {submitting ? 'Đang gửi...' : `Gửi Báo Cáo (${countRegistered} mục đã đếm)`}
        </button>
      </div>
    </div>
  );
};

const StaffItemCard = ({ item, draftData, onAdd, onRegister }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const accumulated = draftData?.accumulated ?? 0;
  const log = draftData?.log ?? [];
  const registered = draftData?.registered ?? false;

  const handleAdd = () => {
    if (input === '') { setError('Vui lòng nhập số lượng'); return; }
    const num = parseInt(input);
    if (isNaN(num) || num < 0) { setError('Số lượng không hợp lệ (không được âm)'); return; }
    setError('');
    const success = onAdd(input);
    if (success) setInput('');
  };

  return (
    <div className="inventory-item" style={{ border: registered ? '2px solid var(--success)' : '1px solid var(--border-color)' }}>
      <div className="item-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
        <div>
          <h3>{item.name}</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.unit}</span>
        </div>
        {registered && <Check color="var(--success)" size={22} />}
      </div>

      {log.length > 0 && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0', background: 'var(--bg-main)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
          {log.join(' + ')} = <strong style={{ color: 'var(--text-primary)' }}>{accumulated}</strong> {item.unit}
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          type="number"
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          placeholder={accumulated > 0 ? `${accumulated}` : '0'}
          style={{ flex: 1, textAlign: 'center', fontSize: '1.1rem', padding: '0.75rem' }}
        />
        <button onClick={handleAdd} className="primary" style={{ padding: '0.75rem 1rem' }}>
          <Plus size={18} /> Cộng
        </button>
      </div>

      <button onClick={onRegister}
        style={{ width: '100%', marginTop: '0.75rem', background: registered ? '#d1fae5' : 'var(--bg-card)', color: registered ? '#065f46' : 'var(--text-primary)', fontWeight: 600 }}>
        {registered ? '✅ Đã Ghi Nhận' : 'Ghi Nhận'}
      </button>
    </div>
  );
};

export default StaffInventory;
