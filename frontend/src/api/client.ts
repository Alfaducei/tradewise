import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getPortfolio = () => api.get('/portfolio').then(r => r.data)
export const getTrades = (limit = 50) => api.get(`/portfolio/trades?limit=${limit}`).then(r => r.data)

export const getRecommendations = (status = 'pending') =>
  api.get(`/recommendations?status=${status}`).then(r => r.data)
export const getAllRecommendations = () => api.get('/recommendations/all').then(r => r.data)
export const analyzeSymbol = (symbol: string) =>
  api.post('/recommendations/analyze', { symbol }).then(r => r.data)
export const approveRecommendation = (id: number) =>
  api.post(`/recommendations/${id}/approve`).then(r => r.data)
export const dismissRecommendation = (id: number) =>
  api.post(`/recommendations/${id}/dismiss`).then(r => r.data)

export const getWatchlist = () => api.get('/watchlist').then(r => r.data)
export const addToWatchlist = (symbol: string, asset_class = 'stock') =>
  api.post('/watchlist', { symbol, asset_class }).then(r => r.data)
export const removeFromWatchlist = (symbol: string) =>
  api.delete(`/watchlist/${symbol}`).then(r => r.data)
