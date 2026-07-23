import React, { useState, useEffect } from 'react';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { ref, set, get, remove, onValue, update } from 'firebase/database';
import { database, auth } from '../firebaseConfig';
import { useAuth } from '../contexts/useAuth';
import { useSidebar } from '../contexts/SidebarContext';
import { Trash2, KeyRound, Plus, X, UserPlus, Menu } from 'lucide-react';

// Secondary app to create accounts without logging out admin
const firebaseConfig = {
  apiKey: "AIzaSyDvqMwKKt5Zd-wNb6UxJW5HRFmw6OJTyzw",
  authDomain: "esphanoian.firebaseapp.com",
  databaseURL: "https://esphanoian-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esphanoian",
  storageBucket: "esphanoian.firebasestorage.app",
  messagingSenderId: "27228573774",
  appId: "1:27228573774:web:5739a0b52fc7c86670f31f",
};

let secondaryApp, secondaryAuth;
try {
  secondaryApp = initializeApp(firebaseConfig, 'Secondary');
} catch (e) {
  secondaryApp = getApp('Secondary');
}
secondaryAuth = getAuth(secondaryApp);

// ─── Add Account Modal ────────────────────────────────────────────────────────
const AddAccountModal = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = cred.user.uid;
      await signOut(secondaryAuth);

      await set(ref(database, `users/${uid}`), {
        email,
        displayName: displayName.trim() || email,
        role,
        createdAt: Date.now(),
        disabled: false,
      });

      setEmail(''); setPassword(''); setDisplayName(''); setRole('staff');
      onSuccess(`✅ Đã tạo tài khoản: ${email}`);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`}
      onClick={e => { if (e.target.className.includes('modal-overlay')) onClose(); }}>
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2>Tạo Tài Khoản Mới</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem', background: '#fee2e2', padding: '0.75rem', borderRadius: '6px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tên Hiển Thị</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="VD: Nguyễn Văn A" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Mật Khẩu (tối thiểu 6 ký tự)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="form-group">
            <label>Vai Trò</label>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '1rem', background: 'var(--bg-card)' }}>
              <option value="staff">Nhân Viên (Staff)</option>
              <option value="admin">Quản Lý (Admin)</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Hủy</button>
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Đang tạo...' : 'Tạo Tài Khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Change Password Modal ────────────────────────────────────────────────────
const ResetPasswordModal = ({ user, isOpen, onClose, onSuccess }) => {
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      onSuccess(`📧 Đã gửi email đặt lại mật khẩu đến: ${user.email}`);
      onClose();
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
    setSending(false);
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'open' : ''}`}
      onClick={e => { if (e.target.className.includes('modal-overlay')) onClose(); }}>
      <div className="modal-content">
        <h2 style={{ marginBottom: '1rem' }}>Đặt Lại Mật Khẩu</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Hệ thống sẽ gửi email hướng dẫn đặt lại mật khẩu đến địa chỉ:
          <br /><strong style={{ color: 'var(--text-primary)' }}>{user?.email}</strong>
        </p>
        <div className="modal-actions">
          <button onClick={onClose}>Hủy</button>
          <button className="primary" onClick={handleSend} disabled={sending}>
            {sending ? 'Đang gửi...' : 'Gửi Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const { toggle } = useSidebar();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  useEffect(() => {
    const unsub = onValue(ref(database, 'users'), snap => {
      if (snap.exists()) {
        const list = Object.entries(snap.val())
          .map(([uid, data]) => ({ uid, ...data }))
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        setUsers(list);
      } else {
        setUsers([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleDisable = async (user) => {
    const newState = !user.disabled;
    const label = newState ? 'vô hiệu hóa' : 'kích hoạt';
    if (!window.confirm(`Bạn có muốn ${label} tài khoản ${user.email}?`)) return;
    await update(ref(database, `users/${user.uid}`), { disabled: newState });
    showToast(`✅ Đã ${label} tài khoản ${user.email}`);
  };

  const handleDelete = async (user) => {
    if (user.uid === currentUser?.uid) {
      alert('Bạn không thể xóa tài khoản của chính mình!');
      return;
    }
    if (!window.confirm(`Xóa vĩnh viễn tài khoản ${user.email}?\n\nLưu ý: Tài khoản sẽ bị xóa khỏi hệ thống quản lý. Để xóa hoàn toàn quyền đăng nhập, vào Firebase Console > Authentication.`)) return;
    await remove(ref(database, `users/${user.uid}`));
    showToast(`🗑️ Đã xóa ${user.email}`);
  };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container" style={{ paddingBottom: '6rem' }}>
      <header className="app-header">
        <h1>
          <button className="hamburger-btn" onClick={toggle}><Menu size={22} /></button>
          Quản Lý Tài Khoản
        </h1>
        <button className="primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={18} /> Thêm
        </button>
      </header>

      {toast && <div className="toast success">{toast}</div>}

      <input type="text" className="search-input" placeholder="Tìm theo tên hoặc email..." value={search}
        onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>Đang tải...</div>
      ) : (
        <div className="user-list">
          {filtered.map(user => (
            <div key={user.uid} className={`inventory-item user-card${user.disabled ? ' disabled' : ''}`}>
              <div className="user-card-body">
                <div className="user-info">
                  <div className="user-name">{user.displayName || user.email}</div>
                  <div className="user-email">{user.email}</div>
                  <div className="user-badges">
                    <span className={`badge role-${user.role}`}>
                      {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                    </span>
                    {user.disabled && <span className="badge badge-disabled">Đã vô hiệu hóa</span>}
                    {user.uid === currentUser?.uid && <span className="badge badge-self">Tài khoản của bạn</span>}
                  </div>
                </div>

                <div className="user-actions">
                  <button className="action-btn" onClick={() => setResetTarget(user)}>
                    <KeyRound size={14} /> Đặt lại MK
                  </button>
                  <button className="action-btn" onClick={() => handleToggleDisable(user)}
                    style={{ color: user.disabled ? 'var(--success)' : undefined }}>
                    {user.disabled ? '✅ Kích hoạt' : '⏸ Vô hiệu hóa'}
                  </button>
                  {user.uid !== currentUser?.uid && (
                    <button className="action-btn danger-text" onClick={() => handleDelete(user)}>
                      <Trash2 size={14} /> Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="inventory-item empty-state">Không tìm thấy tài khoản nào.</div>
          )}
        </div>
      )}

      <AddAccountModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={showToast}
      />

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          isOpen={!!resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={showToast}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
