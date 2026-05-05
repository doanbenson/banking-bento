import axios from 'axios';
import { API_BASE_URL } from '../config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: unwrap ApiEnvelope
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    // Check if response is an ApiEnvelope (has success field)
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) {
        // Replace response.data with unwrapped data.data
        response.data = data.data;
        return response;
      } else {
        // Throw with API error message
        throw new Error(data.error?.message || 'API request failed');
      }
    }
    // Not an ApiEnvelope, pass through
    return response;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
