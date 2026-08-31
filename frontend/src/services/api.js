export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';
const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || '/arko360/contact';

// Helper function to include credentials in all requests
const fetchWithCredentials = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include', // Include httpOnly cookies
    headers: {
      ...options.headers,
      'Content-Type': options.headers?.['Content-Type'] || 'application/json',
    }
  });
};

/**
 * @param {Object} data - Form data to submit
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} data.phone
 * @param {string} data.project_type
 * @param {string} data.message
 * @returns {Promise<Object>}
 */
export async function submitContactForm(data) {
  const response = await fetchWithCredentials(`${API_URL}${CONTACT_ENDPOINT}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Error al enviar el formulario. Intenta nuevamente.');
  }

  return response.json();
}

export async function getSiteConfig() {
  const response = await fetchWithCredentials(`${API_URL}/arko/config`, {
    method: 'GET',
  });

  if (!response.ok) {
    return null; // Silent fail, fallback to defaults
  }
  return response.json();
}

/**
 * Login admin
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function loginArkoAdmin(email, password) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await fetchWithCredentials(`${API_URL}/arko/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Credenciales incorrectas');
  }

  return response.json();
}

/**
 * Login with Google for admin/users
 * @param {string} token - Google OAuth Token
 * @returns {Promise<Object>}
 */
export async function loginGoogleArkoAdmin(token) {
  const response = await fetchWithCredentials(`${API_URL}/arko/auth/login/google`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Error al autenticar con Google');
  }

  return response.json();
}

/**
 * Login for Landing Sites (Cloned Templates)
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function loginLandingSite(email, password) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const response = await fetch(`${API_URL}/arko/landing_sites/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Credenciales incorrectas');
  }

  return response.json();
}

/**
 * Get current Landing Site config
 */
export async function getMyLandingSiteConfig(token) {
  const response = await fetch(`${API_URL}/arko/landing_sites/me/config`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    return null;
  }
  return response.json();
}

/**
 * Update current Landing Site config
 */
export async function updateMyLandingSiteConfig(token, config) {
  const response = await fetch(`${API_URL}/arko/landing_sites/me/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(config)
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error('Error saving config');
  }
  return response.json();
}

/**
 * Get Landing Site posts
 */
export async function getMyLandingSitePosts(token) {
  const response = await fetch(`${API_URL}/arko/landing_sites/me/posts`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    return [];
  }
  return response.json();
}

/**
 * Create Landing Site post
 */
export async function createMyLandingSitePost(token, postData) {
  const response = await fetch(`${API_URL}/arko/landing_sites/me/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(postData)
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error('Error creating post');
  }
  return response.json();
}

/**
 * Update Landing Site post
 */
export async function updateMyLandingSitePost(token, postId, postData) {
  const response = await fetch(`${API_URL}/arko/landing_sites/me/posts/${postId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(postData)
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error('Error updating post');
  }
  return response.json();
}

/**
 * Delete Landing Site post
 */
export async function deleteMyLandingSitePost(token, postId) {
  const response = await fetch(`${API_URL}/arko/landing_sites/me/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    }
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error('Error deleting post');
  }
  return response.json();
}

export async function registerArkoAdmin(email, password, fullName) {
  const response = await fetch(`${API_URL}/arko/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Error al registrarse");
  }
  return response.json();
}

export async function forgotPassword(email) {
  const response = await fetch(`${API_URL}/arko/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Error al solicitar recuperaci�n");
  }
  return response.json();
}

export async function resetPassword(email, code, newPassword) {
  const response = await fetch(`${API_URL}/arko/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, new_password: newPassword })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Error al restablecer contrase�a");
  }
  return response.json();
}

export async function verifyEmail(email, code) {
  const response = await fetch(`${API_URL}/arko/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Error al verificar correo");
  }
  return response.json();
}

export async function resendVerification(email) {
  const response = await fetch(`${API_URL}/arko/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Error al reenviar correo");
  }
  return response.json();
}
