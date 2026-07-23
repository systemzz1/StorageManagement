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

  if (loading) return <div className="loading-text">Đang tải...</div>;

  return (
    <div className="container" style={{ paddingBottom: '6rem' }}>
      <header className="app-header">
        <h1><FileText size={24} /> Báo Cáo Nhân Viên</h1>
      </header>

      <div style={{ marginBottom: '1.25rem', width: '100%' }}>
        <div className="section-label">Lọc báo cáo theo ngày:</div>
        <div className="date-chips-scroll date-chips-bar">
          <button
            className={`date-chip${filterDate === '' ? ' selected' : ''}`}
            onClick={() => setFilterDate('')}
          >
            Tất cả ({reports.length})
          </button>

          {datesWithReports.map(dateStr => {
            const count = grouped[dateStr].length;
            const isSelected = filterDate === dateStr;
            return (
              <button
                key={dateStr}
                className={`date-chip${isSelected ? ' selected' : ''} report-chip`}
                onClick={() => setFilterDate(dateStr)}
              >
                <span>{dateStr === today() ? `Hôm nay (${dateStr})` : dateStr}</span>
                <span className={`count-badge${isSelected ? ' light' : ''}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-date-row">
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        {filterDate && (
          <button onClick={() => setFilterDate('')} className="clear-filter-btn">
            Xóa lọc
          </button>
        )}
      </div>

      {dates.length === 0 && (
        <div className="inventory-item empty-state">Không có báo cáo nào.</div>
      )}

      {dates.map(date => (
        <div key={date} className="report-date-group">
          <h2 className="report-date-header">📅 {date} ({grouped[date].length} báo cáo)</h2>
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
    <div className="inventory-item report-card">
      <div className="report-card-header" onClick={onToggle}>
        <div>
          <div className="report-staff">{report.staffEmail}</div>
          <div className="report-meta">
            {new Date(report.submittedAt).toLocaleTimeString('vi-VN')} · 
            <span className="report-expiry">Hết hạn: {new Date(report.expiresAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
        <div className="report-card-controls">
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(report.id); }} className="delete-btn-icon">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="report-expanded-body">
          {items.map(([itemId, item]) => {
            const masterQty = masterItems?.[itemId]?.newTotal ?? null;
            const diff = masterQty !== null ? item.counted - masterQty : null;
            const diffClass = diff !== null ? (diff > 0 ? ' diff-pos' : diff < 0 ? ' diff-neg' : ' diff-zero') : '';
            return (
              <div key={itemId} className="report-item-row">
                <div className="report-item-info">
                  <span className="report-item-name">{item.name}</span>
                  {item.isDefaulted && <span className="defaulted-tag">(mặc định)</span>}
                  {item.log && item.log.length > 0 && (
                    <div className="report-item-log">{item.log.join(' + ')}</div>
                  )}
                </div>
                <div className="report-item-values">
                  <div className="report-value-col">
                    <span className="value-label">Master</span>
                    <strong>{masterQty !== null ? masterQty : '-'}</strong>
                  </div>
                  <div className="report-value-col">
                    <span className="value-label">Staff</span>
                    <strong>{item.counted} {item.unit}</strong>
                  </div>
                  {diff !== null && (
                    <div className={`diff-badge${diffClass}`}>
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
        <div className="inventory-item empty-state">Bạn chưa có báo cáo nào. Hãy kiểm kho và gửi báo cáo!</div>
      ) : reports.map(report => (
        <div key={report.id} className="inventory-item staff-report-item">
          <div className="report-card-header" onClick={() => toggleExpand(report.id)}>
            <div>
              <div className="report-staff">Ngày {report.date}</div>
              <div className="report-meta">
                {new Date(report.submittedAt).toLocaleTimeString('vi-VN')} · Hết hạn: {new Date(report.expiresAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
            {expanded[report.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          {expanded[report.id] && (
            <div className="report-expanded-body">
              {Object.entries(report.items || {}).map(([id, item]) => (
                <div key={id} className="report-item-row staff-row">
                  <span>{item.name} {item.isDefaulted ? <span className="defaulted-tag">(mặc định)</span> : ''}</span>
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
