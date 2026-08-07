import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { submitContactForm } from '../services/api.js';

/**
 * Hook that manages the contact form state, validation and submission.
 * @returns {Object} form state and handlers
 */
export function useContactForm() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      project_type: '',
      message: '',
    },
  });

  const onSubmit = async (data) => {
    setStatus('loading');
    setErrorMessage('');

    try {
      await submitContactForm(data);
      setStatus('success');
      reset();
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message || 'Ocurrió un error. Intenta nuevamente.');
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setErrorMessage('');
    reset();
  };

  return {
    register,
    handleSubmit: handleSubmit(onSubmit),
    errors,
    status,
    errorMessage,
    resetForm,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
    isError: status === 'error',
  };
}
