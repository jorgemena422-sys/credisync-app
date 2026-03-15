import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    businessName: ''
  });
  const [canRegister, setCanRegister] = useState(false);
  const { login, registerAdmin } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch('/api/auth/can-register');
        const data = await response.json();
        setCanRegister(data.canRegister);
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    checkAdminStatus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        showToast('Bienvenido a CrediSync', 'success');
      } else {
        await registerAdmin(formData);
        showToast('Cuenta de administrador creada exitosamente', 'success');
        setIsLogin(true);
      }
    } catch (error) {
      showToast(error.message || 'Error en la autenticación', 'error');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in">
        <div className="login-header">
          <div className="logo-container">
            <span className="material-icons logo-icon">auto_graph</span>
            <span className="logo-text">CrediSync</span>
          </div>
          <p className="subtitle">Gestión inteligente de préstamos</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {!isLogin && (
            <>
              <div className="form-group">
                <label>Nombre Completo</label>
                <div className="input-with-icon">
                  <span className="material-icons">person</span>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Tu nombre"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Nombre del Negocio</label>
                <div className="input-with-icon">
                  <span className="material-icons">business</span>
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="Ej: Inversiones MJ"
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Correo Electrónico</label>
            <div className="input-with-icon">
              <span className="material-icons">email</span>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@email.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-with-icon">
              <span className="material-icons">lock</span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-icons">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta Administrador'}
          </button>
        </form>

        <div className="login-footer">
          {isLogin ? (
            canRegister && (
              <p>
                ¿Eres nuevo? 
                <button onClick={() => setIsLogin(false)}>Regístrate como Admin</button>
              </p>
            )
          ) : (
            <p>
              ¿Ya tienes cuenta? 
              <button onClick={() => setIsLogin(true)}>Inicia Sesión</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;