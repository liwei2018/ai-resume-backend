import resumeService from '../services/resumeService.js';
import { success, error, ResponseCode } from '../utils/response.js';

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

      // 映射出文件的可访问 URL
      const urls = req.files.map(file => `http://localhost:8000/uploads/${file.filename}`);
      
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
      const updated = await resumeService.updateStatus(id, status);
      res.status(200).json(success({ currentStatus: updated.status }, '状态更新成功'));
    } catch (err) {
      console.error('状态更新失败:', err);
      res.status(400).json(error(err.message || '状态更新失败', ResponseCode.BAD_REQUEST));
    }
  }

  /**
   * 模块三：岗位匹配评分
   */
  async matchJob(req, res) {
    try {
      const { candidateId, jd } = req.body;
      if (!candidateId || !jd) {
        return res.status(400).json(error('参数缺失', ResponseCode.BAD_REQUEST));
      }
      const scoreResult = await resumeService.matchJobDescription(candidateId, jd);
      res.status(200).json(success(scoreResult, '匹配完成'));
    } catch (err) {
      console.error('岗位匹配失败:', err);
      res.status(500).json(error(err.message || '匹配失败', ResponseCode.SERVER_ERROR));
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
}

export default new ResumeController();
