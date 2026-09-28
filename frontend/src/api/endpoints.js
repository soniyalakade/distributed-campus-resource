import apiClient from './client';

// --- Auth ---
export const register = (payload) => apiClient.post('/api/auth/register', payload).then((r) => r.data);
export const login = (payload) => apiClient.post('/api/auth/login', payload).then((r) => r.data);

// --- Resources ---
export const searchResources = (name) =>
  apiClient.get('/api/resources/search', { params: { name } }).then((r) => r.data);
export const searchResourcesGrpc = (name) =>
  apiClient.get('/api/resources/search-grpc', { params: { name } }).then((r) => r.data);
export const getResourceById = (id) => apiClient.get(`/api/resources/${id}`).then((r) => r.data);

// --- Reservations ---
export const createReservation = (department, resourceId) =>
  apiClient.post('/api/reservations', { department, resourceId }).then((r) => r.data);
export const cancelReservation = (reservationId, department) =>
  apiClient.delete(`/api/reservations/${reservationId}`, { data: { department } }).then((r) => r.data);
export const getMyReservations = () => apiClient.get('/api/reservations/my').then((r) => r.data);

// --- Admin: department resource management (own department only) ---
export const getAdminDepartmentResources = () => apiClient.get('/api/admin/resources').then((r) => r.data);
export const getAllCampusResources = () => apiClient.get('/api/admin/resources/all').then((r) => r.data);
export const createAdminResource = (payload) => apiClient.post('/api/admin/resources', payload).then((r) => r.data);
export const updateAdminResource = (id, payload) =>
  apiClient.put(`/api/admin/resources/${id}`, payload).then((r) => r.data);
export const deleteAdminResource = (id) => apiClient.delete(`/api/admin/resources/${id}`).then((r) => r.data);
export const getAdminReservations = () => apiClient.get('/api/admin/reservations').then((r) => r.data);

// --- Borrow / Return ---
export const borrowResource = (resourceId, department) =>
  apiClient.post(`/api/resources/${resourceId}/borrow`, { department }).then((r) => r.data);
export const returnResource = (resourceId, department, condition) =>
  apiClient.post(`/api/resources/${resourceId}/return`, { department, condition }).then((r) => r.data);
export const getMyBorrowedResources = () => apiClient.get('/api/borrow/my').then((r) => r.data);

// --- Nodes / Distributed state ---
export const getNodes = () => apiClient.get('/api/nodes').then((r) => r.data);
export const getNodesHealth = () => apiClient.get('/api/nodes/health').then((r) => r.data);
export const getHeartbeat = () => apiClient.get('/api/distributed/heartbeat').then((r) => r.data);
