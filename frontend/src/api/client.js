import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

// 60s, not a normal request-latency budget - it's sized for Render's
// free-tier backend cold start (spins down after ~15min idle, first request
// after that can take 30-60s to wake it up). Without a timeout, axios
// defaults to waiting forever: a cold backend + no timeout is what makes a
// slow-but-working request indistinguishable from a truly broken one - the
// UI just spins with no error, ever, until the user gives up. Screens using
// this client also show a "still loading, waking up" notice via
// useSlowLoading() once a request has been pending a few seconds, so the
// wait during a real cold start doesn't look identical to that failure.
const client = axios.create({ baseURL, timeout: 60000 });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('rsa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('rsa_token');
      localStorage.removeItem('rsa_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;
