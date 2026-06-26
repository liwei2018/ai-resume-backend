import resumeService from '../services/resumeService.js';
import { success, error, ResponseCode } from '../utils/response.js';
import fs from 'fs';
import path from 'path';

class ResumeController {
  /**
   * 模块二：SSE 流式解析简历
   * SSE 不使用统一响应格式，保持原样
   */
  async streamExtract(req, res) {
    try {
      const { fileUrl } = req.query;
      if (!fileUrl) {
        return res.status(400).json(error('缺少 fileUrl 参数', ResponseCode.BAD_REQUEST));
      }

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 调用服务层进行流式解析
      await resumeService.getExtractionStream(fileUrl, res);
    } catch (error) {
      res.status(500).json(error(error.message, ResponseCode.SERVER_ERROR));
    }
  }

  /**
   * 模块一：批量上传控制器
   */
  async uploadFiles(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json(error('请上传至少一份 PDF 简历', ResponseCode.BAD_REQUEST));
      }

      const uploadDir = path.join('D:\\work\\ai-resume-platform', 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const urls = [];
      for (const file of req.files) {
        const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.pdf`;
        const filePath = path.join(uploadDir, filename);
        
        await fs.promises.writeFile(filePath, file.buffer, { mode: 0o666 });
        
        urls.push(`/uploads/${filename}`);
      }
      
      res.status(200).json(success({ urls }, '上传成功'));
    } catch (err) {
      console.error('上传失败:', err);
      res.status(500).json(error('文件上传失败', ResponseCode.SERVER_ERROR));
    }
  }

  /**
   * 模块四：获取候选人列表
   */
  async getCandidates(req, res) {
    try {
      const { keyword, status } = req.query;
      const data = await resumeService.queryCandidates({ keyword, status });
      res.status(200).json(success(data, '查询成功'));
    } catch (err) {
      console.error('查询候选人失败:', err);
      res.status(500).json(error('查询失败', ResponseCode.SERVER_ERROR));
    }
  }

  /**
   * 模块四：状态变更
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!id || !status) {
        return res.status(400).json(error('参数缺失', ResponseCode.BAD_REQUEST));
      }
      await resumeService.updateStatus(id, status);
      res.status(200).json(success({ success: true }, '状态更新成功'));
    } catch (err) {
      console.error('状态更新失败:', err);
      res.status(500).json(error(err.message || '更新失败', ResponseCode.SERVER_ERROR));
    }
  }

  /**
   * 模块三：SSE 流式岗位匹配
   */
  async matchJobStream(req, res) {
    try {
      const { candidateId, jd } = req.body;
      if (!candidateId || !jd) {
        return res.status(400).json(error('参数缺失', ResponseCode.BAD_REQUEST));
      }

      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 调用服务层进行流式匹配
      await resumeService.matchJobStream(candidateId, jd, res);
    } catch (err) {
      console.error('岗位匹配失败:', err);
      res.status(500).json(error(err.message || '匹配失败', ResponseCode.SERVER_ERROR));
    }
  }

  /**
   * 模块四：删除候选人
   */
  async deleteCandidate(req, res) {
    try {
      const { id } = req.params;
      await resumeService.deleteCandidate(id);
      res.status(200).json(success({ success: true }, '删除成功'));
    } catch (err) {
      console.error('删除候选人失败:', err);
      res.status(500).json(error(err.message || '删除失败', ResponseCode.SERVER_ERROR));
    }
  }

  async getCandidateById(req, res) {
    try {
      const { id } = req.params;
      const data = await resumeService.getCandidateById(id);
      if (!data) {
        return res.status(404).json(error('候选人不存在', ResponseCode.NOT_FOUND));
      }
      res.status(200).json(success(data, '查询成功'));
    } catch (err) {
      console.error('查询候选人失败:', err);
      res.status(500).json(error('查询失败', ResponseCode.SERVER_ERROR));
    }
  }

  /**
   * 模块三：非流式岗位匹配
   */
  async matchJob(req, res) {
    try {
      const { candidateId, jd } = req.body;
      if (!candidateId || !jd) {
        return res.status(400).json(error('参数缺失', ResponseCode.BAD_REQUEST));
      }
      const result = await resumeService.matchJobDescription(candidateId, jd);
      res.status(200).json(success(result, '匹配完成'));
    } catch (err) {
      console.error('岗位匹配失败:', err);
      res.status(500).json(error(err.message || '匹配失败', ResponseCode.SERVER_ERROR));
    }
  }
}

export default new ResumeController();
