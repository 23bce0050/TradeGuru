import axios from "axios";

const api = axios.create({
  // Dev: "/api" (vite proxy -> localhost:5000). Deploy ke baad VITE_API_URL set karna.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
});

// Har request ke saath login token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tg_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token expire ho gaya toh login page par bhejo
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem("tg_token")) {
      localStorage.removeItem("tg_token");
      window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);

// User ko sirf saaf, simple message. Technical detail sirf console mein (developer ke liye).
export function errorText(err) {
  const status = err.response?.status;
  // 4xx = user ki galti (galat password, balance kam...) -> server ka message dikhao
  if (status >= 400 && status < 500 && err.response?.data?.message) return err.response.data.message;

  console.error("[TradeGuru API]", status || err.code, err.config?.url, err.response?.data || err.message);
  if (err.code === "ECONNABORTED") return "This is taking longer than usual. Please try again in a moment.";
  if (!err.response) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "You seem to be offline. Check your connection and try again.";
    return "We couldn’t reach TradeGuru right now. Please try again in a moment.";
  }
  return "Something went wrong on our side. Please try again in a moment.";
}

export default api;
