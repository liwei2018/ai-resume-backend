import OpenAI from 'openai';

// 豆包大模型配置（通过火山引擎 API，兼容 OpenAI 格式）
const apiKey = process.env.DOUBAO_API_KEY;
const baseURL = process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
const model = process.env.DOUBAO_MODEL || 'doubao-seed-evolving';

if (!apiKey) {
  console.warn("⚠️ 警告: 未检测到 DOUBAO_API_KEY 环境变量！");
}

export const openai = new OpenAI({
  apiKey: apiKey || 'placeholder',
  baseURL: baseURL,
});

// 导出默认模型名称，供其他模块使用
export const defaultModel = model;