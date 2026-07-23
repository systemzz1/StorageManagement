import React, { useState, useEffect } from 'react';
import { ref, update } from 'firebase/database';
import { database } from '../firebaseConfig';

const EditItemModal = ({ item, isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setUnit(item.unit || '');
    }
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    update(ref(database, `items/${item.id}`), {
      name: name.trim(),
      unit: unit.trim() || item.unit || 'Cái',
    }).then(() => {
      setLoading(false); onClose();
    });
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`}
      onClick={e => { if (e.target.className.includes('modal-overlay')) onClose(); }}>
      <div className="modal-content">
        <h2 style={{ marginBottom: '1rem' }}>Chỉnh Sửa Sản Phẩm</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tên Sản Phẩm</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Đơn Vị (Chai, Kg, Cái…)</label>
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)} placeholder="Cái" />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Đang cập nhật...' : 'Cập Nhật'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditItemModal;
