import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { ref, get, remove, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';
import { ArrowRight, ChevronDown, ChevronUp, Trash2, Calendar, FileText } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);

// Purge expired reports from DB and return fresh list
const purgeAndFetch = async () => {
  const snap = await get(ref(database, 'staff_reports'));
  if (!snap.exists()) return [];
  const now = Date.now();
  const reports = [];
  for (const [id, data] of Object.entries(snap.val())) {
    if (data.expiresAt && data.expiresAt < now) {
      await remove(ref(database, `staff_reports/${id}`));
    } else {
      reports.push({ id, ...data });
    }
  }
  return reports.sort((a, b) => b.submittedAt - a.submittedAt);
};

// ─── Admin View ───────────────────────────────────────────────────────────────
const AdminReports = () => {
  const { role } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    // Realtime listener for reports
    const unsub = onValue(ref(database, 'staff_reports'), () => {
      purgeAndFetch().then(r => { setReports(r); setLoading(false); });
    });
    return () => unsub();
  }, []);

  // Group by date
  const grouped = reports.reduce((acc, r) => {
    const d = r.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {});

  const datesWithReports = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const dates = datesWithReports.filter(d => !filterDate || d === filterDate);

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa báo cáo này?')) {
      try {
        await remove(ref(database, `staff_reports/${id}`));
        setReports(prev => prev.filter(r => r.id !== id));
      } catch (err) {
        console.error('Failed to delete report:', err);
        alert('Lỗi khi xóa báo cáo.');
      }
    }
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Đang tải...</div>;

  return (
    <div className="container" style={{ paddingBottom: '6rem' }}>
      <header className="app-header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={24} /> Báo Cáo Nhân Viên
        </h1>
      </header>

      {/* Date Filter Chips with Report Counts */}
      <div style={{ marginBottom: '1.25rem', width: '100%' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 600 }}>
          Lọc báo cáo theo ngày:
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
          <button
            onClick={() => setFilterDate('')}
            style={{
              flexShrink: 0,
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              borderRadius: '20px',
              border: filterDate === '' ? '2px solid var(--accent)' : '1px solid var(--border-color)',
              background: filterDate === '' ? 'var(--accent)' : 'var(--bg-card)',
              color: filterDate === '' ? 'white' : 'var(--text-secondary)',
              fontWeight: filterDate === '' ? 600 : 400,
              whiteSpace: 'nowrap'
            }}
          >
            Tất cả ({reports.length})
          </button>

          {datesWithReports.map(dateStr => {
            const count = grouped[dateStr].length;
            const isSelected = filterDate === dateStr;
            return (
              <button
                key={dateStr}
                onClick={() => setFilterDate(dateStr)}
                style={{
                  flexShrink: 0,
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: '20px',
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                  background: isSelected ? 'var(--accent)' : '#eff6ff',
                  color: isSelected ? 'white' : 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                  fontWeight: isSelected ? 600 : 500
                }}
              >
                <span>{dateStr === today() ? `Hôm nay (${dateStr})` : dateStr}</span>
                <span style={{
                  background: isSelected ? 'rgba(255,255,255,0.3)' : 'var(--accent)',
                  color: 'white',
                  borderRadius: '10px',
                  fontSize: '10px',
                  padding: '1px 6px',
                  fontWeight: 700
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
        <input 
          type="date" 
          value={filterDate} 
          onChange={e => setFilterDate(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem' }} 
        />
        {filterDate && (
          <button 
            onClick={() => setFilterDate('')}
            style={{ padding: '0.75rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            Xóa lọc
          </button>
        )}
      </div>

      {dates.length === 0 && (
        <div className="inventory-item" style={{ textAlign: 'center', padding: '2rem' }}>Không có báo cáo nào.</div>
      )}

      {dates.map(date => (
        <div key={date} style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem', padding: '0 0.25rem' }}>
            📅 {date} ({grouped[date].length} báo cáo)
          </h2>
          {grouped[date].map(report => (
            <ReportCard 
              key={report.id} 
              report={report} 
              expanded={expanded[report.id]} 
              onToggle={() => toggleExpand(report.id)} 
              onDelete={role === 'admin' ? handleDelete : null}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

const ReportCard = ({ report, expanded, onToggle, onDelete }) => {
  const [masterItems, setMasterItems] = useState(null);

  useEffect(() => {
    get(ref(database, `master_storage_logs/${report.date}/items`)).then(snap => {
      setMasterItems(snap.exists() ? snap.val() : null);
    });
  }, [report.date]);

  const items = report.items ? Object.entries(report.items) : [];

  return (
    <div className="inventory-item" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={onToggle}>
        <div>
          <div style={{ fontWeight: 600 }}>{report.staffEmail}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {new Date(report.submittedAt).toLocaleTimeString('vi-VN')} · 
            <span style={{ color: 'var(--danger)', marginLeft: '0.25rem' }}>
              Hết hạn: {new Date(report.expiresAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(report.id); }}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          {items.map(([itemId, item]) => {
            const masterQty = masterItems?.[itemId]?.newTotal ?? null;
            const diff = masterQty !== null ? item.counted - masterQty : null;
            return (
              <div key={itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  {item.isDefaulted && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.4rem' }}>(mặc định)</span>}
                  {item.log && item.log.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{item.log.join(' + ')}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Master</span>
                    <strong style={{ fontSize: '1rem' }}>{masterQty !== null ? masterQty : '-'}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>Staff</span>
                    <strong style={{ fontSize: '1rem' }}>{item.counted} {item.unit}</strong>
                  </div>
                  {diff !== null && (
                    <div style={{ 
                      minWidth: '40px', 
                      textAlign: 'center', 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      backgroundColor: diff > 0 ? 'rgba(var(--success), 0.15)' : diff < 0 ? 'rgba(var(--danger), 0.15)' : 'transparent',
                      color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      border: `1px solid ${diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--border-color)'}`
                    }}>
                      {diff > 0 ? `+${diff}` : diff === 0 ? '✓' : diff}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Staff View ───────────────────────────────────────────────────────────────
const StaffReports = () => {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    purgeAndFetch().then(all => {
      setReports(all.filter(r => r.staffId === currentUser?.uid));
      setLoading(false);
    });
  }, [currentUser]);

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Đang tải...</div>;

  return (
    <div className="container" style={{ paddingBottom: '6rem' }}>
      <header className="app-header">
        <h1>Báo Cáo Của Tôi</h1>
      </header>
      {reports.length === 0 ? (
        <div className="inventory-item" style={{ textAlign: 'center', padding: '2rem' }}>
          Bạn chưa có báo cáo nào. Hãy kiểm kho và gửi báo cáo!
        </div>
      ) : reports.map(report => (
        <div key={report.id} className="inventory-item" style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleExpand(report.id)}>
            <div>
              <div style={{ fontWeight: 600 }}>Ngày {report.date}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {new Date(report.submittedAt).toLocaleTimeString('vi-VN')} · Hết hạn: {new Date(report.expiresAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
            {expanded[report.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {expanded[report.id] && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              {Object.entries(report.items || {}).map(([id, item]) => (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px dashed var(--border-color)' }}>
                  <span>{item.name} {item.isDefaulted ? <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>(mặc định)</span> : ''}</span>
                  <strong>{item.counted} {item.unit}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Export ───────────────────────────────────────────────────────────────────
const ReportsView = () => {
  const { role } = useAuth();
  return role === 'admin' ? <AdminReports /> : <StaffReports />;
};

export default ReportsView;
