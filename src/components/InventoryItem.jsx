import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Check } from 'lucide-react';
import { ref, update, remove, get } from 'firebase/database';
import { database } from '../firebaseConfig';
import { useAuth } from '../contexts/useAuth';

const InventoryItem = ({ id, item }) => {
  const { role, currentUser } = useAuth();
  
  // -- Admin logic (direct update) --
  const oldStock = parseInt(item.oldStock) || 0;
  const added = parseInt(item.added) || 0;
  const used = parseInt(item.used) || 0;
  const newTotal = oldStock + added - used;

  const handleAdminUpdate = (field, value) => {
    update(ref(database, `inventory/${id}`), {
      [field]: value === '' ? '' : parseInt(value) || 0
    });
  };

  const handleToggleClosed = () => {
    update(ref(database, `inventory/${id}`), {
      closed: !item.closed
    });
  };

  const handleDelete = () => {
    if (window.confirm(`Xóa ${item.name} khỏi danh sách?`)) {
      remove(ref(database, `inventory/${id}`));
    }
  };

  // -- Staff Logic (Drafting to reports_draft) --
  const [staffInput, setStaffInput] = useState('');
  const [staffAccumulated, setStaffAccumulated] = useState(0);
  const [calculationLog, setCalculationLog] = useState([]);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (role === 'staff' && currentUser) {
      const draftRef = ref(database, `reports_draft/${currentUser.uid}/${id}`);
      get(draftRef).then(snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setStaffAccumulated(data.totalCount || 0);
          setCalculationLog(data.log || []);
          setIsRegistered(true);
        }
      });
    }
  }, [role, currentUser, id]);

  const handleStaffAdd = () => {
    if (staffInput === '') return;
    const num = parseInt(staffInput) || 0;
    if (num < 0) {
      alert('Số lượng đếm không được âm!');
      return;
    }
    
    setStaffAccumulated(prev => prev + num);
    setCalculationLog(prev => [...prev, num]);
    setStaffInput('');
    setIsRegistered(false);
  };

  const handleStaffRegister = () => {
    const draftRef = ref(database, `reports_draft/${currentUser.uid}/${id}`);
    update(draftRef, {
      name: item.name,
      oldStock: oldStock,
      totalCount: staffAccumulated,
      log: calculationLog
    }).then(() => {
      setIsRegistered(true);
    });
  };

  if (role === 'admin') {
    return (
      <div className="inventory-item">
        <div className="item-header">
          <h3>{item.name} <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>({item.unit})</span></h3>
          <button className="icon-btn" onClick={handleDelete} title="Delete" style={{border: 'none', background: 'transparent', padding: '0.5rem'}}>
            <Trash2 size={20} color="var(--text-secondary)" />
          </button>
        </div>
        
        <div className="item-stats">
          <div className="stat-box">
            <div className="stat-label">Tồn Cũ</div>
            <div className="stat-value">{oldStock}</div>
          </div>
          <div className="stat-box highlight">
            <div className="stat-label">Tổng mới</div>
            <div className="stat-value" style={{color: 'var(--accent)'}}>{newTotal}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Nhập thêm</div>
            <input 
              type="number" 
              value={item.added === '' ? '' : item.added} 
              onChange={(e) => handleAdminUpdate('added', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="stat-box">
            <div className="stat-label">Xuất</div>
            <input 
              type="number" 
              value={item.used === '' ? '' : item.used} 
              onChange={(e) => handleAdminUpdate('used', e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className="checkbox-row">
          <input 
            type="checkbox" 
            id={`closed-${id}`} 
            checked={!!item.closed}
            onChange={handleToggleClosed}
          />
          <label htmlFor={`closed-${id}`}>Tích vào để chốt kho ngày</label>
        </div>
      </div>
    );
  }

  // Staff View
  return (
    <div className="inventory-item" style={{ border: isRegistered ? '2px solid var(--success)' : '1px solid var(--border-color)' }}>
      <div className="item-header" style={{ marginBottom: '0.5rem', borderBottom: 'none' }}>
        <div>
          <h3>{item.name}</h3>
          <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem'}}>
            Tồn kho hôm qua: <span style={{fontWeight: 'bold', color: 'var(--text-primary)'}}>{oldStock}</span> {item.unit}
          </div>
        </div>
        {isRegistered && <Check color="var(--success)" size={24} />}
      </div>
      
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', alignItems: 'center' }}>
        <input 
          type="number" 
          value={staffInput} 
          onChange={(e) => setStaffInput(e.target.value)}
          placeholder={staffAccumulated > 0 ? staffAccumulated.toString() : "0"}
          style={{ flex: 1, fontSize: '1.25rem', textAlign: 'center', padding: '1rem' }}
        />
        <button onClick={handleStaffAdd} className="primary" style={{ padding: '1rem 1.5rem', height: '100%' }}>
          <Plus size={20} /> Cộng
        </button>
      </div>
      
      {calculationLog.length > 0 && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
          Nhật ký: {calculationLog.join(' + ')} = <strong>{staffAccumulated}</strong>
        </div>
      )}

      <button 
        onClick={handleStaffRegister} 
        style={{ width: '100%', marginTop: '1rem', background: isRegistered ? 'var(--bg-main)' : 'var(--bg-card)', color: isRegistered ? 'var(--text-secondary)' : 'var(--text-primary)' }}
      >
        {isRegistered ? 'Đã Ghi Nhận (Chỉnh sửa thêm thì cộng tiếp)' : 'Ghi Nhận Số Lượng'}
      </button>
    </div>
  );
};

export default InventoryItem;
