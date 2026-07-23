import React from 'react';
import { useAuth } from '../contexts/useAuth';
import { LayoutDashboard, Package, FileText, BarChart3 } from 'lucide-react';

const Dashboard = () => {
  const { currentUser, role } = useAuth();

  return (
    <div className="container">
      <header className="app-header">
        <h1><LayoutDashboard size={24} /> Tổng Quan</h1>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {role === 'admin' ? 'Quản Lý' : 'Nhân Viên'}
        </span>
      </header>

      <div className="inventory-grid">
        <div className="inventory-item" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>
            Xin chào, {currentUser?.displayName || currentUser?.email}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Hôm nay là {new Date().toLocaleDateString('vi-VN')}
          </p>
        </div>

        <div className="item-stats">
          <a href="/inventory" className="stat-box" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <Package size={28} style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
            <div className="stat-label">Kiểm Kho</div>
          </a>
          <a href="/reports" className="stat-box" style={{ textDecoration: 'none', cursor: 'pointer' }}>
            <FileText size={28} style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
            <div className="stat-label">Báo Cáo</div>
          </a>
        </div>

        <div className="inventory-item" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BarChart3 size={20} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontWeight: 600 }}>Phân Tích</span>
          </div>
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--bg-main)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            fontStyle: 'italic'
          }}>
            Tính năng đang phát triển
          </div>
        </div>

        {role === 'admin' && (
          <div className="inventory-item" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 600 }}>Quản Trị Hệ Thống</span>
            </div>
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              background: 'var(--bg-main)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}>
              Tính năng đang phát triển
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
