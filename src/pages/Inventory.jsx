import React from 'react';
import { useAuth } from '../contexts/useAuth';
import AdminInventory from './AdminInventory';
import StaffInventory from './StaffInventory';

const Inventory = () => {
  const { role } = useAuth();
  return role === 'admin' ? <AdminInventory /> : <StaffInventory />;
};

export default Inventory;
