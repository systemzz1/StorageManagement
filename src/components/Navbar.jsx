import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { ClipboardList, FileText, Settings, LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { ref, onValue } from 'firebase/database';
import { database } from '../firebaseConfig';

const themeIcons = { system: Monitor, dark: Moon, light: Sun };

const Navbar = () => {
  const { role, logout } = useAuth();
  const { mode, cycleMode } = useTheme();
  const ThemeIcon = themeIcons[mode];
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    if (role !== 'admin') return;

    const unsub = onValue(ref(database, 'staff_reports'), (snapshot) => {
      if (snapshot.exists()) {
        const count = Object.keys(snapshot.val()).length;
        setReportCount(count);
      } else {
        setReportCount(0);
      }
    });

    return () => unsub();
  }, [role]);

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      logout();
    }
  };

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <ClipboardList size={22} />
        <span>Kiểm Kho</span>
      </NavLink>

      <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <FileText size={22} />
          {role === 'admin' && reportCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-8px',
              background: 'var(--danger)',
              color: 'white',
              fontSize: '10px',
              fontWeight: '700',
              borderRadius: '10px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)'
            }}>
              {reportCount > 99 ? '99+' : reportCount}
            </span>
          )}
        </div>
        <span>Báo Cáo</span>
      </NavLink>

      <button onClick={cycleMode} className="nav-item" title={`Chế độ: ${mode}`}>
        <ThemeIcon size={20} />
        <span style={{ fontSize: '0.65rem' }}>{mode === 'system' ? 'Tự động' : mode === 'dark' ? 'Tối' : 'Sáng'}</span>
      </button>

      {role === 'admin' && (
        <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <Settings size={22} />
          <span>Quản Lý</span>
        </NavLink>
      )}

      <button onClick={handleLogout} className="nav-item logout-btn">
        <LogOut size={22} />
        <span>Thoát</span>
      </button>
    </nav>
  );
};

export default Navbar;
