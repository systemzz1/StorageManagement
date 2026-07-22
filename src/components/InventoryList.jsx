import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';
import InventoryItem from './InventoryItem';

const InventoryList = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const inventoryRef = ref(database, 'inventory');
    const unsubscribe = onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const itemsList = Object.entries(data).map(([id, item]) => ({
          id,
          ...item
        }));
        setInventory(itemsList);
      } else {
        setInventory([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Đang tải dữ liệu...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <input 
          type="text" 
          placeholder="Tìm kiếm sản phẩm..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '1rem' }}
        />
      </div>

      {filteredInventory.length === 0 ? (
        <div className="inventory-item" style={{ padding: '3rem', textAlign: 'center' }}>
          <h3>Không tìm thấy sản phẩm</h3>
        </div>
      ) : (
        <div className="inventory-grid">
          {filteredInventory.map((item) => (
            <InventoryItem key={item.id} id={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default InventoryList;
