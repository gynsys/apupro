import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { Eye, EyeOff, X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

export default function LoginModal({ isOpen, onClose, onSwitchToRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (tokenResponse) => {
    setIsLoading(true);
    setError('');
    try {
      console.log("Google token response:", tokenResponse);
      const token = tokenResponse.access_token;
      if (!token) throw new Error("No se recibió token. Info: " + JSON.stringify(tokenResponse));

      const result = await loginWithGoogle(token);
      if (result.success) {
        navigate('/budgets');
        onClose();
      } else {
        setError(result.error || 'Error del backend al iniciar sesión');
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message || 'Error al iniciar sesión con Google');
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Error al iniciar sesión con Google'),
  });

  const [resending, setResending] = useState(false);

  if (!isOpen) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      const { resendVerification } = await import('../../services/api');
      await resendVerification(email);
      alert('Se ha enviado un nuevo enlace de verificación a tu correo.');
    } catch (err) {
      alert(err.message || 'Error al reenviar el correo');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password, false);
    if (result.success) {
      navigate('/budgets');
      onClose();
    } else {
      setError(result.error || 'Ocurrió un error al iniciar sesión');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white p-10 rounded-2xl shadow-2xl border border-gray-100 animate-slide-up">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={24} />
        </button>

        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            CostBase
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa tus credenciales para acceder al panel
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Correo electrónico</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-600 focus:border-blue-600 focus:z-10 sm:text-sm"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-600 focus:border-blue-600 focus:z-10 sm:text-sm"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center z-20 text-gray-400 hover:text-gray-600 focus:outline-none"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Eye className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link to="/forgot-password" onClick={onClose} className="font-medium text-blue-600 hover:text-blue-800">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded flex flex-col gap-2 items-center">
              <span>{error === "Email not verified" ? "Tu correo no ha sido verificado aún." : error}</span>
              {error === "Email not verified" && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-[#1A6BB5] hover:text-[#134F8A] font-semibold text-xs underline"
                >
                  {resending ? "Reenviando..." : "Reenviar correo de verificación"}
                </button>
              )}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center">
              <div className="flex-grow border-t border-gray-300" />
              <span className="flex-shrink mx-4 text-sm text-gray-500">
                O continúa con
              </span>
              <div className="flex-grow border-t border-gray-300" />
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => googleLogin()}
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-700 hover:bg-gray-50 font-bold transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
            </div>
          </div>
        </form>

        <div className="text-center mt-4 pb-2">
          <p className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <button type="button" onClick={onSwitchToRegister} className="font-medium text-blue-600 hover:text-blue-800">
              Regístrate aquí
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
