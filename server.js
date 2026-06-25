import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import resumeRoutes from './src/routes/resumeRoutes.js'; // 💡 规则 1：必须带 .js 后缀

// 💡 规则 2：利用 url 模块在 ES Modules 中手动重建 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8000;

// 全局中间件
app.use(cors());                 // 允许 Next.js 前端跨域联调
app.use(express.json());         // 解析前端 httpClient 发来的 JSON 载荷

// 静态资源托管：让前端能够通过 http://localhost:8000/uploads/xxx.pdf 预览和下载简历
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由挂载
app.use('/api', resumeRoutes);

// 兜底 404 路由
app.use((req, res) => {
  res.status(404).json({ code: 404, data: null, msg: '未找到请求的 API 路径' });
});

app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(` 🚀 AI 招聘平台 Express [ES Modules] 后端已就位 `);
  console.log(` 🔗 服务监控终点: http://localhost:${PORT}`);
  console.log(`=================================================\n`);
});