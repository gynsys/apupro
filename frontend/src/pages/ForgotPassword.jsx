import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../services/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.detail || 'Ocurrió un error al procesar tu solicitud.');
      }
      
      setStatus('success');
      setMessage(data.message || 'Te hemos enviado un correo con las instrucciones.');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Ocurrió un error al procesar tu solicitud.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Recuperar Contraseña
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa tu correo y te enviaremos un enlace para restablecerla.
          </p>
        </div>

        {status === 'success' ? (
          <div className="mt-8 space-y-6">
            <div className="bg-green-50 text-green-800 p-4 rounded-md text-center text-sm border border-green-200">
              {message}
            </div>
            <div className="text-center">
              <Link to="/login" className="font-medium text-[#1A6BB5] hover:text-[#134F8A] text-sm">
                Volver a Iniciar Sesión
              </Link>
            </div>
          </div>
        ) : (
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
                  className="appearance-none rounded-md relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-[#1A6BB5] focus:border-[#1A6BB5] focus:z-10 sm:text-sm"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {status === 'error' && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {message}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#1A6BB5] hover:bg-[#134F8A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A6BB5] transition-colors ${status === 'loading' ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {status === 'loading' ? 'Enviando...' : 'Enviar Enlace'}
              </button>
            </div>
            
            <div className="flex items-center justify-center mt-4">
              <div className="text-sm">
                <Link to="/login" className="font-medium text-gray-600 hover:text-gray-900">
                  Cancelar y volver
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
