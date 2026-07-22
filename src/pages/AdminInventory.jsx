import React, { useState, useEffect } from 'react';
import { ref, onValue, update, get, remove } from 'firebase/database';
import { database } from '../firebaseConfig';
import { Save, SaveAll, Plus, History, Trash2, Download, CheckCircle2 } from 'lucide-react';
import AddItemModal from '../components/AddItemModal';
import * as XLSX from 'xlsx';

const today = () => new Date().toISOString().slice(0, 10);

const AdminInventory = () => {
  const [items, setItems] = useState([]);
  const [dayData, setDayData] = useState({});
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(today());
  const [saving, setSaving] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [hasChotKho, setHasChotKho] = useState(false);
  const [allLoggedDates, setAllLoggedDates] = useState({});

  // Load master item list
  useEffect(() => {
    const unsubscribe = onValue(ref(database, 'items'), snap => {
      if (snap.exists()) {
        const list = Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
        setItems(list);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to all master_storage_logs to know which dates have data
  useEffect(() => {
    const unsub = onValue(ref(database, 'master_storage_logs'), snap => {
      if (snap.exists()) {
        const logs = snap.val();
        const dateStatus = {};
        Object.keys(logs).forEach(date => {
          dateStatus[date] = !!logs[date].items;
        });
        setAllLoggedDates(dateStatus);
      } else {
        setAllLoggedDates({});
      }
    });
    return () => unsub();
  }, []);

  // Load day log when date changes, falling back to previous day
  useEffect(() => {
    const loadDayData = async () => {
      const snap = await get(ref(database, `master_storage_logs/${selectedDate}/items`));
      if (snap.exists()) {
        setDayData(snap.val());
        setHasChotKho(true);
      } else {
        // Try yesterday as seed
        const yesterday = new Date(selectedDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        const ySnap = await get(ref(database, `master_storage_logs/${yStr}/items`));
        const seed = {};
        items.forEach(item => {
          const prev = ySnap.exists() && ySnap.val()[item.id];
          seed[item.id] = {
            name: item.name,
            unit: item.unit,
            oldStock: prev ? (prev.newTotal ?? prev.oldStock ?? 0) : 0,
            added: 0,
            used: 0,
          };
        });
        setDayData(seed);
        setHasChotKho(false);
      }
    };
    if (items.length > 0) loadDayData();
  }, [selectedDate, items]);

  const getNew = (id) => {
    const d = dayData[id] || {};
    return (d.oldStock || 0) + (d.added || 0) - (d.used || 0);
  };

  const handleFieldChange = (id, field, value) => {
    const num = value === '' ? 0 : Math.max(0, parseFloat(value) || 0);
    setDayData(prev => ({ ...prev, [id]: { ...prev[id], [field]: num } }));
  };

  const saveItem = async (item) => {
    setSaving(s => ({ ...s, [item.id]: true }));
    const d = dayData[item.id] || {};
    await update(ref(database, `master_storage_logs/${selectedDate}/items/${item.id}`), {
      name: item.name,
      unit: item.unit,
      oldStock: d.oldStock || 0,
      added: d.added || 0,
      used: d.used || 0,
      newTotal: getNew(item.id),
    });
    setSaving(s => ({ ...s, [item.id]: false }));
  };

  const saveAll = async () => {
    setGlobalSaving(true);
    try {
      const updates = {};
      items.forEach(item => {
        const d = dayData[item.id] || {};
        let finalAdded = d.added || 0;
        let finalUsed = d.used || 0;

        const currentNewTotal = getNew(item.id);
        const startPoint = d.oldStock || 0;

        if (finalAdded === 0 && finalUsed === 0) {
          const diff = currentNewTotal - startPoint;
          if (diff > 0) finalAdded = diff;
          else if (diff < 0) finalUsed = Math.abs(diff);
        }

        updates[`master_storage_logs/${selectedDate}/items/${item.id}`] = {
          name: item.name,
          unit: item.unit,
          oldStock: startPoint,
          added: finalAdded,
          used: finalUsed,
          newTotal: currentNewTotal,
        };
      });

      await update(ref(database, '/'), updates);
      setHasChotKho(true);
      alert(`✅ Đã chốt kho ngày ${selectedDate}`);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi lưu dữ liệu.');
    } finally {
      setGlobalSaving(false);
    }
  };

  const exportFullHistory = async () => {
    try {
      const snap = await get(ref(database, 'master_storage_logs'));
      if (!snap.exists()) {
        alert('Không có dữ liệu lịch sử để xuất.');
        return;
      }

      const logs = snap.val();
      const dates = Object.keys(logs).sort((a, b) => a.localeCompare(b));
      
      const header = ['Ngày', ...items.map(i => i.name)];
      const rows = [];

      dates.forEach(date => {
        const dayItems = logs[date].items || {};
        const row = [date];
        items.forEach(item => {
          const d = dayItems[item.id] || {};
          row.push(d.newTotal ?? 0);
        });
        rows.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Lịch Sử Kho");
      XLSX.writeFile(wb, `Full_History_${today()}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xuất dữ liệu.');
    }
  };

  const deleteAllRecords = async () => {
    if (window.confirm(`CẢNH BÁO: Xóa toàn bộ bản ghi ngày ${selectedDate}?`)) {
      try {
        await remove(ref(database, `master_storage_logs/${selectedDate}`));
        setHasChotKho(false); 
        alert('Đã xóa bản ghi của ngày hiện tại.');
      } catch (err) {
        console.error(err);
        alert('Lỗi khi xóa dữ liệu.');
      }
    }
  };

  const populateDummyHistory = async () => {
    if (!window.confirm('Tạo dữ liệu mẫu kho 5 ngày liên tiếp (từ 4 ngày trước đến hôm nay) với số liệu tiếp nối chính xác qua từng ngày?')) return;

    try {
      setGlobalSaving(true);

      const dateObjects = [];
      for (let i = 4; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dateObjects.push({
          dateStr: d.toISOString().slice(0, 10),
          timestamp: d.getTime()
        });
      }

      const currentStockMap = {};

      items.forEach(item => {
        let initialQty = 30;
        const u = (item.unit || '').toLowerCase();
        const n = item.name.toLowerCase();
        if (u.includes('chai') || u.includes('lon')) initialQty = Math.floor(Math.random() * 40) + 20;
        else if (u.includes('kg')) initialQty = Math.floor(Math.random() * 15) + 5;
        else if (u.includes('quả') || u.includes('cái') || u.includes('gói')) initialQty = Math.floor(Math.random() * 25) + 10;
        if (n.includes('water') || n.includes('coke')) initialQty += 30;

        currentStockMap[item.id] = initialQty;
      });

      const rootUpdates = {};

      for (let dayIdx = 0; dayIdx < dateObjects.length; dayIdx++) {
        const dateStr = dateObjects[dayIdx].dateStr;

        items.forEach(item => {
          const oldStock = currentStockMap[item.id] || 0;

          let used = Math.floor(Math.random() * Math.min(oldStock + 1, 10));
          let added = 0;

          if (oldStock - used < 12 || Math.random() < 0.25) {
            added = Math.floor(Math.random() * 20) + 10;
          }

          const newTotal = Math.max(0, oldStock + added - used);

          rootUpdates[`master_storage_logs/${dateStr}/items/${item.id}`] = {
            name: item.name,
            unit: item.unit,
            oldStock: oldStock,
            added: added,
            used: used,
            newTotal: newTotal,
          };

          currentStockMap[item.id] = newTotal;
        });

        if (dayIdx >= 3) {
          const reportId = `dummy_report_${dateStr}`;
          const staffReportItems = {};
          
          items.forEach(item => {
            const masterNewTotal = rootUpdates[`master_storage_logs/${dateStr}/items/${item.id}`].newTotal;
            let counted = masterNewTotal;
            const rand = Math.random();
            if (rand < 0.08 && masterNewTotal > 0) counted -= 1;
            else if (rand > 0.92) counted += 1;

            staffReportItems[item.id] = {
              name: item.name,
              unit: item.unit,
              counted: counted,
              log: counted === masterNewTotal ? [counted] : [masterNewTotal, counted - masterNewTotal],
              isDefaulted: Math.random() < 0.2,
            };
          });

          rootUpdates[`staff_reports/${reportId}`] = {
            date: dateStr,
            staffId: 'dummy_staff_01',
            staffEmail: 'nhanvien.kiemkho@hanoian.com',
            submittedAt: dateObjects[dayIdx].timestamp + 18 * 3600 * 1000,
            expiresAt: dateObjects[dayIdx].timestamp + 30 * 24 * 3600 * 1000,
            items: staffReportItems
          };
        }
      }

      await update(ref(database, '/'), rootUpdates);
      alert(`✅ Đã tạo thành công dữ liệu kho 5 ngày liên tiếp & 2 báo cáo nhân viên mẫu!`);

      const snap = await get(ref(database, `master_storage_logs/${selectedDate}/items`));
      if (snap.exists()) {
        setDayData(snap.val());
        setHasChotKho(true);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi khi tạo dữ liệu mẫu: ' + err.message);
    } finally {
      setGlobalSaving(false);
    }
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  // Available dates for chips (combine today + logged dates, sorted descending)
  const chipDates = Array.from(new Set([today(), ...Object.keys(allLoggedDates)])).sort((a, b) => b.localeCompare(a));

  return (
    <div className="container" style={{ paddingBottom: '6rem' }}>
      <header className="app-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={24} /> Kho Hàng (Lịch Sử)
        </h1>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <button className="primary" onClick={() => setIsModalOpen(true)} title="Thêm mặt hàng mới"><Plus size={18} /></button>
          <button 
            className="secondary" 
            onClick={exportFullHistory}
            title="Xuất File Excel"
            style={{ display: 'flex', alignItems: 'center', padding: '0.5rem' }}
          >
            <Download size={16} />
          </button>
          <button 
            className="secondary" 
            onClick={populateDummyHistory}
            title="Tạo dữ liệu mẫu 5 ngày"
            style={{ display: 'flex', alignItems: 'center', padding: '0.5rem' }}
          >
            <Plus size={16} style={{ opacity: 0.7 }} />
          </button>
        </div>
      </header>

      {/* Date Selector Chips with Status Indicators */}
      <div style={{ marginBottom: '1rem', width: '100%' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
          Lịch sử các ngày kiểm kho:
        </div>
        <div 
          className="date-chips-scroll"
          style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            overflowX: 'auto', 
            paddingBottom: '0.6rem',
            paddingTop: '0.2rem',
            WebkitOverflowScrolling: 'touch',
            width: '100%'
          }}
        >
          {chipDates.map(dateStr => {
            const isChotted = !!allLoggedDates[dateStr];
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                style={{
                  flexShrink: 0,
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '20px',
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                  background: isSelected ? 'var(--accent)' : isChotted ? '#f0fdf4' : 'var(--bg-card)',
                  color: isSelected ? 'white' : isChotted ? '#15803d' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  whiteSpace: 'nowrap',
                  fontWeight: isSelected || isChotted ? 600 : 400
                }}
              >
                {isChotted && <CheckCircle2 size={12} color={isSelected ? 'white' : '#16a34a'} />}
                <span>{dateStr === today() ? `Hôm nay (${dateStr})` : dateStr}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '0 0 auto' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ 
              padding: '0.75rem', 
              borderRadius: '8px', 
              border: `2px solid ${hasChotKho ? 'var(--success)' : 'var(--border-color)'}`,
              fontSize: '1rem' 
            }}
          />
          {hasChotKho && (
            <div style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'var(--success)', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '10px', fontWeight: 700 }}>Đã Chốt</div>
          )}
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm mặt hàng..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button className="primary" onClick={saveAll} disabled={globalSaving}
          style={{ flex: 1, padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <SaveAll size={18} />
          {globalSaving ? 'Đang lưu...' : `Chốt Kho Ngày ${selectedDate}`}
        </button>
        <button 
          className="danger" 
          onClick={deleteAllRecords}
          title="Xóa bản ghi ngày này"
          style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="inventory-grid">
        {filtered.map(item => {
          const d = dayData[item.id] || {};
          const newTotal = getNew(item.id);
          return (
            <div key={item.id} className="inventory-item" style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px' }}>
              <div className="item-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.unit}</span>
                </div>
                <button onClick={() => saveItem(item)} disabled={saving[item.id]}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <Save size={14} /> {saving[item.id] ? '...' : 'Lưu'}
                </button>
              </div>

              <div className="item-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
                <div className="stat-box">
                  <div className="stat-label">Tồn Cũ</div>
                  <input type="number" value={d.oldStock ?? 0}
                    onChange={e => handleFieldChange(item.id, 'oldStock', e.target.value)} />
                </div>
                <div className="stat-box highlight">
                  <div className="stat-label">Tổng Mới</div>
                  <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1.2rem', fontWeight: 800 }}>{newTotal}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Nhập</div>
                  <input type="number" value={d.added ?? 0}
                    onChange={e => handleFieldChange(item.id, 'added', e.target.value)} />
                </div>
                <div className="stat-box">
                  <div className="stat-label">Xuất</div>
                  <input type="number" value={d.used ?? 0}
                    onChange={e => handleFieldChange(item.id, 'used', e.target.value)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AddItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default AdminInventory;
