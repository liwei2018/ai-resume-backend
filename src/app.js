import express from 'express';
import cors from 'cors';
import resumeRoutes from './routes/resumeRoutes.js';

const app = express();

// 基础中间件配置
app.use(cors({
  origin: ['http://localhost:3000', 'http://12ppbi6305469.vicp.fun'],
  credentials: true
}));
app.use(express.json());

// 路由挂载打通
app.use('/api', resumeRoutes);

// 全局 404 兜底
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint Not Found' });
});

export default app;