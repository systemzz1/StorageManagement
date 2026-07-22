import React, { useState } from 'react';
import { ref, push, set } from 'firebase/database';
import { database } from '../firebaseConfig';

const AddItemModal = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newRef = push(ref(database, 'items'));
    set(newRef, { name: name.trim(), unit: unit.trim() || 'Cái' }).then(() => {
      setName(''); setUnit(''); onClose();
    });
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`}
      onClick={e => { if (e.target.className.includes('modal-overlay')) onClose(); }}>
      <div className="modal-content">
        <h2 style={{ marginBottom: '1rem' }}>Thêm Sản Phẩm Mới</h2>
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
            <button type="button" onClick={onClose}>Hủy</button>
            <button type="submit" className="primary">Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemModal;
