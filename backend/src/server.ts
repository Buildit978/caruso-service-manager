// backend/src/server.ts
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { connectDB } from './config/db';
import customerRoutes from './routes/customers.route';
import workOrderRoutes from './routes/workOrders.route';
import summaryRoutes from './routes/summary.route';
import settingsRouter from "./routes/settings.route";
import invoiceRoutes from './routes/invoice.routes';
import { attachAccountId } from "./middleware/account.middleware";
import vehicleRoutes from "./routes/vehicles.route";


const app = express();

// 🔹 Global middleware
app.use(cors());          // ✅ allow requests from http://localhost:5173
app.use(express.json());
app.use(attachAccountId);

// 🔹 API routes (keep /api prefix to match the frontend)
app.use('/api/customers', customerRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/summary', summaryRoutes);
app.use("/api/settings", settingsRouter);
app.use('/api/invoices', invoiceRoutes);
app.use("/api/vehicles", vehicleRoutes);


// (Optional) health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

connectDB()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`✅ MongoDB connected`);
            console.log(`🚗 Server running at http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to connect to MongoDB', err);
        process.exit(1);
    });
