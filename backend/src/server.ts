// src/server.ts
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { connectDB } from './config/db';
import customerRoutes from './routes/customers.routes';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Health check route
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});


// Customers API
app.use('/api/customers', customerRoutes);

const startServer = async () => {
    try {
        await connectDB();

        const server = http.createServer(app);
        server.listen(PORT, () => {
            console.log(`🚗 Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

startServer();
