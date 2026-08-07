export const getImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  
  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://api.arko360.net/api/v1').replace('/api/v1', '');
  
  if (url.startsWith('/uploads')) {
    return `${apiBase}${url}`;
  }
  if (url.startsWith('uploads')) {
    return `${apiBase}/${url}`;
  }
  
  return url;
};
