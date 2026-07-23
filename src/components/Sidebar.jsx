import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { useSidebar } from '../contexts/SidebarContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  X, Menu, LayoutDashboard, ClipboardList, FileText, Settings,
  LogOut, Sun, Moon, Monitor
} from 'lucide-react';

const themeIcons = { system: Monitor, dark: Moon, light: Sun };

const navGroups = (role) => [
  {
    label: 'Điều Hướng',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Tổng Quan' },
      { to: '/inventory', icon: ClipboardList, label: 'Kiểm Kho' },
      { to: '/reports', icon: FileText, label: 'Báo Cáo' },
    ],
  },
  ...(role === 'admin'
    ? [{
        label: 'Quản Trị',
        items: [
          { to: '/admin', icon: Settings, label: 'Tài Khoản' },
        ],
      }]
    : []),
];

const Sidebar = () => {
  const { currentUser, role, logout } = useAuth();
  const { isOpen, close, toggle } = useSidebar();
  const { mode, cycleMode } = useTheme();
  const ThemeIcon = themeIcons[mode];

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      close();
      logout();
    }
  };

  const handleNavClick = () => close();

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={close} />
      {!isOpen && (
        <button className="sidebar-tab" onClick={toggle} title="Mở menu">
          <Menu size={20} color="white" />
        </button>
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {(currentUser?.displayName || currentUser?.email || '?')[0].toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {currentUser?.displayName || currentUser?.email}
              </div>
              <div className={`badge ${role === 'admin' ? 'role-admin' : 'role-staff'}`}>
                {role === 'admin' ? 'Quản Lý' : 'Nhân Viên'}
              </div>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={close}>
            <X size={22} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups(role).map((group, gi) => (
            <div key={gi} className="sidebar-section">
              <div className="sidebar-section-label">{group.label}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={handleNavClick}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" onClick={cycleMode} title={`Chế độ: ${mode}`}>
            <ThemeIcon size={20} />
            <span>{mode === 'system' ? 'Tự động' : mode === 'dark' ? 'Chế độ Tối' : 'Chế độ Sáng'}</span>
          </button>
          <button className="sidebar-footer-btn sidebar-logout" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Đăng Xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
