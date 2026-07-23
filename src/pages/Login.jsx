import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await login(email, password);
      navigate('/');
    } catch (err) {
      const errorMessages = {
        'auth/user-not-found': 'Tài khoản không tồn tại.',
        'auth/wrong-password': 'Mật khẩu không đúng.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa.',
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
        'auth/too-many-requests': 'Tài khoản tạm thời bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau.',
      };
      setError(errorMessages[err.code] || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
    }
  };

  return (
    <div className="container login-page">
      <div className="login-header">
        <h1>Hanoi An</h1>
        <p className="login-subtitle">Hệ thống quản lý kiểm kho</p>
      </div>
      
      <div className="inventory-item login-card">
        <h2 className="login-heading">Đăng nhập</h2>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="primary login-btn">
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
