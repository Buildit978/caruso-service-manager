// src/api/client.ts
import axios from 'axios';

console.log('API base URL:', import.meta.env.VITE_API_BASE_URL)  // 👈 add this

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;
