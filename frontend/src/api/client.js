import axios from 'axios';

/**
 * The ONLY HTTP client used by this frontend. It is configured with a
 * single baseURL pointing at the Gateway - there is no code anywhere
 * in this app that constructs a URL to cs-service/it-service/entc-service
 * directly. This is a deliberate architectural constraint, not an
 * oversight: React -> Gateway -> CS/IT/ENTC, never React -> department.
 */
const GATEWAY_HTTP_URL =
  import.meta.env.VITE_GATEWAY_HTTP_URL || '';
  
const apiClient = axios.create({
  baseURL: GATEWAY_HTTP_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('campus_jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
export { GATEWAY_HTTP_URL };
