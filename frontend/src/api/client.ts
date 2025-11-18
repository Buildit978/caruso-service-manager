// src/api/client.ts
import axios from "axios";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

console.log("API base URL:", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// You can use either:
//   import api from "./client";
// or
//   import { api } from "./client";
export { api };
export default api;
