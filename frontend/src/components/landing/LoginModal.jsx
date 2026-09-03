import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { Eye, EyeOff, X } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import toast from 'react-hot-toast';

const encodeStored = (str) => {
  if (!str) return '';
  try {
    return btoa(encodeURIComponent(str));
  } catch {
    return str;
  }
};

const decodeStored = (str) => {
  if (!str) return '';
  try {
    return decodeURIComponent(atob(str));
  } catch {
    return '';
  }
};

export default function LoginModal({ isOpen, onClose, onSwitchToRegister }) {
  const [email, setEmail] = useState(() => localStorage.getItem('costbase_remember_email') || '');
  const [password, setPassword] = useState(() => decodeStored(localStorage.getItem('costbase_remember_pass')));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('costbase_remember_email'));
  
  const [view, setView] = useState('login'); // 'login' | 'verify' | 'forgotPassword' | 'resetPassword'
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  
  const { login, loginWithGoogle } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      const savedEmail = localStorage.getItem('costbase_remember_email') || '';
      const savedPass = decodeStored(localStorage.getItem('costbase_remember_pass'));
      if (savedEmail) {
        setEmail(savedEmail);
      }
      if (savedPass) {
        setPassword(savedPass);
      }
      setRememberMe(!!savedEmail && !!savedPass);
    }
  }, [isOpen]);

  const handleGoogleSuccess = async (tokenResponse) => {
    setIsLoading(true);
    setError('');
    try {
      const token = tokenResponse.access_token;
      if (!token) throw new Error("No se recibió token");

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

  const handleResend = async () => {
    setResending(true);
    try {
      const { resendVerification } = await import('../../services/api');
      await resendVerification(email);
      toast.success('Se ha enviado un nuevo código de verificación a tu correo.');
    } catch (err) {
      toast.error(err.message || 'Error al reenviar el correo');
    } finally {
      setResending(false);
    }
  };
  
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { verifyEmail } = await import('../../services/api');
      await verifyEmail(email, code);
      toast.success('Correo verificado exitosamente. Iniciando sesión...');
      
      const result = await login(email, password, false);
      if (result.success) {
        if (rememberMe) {
          localStorage.setItem('costbase_remember_email', email);
          localStorage.setItem('costbase_remember_pass', encodeStored(password));
        } else {
          localStorage.removeItem('costbase_remember_email');
          localStorage.removeItem('costbase_remember_pass');
        }
        navigate('/budgets');
        onClose();
      } else {
        setView('login');
      }
    } catch (err) {
      setError(err.message || 'Código inválido o error al verificar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { forgotPassword } = await import('../../services/api');
      const data = await forgotPassword(email);
      toast.success(data.message || 'Te hemos enviado un código de recuperación.');
      setView('resetPassword');
    } catch (err) {
      toast.error(err.message || 'Ocurrió un error al procesar tu solicitud.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { resetPassword } = await import('../../services/api');
      const data = await resetPassword(email, code, password);
      toast.success(data.message || 'Contraseña actualizada exitosamente. Inicia sesión.');
      setView('login');
      setPassword('');
      setCode('');
    } catch (err) {
      setError(err.message || 'Código inválido o error al restablecer la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password, false);
    if (result.success) {
      if (rememberMe) {
        localStorage.setItem('costbase_remember_email', email);
        localStorage.setItem('costbase_remember_pass', encodeStored(password));
      } else {
        localStorage.removeItem('costbase_remember_email');
        localStorage.removeItem('costbase_remember_pass');
      }
      navigate('/budgets');
      onClose();
    } else {
      if (result.error === "Email not verified" || result.error === "Tu correo no ha sido verificado aún.") {
        setView('verify');
        // Lanzamos el envío del código automáticamente
        try {
          const { resendVerification } = await import('../../services/api');
          await resendVerification(email);
          toast.success('Te enviamos un código para verificar tu correo.');
        } catch (err) { /* silently ignore resend errors */ }
      } else {
        setError(result.error || 'Ocurrió un error al iniciar sesión');
      }
    }
    
    setIsLoading(false);
  };

  if (!isOpen) return null;

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
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900" style={{ fontFamily: '"Barlow Condensed", sans-serif' }}>
            CostBase
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {view === 'login' && 'Ingresa tus credenciales para acceder al panel'}
            {view === 'verify' && 'Verifica tu correo electrónico'}
            {view === 'forgotPassword' && 'Recuperar contraseña'}
            {view === 'resetPassword' && 'Crea una nueva contraseña'}
          </p>
        </div>

        {view === 'verify' ? (
          <form className="mt-8 space-y-5" onSubmit={handleVerify}>
            <p className="text-sm text-gray-600 text-center">
              Hemos enviado un código de 6 dígitos a <strong>{email}</strong>. Ingrésalo a continuación:
            </p>
            <div>
              <label htmlFor="verify-code" className="sr-only">Código de verificación</label>
              <input
                id="verify-code"
                name="code"
                type="text"
                required
                className="appearance-none block w-full px-3 py-4 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1A6BB5] focus:border-[#1A6BB5] text-center text-2xl tracking-widest sm:text-2xl"
                placeholder="000000"
                maxLength="6"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}
            <div>
              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-[#1A6BB5] hover:bg-[#134F8A] focus:outline-none transition-colors ${isLoading || code.length !== 6 ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Verificando...' : 'Verificar'}
              </button>
            </div>
            <div className="text-center mt-4">
              <button type="button" onClick={handleResend} disabled={resending} className="text-sm font-medium text-[#1A6BB5] hover:text-[#134F8A]">
                {resending ? 'Reenviando...' : 'Reenviar código'}
              </button>
            </div>
          </form>
        ) : view === 'forgotPassword' ? (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            <p className="text-sm text-gray-600 text-center mb-4">Ingresa tu correo y te enviaremos un código para recuperar tu contraseña.</p>
            <div className="rounded-md shadow-sm">
              <div>
                <label htmlFor="email-address-forgot" className="sr-only">Correo electrónico</label>
                <input
                  id="email-address-forgot"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-[#1A6BB5] focus:border-[#1A6BB5] sm:text-sm"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-[#1A6BB5] hover:bg-[#134F8A] focus:outline-none transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Enviando...' : 'Enviar código'}
              </button>
            </div>
            <div className="text-center mt-4">
              <button type="button" onClick={() => { setView('login'); setError(''); }} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Volver a Iniciar Sesión
              </button>
            </div>
          </form>
        ) : view === 'resetPassword' ? (
          <form className="mt-8 space-y-5" onSubmit={handleResetPassword}>
            <p className="text-sm text-gray-600 text-center mb-4">
              Ingresa el código que enviamos a <strong>{email}</strong> y tu nueva contraseña.
            </p>
            <div className="rounded-md shadow-sm space-y-3">
              <div>
                <label htmlFor="reset-code" className="sr-only">Código</label>
                <input
                  id="reset-code"
                  name="code"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1A6BB5] focus:border-[#1A6BB5] text-center text-xl tracking-widest sm:text-xl"
                  placeholder="000000"
                  maxLength="6"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="relative">
                <label htmlFor="new-password" className="sr-only">Nueva Contraseña</label>
                <input
                  id="new-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="appearance-none block w-full px-3 py-3 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1A6BB5] focus:border-[#1A6BB5] sm:text-sm"
                  placeholder="Nueva contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center z-20 text-gray-400 hover:text-gray-600 focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading || code.length !== 6 || password.length < 4}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-[#1A6BB5] hover:bg-[#134F8A] focus:outline-none transition-colors ${isLoading || code.length !== 6 ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Restableciendo...' : 'Restablecer contraseña'}
              </button>
            </div>
            <div className="text-center mt-4">
              <button type="button" onClick={() => { setView('login'); setError(''); setPassword(''); setCode(''); }} className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
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
                    className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-[#1A6BB5] focus:border-[#1A6BB5] focus:z-10 sm:text-sm"
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
                    className="appearance-none rounded-none relative block w-full px-3 py-3 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-[#1A6BB5] focus:border-[#1A6BB5] focus:z-10 sm:text-sm"
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
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setRememberMe(isChecked);
                      if (!isChecked) {
                        localStorage.removeItem('costbase_remember_email');
                        localStorage.removeItem('costbase_remember_pass');
                      }
                    }}
                    className="h-4 w-4 text-[#1A6BB5] focus:ring-[#1A6BB5] border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 cursor-pointer select-none">
                    Recuérdame
                  </label>
                </div>
                <div className="text-sm">
                  <button type="button" onClick={() => { setView('forgotPassword'); setError(''); }} className="font-medium text-[#1A6BB5] hover:text-[#134F8A]">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded flex flex-col gap-2 items-center">
                  <span>{error}</span>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-[#1A6BB5] hover:bg-[#134F8A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A6BB5] transition-colors ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                <button type="button" onClick={onSwitchToRegister} className="font-medium text-[#1A6BB5] hover:text-[#134F8A]">
                  Regístrate aquí
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
