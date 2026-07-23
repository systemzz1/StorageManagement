import React from 'react';
import { useAuth } from '../contexts/useAuth';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebar } from '../contexts/SidebarContext';
import { Menu, Sun, Moon, Monitor, LogOut } from 'lucide-react';

const themeIcons = { system: Monitor, dark: Moon, light: Sun };

const Navbar = () => {
  const { logout } = useAuth();
  const { mode, cycleMode } = useTheme();
  const { toggle } = useSidebar();
  const ThemeIcon = themeIcons[mode];

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      logout();
    }
  };

  return (
    <nav className="bottom-nav">
      <button onClick={toggle} className="nav-item" title="Mở menu">
        <Menu size={22} />
        <span>Menu</span>
      </button>

      <button onClick={cycleMode} className="nav-item" title={`Chế độ: ${mode}`}>
        <ThemeIcon size={20} />
        <span style={{ fontSize: '0.65rem' }}>{mode === 'system' ? 'Tự động' : mode === 'dark' ? 'Tối' : 'Sáng'}</span>
      </button>

      <button onClick={handleLogout} className="nav-item logout-btn">
        <LogOut size={22} />
        <span>Thoát</span>
      </button>
    </nav>
  );
};

export default Navbar;
