import React, { useState, useEffect } from 'react';
import { ref, onValue, update, get, remove } from 'firebase/database';
import { database } from '../firebaseConfig';
import { Save, SaveAll, Plus, History, Trash2, Download, CheckCircle2, List, Pencil } from 'lucide-react';
import AddItemModal from '../components/AddItemModal';
import EditItemModal from '../components/EditItemModal';
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
  const [viewMode, setViewMode] = useState('edit');
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [exactSearch, setExactSearch] = useState(false);

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
        const finalAdded = d.added || 0;
        const finalUsed = d.used || 0;
        const currentNewTotal = getNew(item.id);

        updates[`master_storage_logs/${selectedDate}/items/${item.id}`] = {
          name: item.name,
          unit: item.unit,
          oldStock: d.oldStock || 0,
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

      // Sheet 1: Horizontal layout — items as rows, dates as column groups
      const fieldLabels = ['Tồn Cũ', 'Nhập', 'Xuất', 'Tồn Mới'];
      const detailHeader = ['Mặt Hàng', 'Đơn Vị'];
      dates.forEach(date => {
        fieldLabels.forEach(f => detailHeader.push(`${date} ${f}`));
      });
      const detailRows = [];
      items.forEach(item => {
        const row = [item.name, item.unit];
        dates.forEach(date => {
          const d = logs[date].items?.[item.id] || {};
          row.push(d.oldStock ?? 0, d.added ?? 0, d.used ?? 0, d.newTotal ?? 0);
        });
        detailRows.push(row);
      });

      const ws1 = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
      const colWidths = [{ wch: 22 }, { wch: 10 }];
      dates.forEach(() => fieldLabels.forEach(() => colWidths.push({ wch: 12 })));
      ws1['!cols'] = colWidths;

      // Sheet 2: Pivot summary by date (newTotal only)
      const pivotHeader = ['Mặt Hàng', 'Đơn Vị', ...dates];
      const pivotRows = [];
      items.forEach(item => {
        const row = [item.name, item.unit];
        dates.forEach(date => {
          const d = logs[date].items?.[item.id] || {};
          row.push(d.newTotal ?? 0);
        });
        pivotRows.push(row);
      });
      const ws2 = XLSX.utils.aoa_to_sheet([pivotHeader, ...pivotRows]);
      ws2['!cols'] = [{ wch: 22 }, { wch: 10 }, ...dates.map(() => ({ wch: 12 }))];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "Chi Tiết Theo Ngày");
      XLSX.utils.book_append_sheet(wb, ws2, "Tổng Quan");
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

  const loadHistoryData = async () => {
    setLoadingHistory(true);
    try {
      const snap = await get(ref(database, 'master_storage_logs'));
      setHistoryData(snap.exists() ? snap.val() : {});
    } catch (err) {
      console.error(err);
    }
    setLoadingHistory(false);
  };

  const handleToggleView = () => {
    if (viewMode === 'edit') {
      setViewMode('history');
      loadHistoryData();
    } else {
      setViewMode('edit');
    }
  };

  const openEditModal = (item) => {
    setEditItem(item);
    setIsEditModalOpen(true);
  };

  const filtered = items.filter(i => exactSearch ? i.name.toLowerCase() === search.toLowerCase() : i.name.toLowerCase().includes(search.toLowerCase()));

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
          <button className="secondary icon-btn" onClick={exportFullHistory} title="Xuất File Excel">
            <Download size={16} />
          </button>
          <button
            className={`secondary icon-btn${viewMode === 'history' ? ' active-view' : ''}`}
            onClick={handleToggleView}
            title={viewMode === 'edit' ? 'Xem lịch sử kho' : 'Quay lại chỉnh sửa'}
          >
            <List size={16} />
          </button>
          <button className="secondary icon-btn" onClick={populateDummyHistory} title="Tạo dữ liệu mẫu 5 ngày">
            <Plus size={16} style={{ opacity: 0.7 }} />
          </button>
        </div>
      </header>

      <div style={{ marginBottom: '1rem', width: '100%' }}>
        <div className="section-label">Lịch sử các ngày kiểm kho:</div>
        <div className="date-chips-scroll date-chips-bar">
          {chipDates.map(dateStr => {
            const isChotted = !!allLoggedDates[dateStr];
            const isSelected = dateStr === selectedDate;
            const chipClass = isSelected ? 'date-chip selected' : isChotted ? 'date-chip logged' : 'date-chip';
            return (
              <button
                key={dateStr}
                className={chipClass}
                onClick={() => setSelectedDate(dateStr)}
              >
                {isChotted && <CheckCircle2 size={12} color={isSelected ? 'white' : '#16a34a'} />}
                <span>{dateStr === today() ? `Hôm nay (${dateStr})` : dateStr}</span>
              </button>
            );
          })}
        </div>
      </div>

{viewMode === 'edit' ? (
  <>
    <div className="filter-row">
      <div className="date-picker-wrap">
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="date-input"
          style={{ borderColor: hasChotKho ? 'var(--success)' : undefined }}
        />
        {hasChotKho && <div className="chot-badge">Đã Chốt</div>}
      </div>
      <div className="search-wrapper">
        <input
          type="text"
          placeholder="Tìm kiếm mặt hàng..."
          value={search}
          onChange={e => { setSearch(e.target.value); setExactSearch(false); }}
        />
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
    </div>

    <div className="save-row">
      <button className="primary save-all-btn" onClick={saveAll} disabled={globalSaving}>
          <SaveAll size={18} />
        {globalSaving ? 'Đang lưu...' : `Chốt Kho Ngày ${selectedDate}`}
      </button>
      <button className="danger" onClick={deleteAllRecords} title="Xóa bản ghi ngày này">
        <Trash2 size={18} />
      </button>
    </div>

    <div className="inventory-grid">
      {filtered.map(item => {
        const d = dayData[item.id] || {};
        const newTotal = getNew(item.id);
        return (
          <div key={item.id} className="inventory-item">
              <div className="item-header">
                <div>
                  <h3>{item.name}</h3>
                  <span className="unit-label">{item.unit}</span>
                </div>
                <div className="btn-group">
                  <button className="btn-sm" onClick={() => openEditModal(item)} title="Chỉnh sửa">
                    <Pencil size={14} />
                  </button>
                  <button className="btn-sm" onClick={() => saveItem(item)} disabled={saving[item.id]}>
                    <Save size={14} /> {saving[item.id] ? '...' : 'Lưu'}
                  </button>
                </div>
              </div>

            <div className="item-stats">
              <div className="stat-box">
                <div className="stat-label">Tồn Cũ</div>
                <input type="number" value={d.oldStock ?? 0}
                  onChange={e => handleFieldChange(item.id, 'oldStock', e.target.value)} />
              </div>
              <div className="stat-box highlight">
                <div className="stat-label">Tổng Mới</div>
                <div className="stat-value highlight-value">{newTotal}</div>
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
  </>
) : (
  <div>
    <div className="history-search-row">
      <div className="search-wrapper">
        <input
          type="text"
          placeholder="Tìm kiếm mặt hàng..."
          value={search}
          onChange={e => { setSearch(e.target.value); setExactSearch(false); }}
        />
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
      <button className="secondary export-btn" onClick={exportFullHistory}>
        <Download size={16} /> Xuất Excel
      </button>
    </div>

    {loadingHistory ? (
      <div className="loading-text">Đang tải dữ liệu lịch sử...</div>
    ) : !historyData || Object.keys(historyData).length === 0 ? (
      <div className="inventory-item empty-state">
        Chưa có dữ liệu lịch sử. Hãy chốt kho để tạo dữ liệu.
      </div>
    ) : (
      <div className="table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              {['Ngày', 'Mặt Hàng', 'ĐV', 'Tồn Cũ', 'Nhập', 'Xuất', 'Tồn Mới'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(historyData).sort((a, b) => b.localeCompare(a)).map(date =>
              items.filter(i => !search || (exactSearch ? i.name.toLowerCase() === search.toLowerCase() : i.name.toLowerCase().includes(search.toLowerCase()))).map(item => {
                const d = historyData[date]?.items?.[item.id] || {};
                const hasAdded = (d.added || 0) > 0;
                const hasUsed = (d.used || 0) > 0;
                const hasActivity = hasAdded || hasUsed;
                return (
                  <tr key={`${date}-${item.id}`} className={hasActivity ? 'activity-row' : ''}>
                    <td className="date-cell">{date}</td>
                    <td className="name-cell">{item.name}</td>
                    <td className="unit-cell">{item.unit}</td>
                    <td className="num-cell">{d.oldStock ?? '-'}</td>
                    <td className={`num-cell ${hasAdded ? 'added-cell' : ''}`}>
                      {hasAdded ? `+${d.added}` : '-'}
                    </td>
                    <td className={`num-cell ${hasUsed ? 'used-cell' : ''}`}>
                      {hasUsed ? `-${d.used}` : '-'}
                    </td>
                    <td className="num-cell total-cell">{d.newTotal ?? '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

      <AddItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      <EditItemModal item={editItem} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </div>
  );
};

export default AdminInventory;
