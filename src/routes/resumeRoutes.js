import express from 'express';
import multer from 'multer';
import resumeController from '../controllers/resumeController.js';

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
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

router.post('/match/stream', resumeController.matchJobStream);

// 模块四：候选人看盘列表及状态流转
router.get('/candidates', resumeController.getCandidates);
router.get('/candidates/:id', resumeController.getCandidateById);
router.patch('/candidates/:id/status', resumeController.updateStatus);
router.delete('/candidates/:id', resumeController.deleteCandidate);

export default router;