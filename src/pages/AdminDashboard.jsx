import React, { useState, useEffect } from 'react';
import { initializeApp, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { ref, set, get, remove, onValue, update } from 'firebase/database';
import { database, auth } from '../firebaseConfig';
import { useAuth } from '../contexts/useAuth';
import { Trash2, KeyRound, Plus, X, UserPlus } from 'lucide-react';

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
              style={{ width: '100%', padding: '0.875rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '1rem', background: 'white' }}>
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
        <h1>Quản Lý Tài Khoản</h1>
        <button className="primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={18} /> Thêm
        </button>
      </header>

      {toast && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.875rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontWeight: 500 }}>
          {toast}
        </div>
      )}

      <input type="text" placeholder="Tìm theo tên hoặc email..." value={search}
        onChange={e => setSearch(e.target.value)} style={{ width: '100%', marginBottom: '1.25rem' }} />

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>Đang tải...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(user => (
            <div key={user.uid} className="inventory-item"
              style={{ opacity: user.disabled ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.displayName || user.email}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px',
                      background: user.role === 'admin' ? '#eff6ff' : '#f0fdf4',
                      color: user.role === 'admin' ? 'var(--accent)' : 'var(--success)',
                      border: `1px solid ${user.role === 'admin' ? '#bfdbfe' : '#bbf7d0'}`
                    }}>
                      {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                    </span>
                    {user.disabled && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#fee2e2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
                        Đã vô hiệu hóa
                      </span>
                    )}
                    {user.uid === currentUser?.uid && (
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                        Tài khoản của bạn
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
                  <button onClick={() => setResetTarget(user)}
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <KeyRound size={14} /> Đặt lại MK
                  </button>
                  <button onClick={() => handleToggleDisable(user)}
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', gap: '0.3rem', alignItems: 'center', color: user.disabled ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {user.disabled ? '✅ Kích hoạt' : '⏸ Vô hiệu hóa'}
                  </button>
                  {user.uid !== currentUser?.uid && (
                    <button onClick={() => handleDelete(user)}
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', gap: '0.3rem', alignItems: 'center', color: 'var(--danger)' }}>
                      <Trash2 size={14} /> Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="inventory-item" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Không tìm thấy tài khoản nào.
            </div>
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
