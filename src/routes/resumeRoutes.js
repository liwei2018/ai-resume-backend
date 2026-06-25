import express from 'express';
import multer from 'multer';
import resumeController from '../controllers/resumeController.js';

const router = express.Router();

// 配置 Multer 临时存储（极限开发建议存在本地，线上则对接 OSS/S3）
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    // 严格限制只能上传 PDF
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('仅支持 PDF 格式文件！'), false);
    }
  }
});

// 模块一：批量上传（最多同时支持 5 份）
router.post('/upload', upload.array('files', 5), resumeController.uploadFiles);

// 模块二：SSE 流式解析简历
router.get('/extract/stream', resumeController.streamExtract);

// 模块三：岗位智能匹配打分
router.post('/match', resumeController.matchJob);

// 模块三：SSE 流式岗位匹配
router.post('/match/stream', resumeController.matchJobStream);

// 模块四：候选人看盘列表及状态流转
router.get('/candidates', resumeController.getCandidates);
router.patch('/candidates/:id/status', resumeController.updateStatus);

export default router;