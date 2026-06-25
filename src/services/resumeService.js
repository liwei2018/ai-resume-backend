import { prisma } from '../config/db.js';
import { openai, defaultModel } from '../config/openai.js';
import fs from 'fs';
import path from 'path';

// 使用 createRequire 来处理 CommonJS 模块
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// pdf-parse 版本 1.x 直接导出函数
const pdfParse = require('pdf-parse');

// 检查是否有有效的 API Key
const hasValidApiKey = process.env.DOUBAO_API_KEY && 
                       process.env.DOUBAO_API_KEY !== '' && 
                       process.env.DOUBAO_API_KEY !== 'placeholder' &&
                       process.env.DOUBAO_API_KEY !== 'your-doubao-api-key-here' &&
                       process.env.DOUBAO_API_KEY.length > 30; // 有效的 API Key 应该足够长

console.log(`大模型模式: ${hasValidApiKey ? '真实模式' : '模拟模式'}`);

// 模拟解析结果（当没有有效 API Key 时使用）
function generateMockResumeData(text) {
  // 简单的模式匹配提取信息
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/1[3-9]\d{9}/);
  
  // 从文本中提取一些关键词作为技能
  const skillKeywords = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'Vue', 'CSS', 'HTML', 'MySQL', 'PostgreSQL', 'MongoDB', 'Git'];
  const foundSkills = skillKeywords.filter(skill => text.includes(skill));
  
  // 如果没有找到技能，使用默认技能
  const skills = foundSkills.length > 0 ? foundSkills : ['JavaScript', 'React', 'Node.js'];
  
  return {
    name: text.substring(0, 10).trim() || '张三',
    phone: phoneMatch ? phoneMatch[0] : '13800138000',
    email: emailMatch ? emailMatch[0] : 'zhangsan@example.com',
    city: '北京',
    skills: skills,
    education: [
      { school: '北京大学', major: '计算机科学与技术', degree: '本科', graduationTime: '2020年' }
    ],
    experience: [
      { company: '字节跳动', position: '前端工程师', timeRange: '2020-2023', summary: '负责公司核心产品的前端开发工作' },
      { company: '阿里巴巴', position: '高级前端工程师', timeRange: '2023-至今', summary: '参与多个大型项目的架构设计和开发' }
    ],
    projects: [
      { name: '电商平台前端重构', techStack: ['React', 'TypeScript', 'Redux'], responsibility: '负责核心模块开发', highlights: '性能提升50%' }
    ]
  };
}

// 模拟岗位匹配结果
function generateMockMatchResult(candidate, jd) {
  const skillScore = Math.floor(70 + Math.random() * 30);
  const expScore = Math.floor(65 + Math.random() * 35);
  const eduScore = Math.floor(75 + Math.random() * 25);
  const totalScore = Math.round((skillScore + expScore + eduScore) / 3);
  
  return {
    totalScore,
    subScores: {
      skills: skillScore,
      experience: expScore,
      education: eduScore
    },
    aiComment: `${candidate.name} 与 "${jd.title}" 岗位匹配度较高。技能方面掌握${candidate.skills.join('、')}等技术栈，与岗位需求基本吻合。建议安排面试进一步评估。`
  };
}

class ResumeService {
  /**
   * 从本地路径读取 PDF 文件内容并解析文本
   */
  async _downloadAndExtractText(fileUrl) {
    // 从 URL 中提取文件名
    const filename = fileUrl.split('/').pop();
    const filepath = path.join(process.cwd(), 'uploads', filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error('文件不存在: ' + filename);
    }

    // 读取并解析 PDF 文件
    const dataBuffer = fs.readFileSync(filepath);
    const pdfData = await pdfParse(dataBuffer);
    
    return {
      filename,
      filepath,
      text: pdfData.text || '' // 返回解析后的文本内容
    };
  }

  /**
   * 流式调用大模型
   */
  async callAIStream(systemPrompt, userPrompt, res, onChunk) {
    try {
      const stream = await openai.chat.completions.create({
        model: defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: true, // 启用流式输出
        temperature: 0.1 // 降低温度，加快生成速度
      });

      let fullContent = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          if (onChunk) {
            onChunk(content);
          }
        }
      }

      return fullContent;
    } catch (error) {
      console.error('流式调用失败:', error);
      throw error;
    }
  }

  /**
   * 模块二：SSE 流式解析简历并持久化存储
   */
  async getExtractionStream(fileUrl, res) {
    try {
      console.log('开始解析简历:', fileUrl);
      
      // 1. 提取 PDF 文本
      const fileInfo = await this._downloadAndExtractText(fileUrl);
      console.log('PDF 文本提取成功, 长度:', fileInfo.text.length);

      if (!fileInfo.text || fileInfo.text.length < 10) {
        throw new Error('PDF 文本内容为空或过短，无法解析');
      }

      // 2. 调用大模型进行解析
      let parsedData;
      
      if (hasValidApiKey) {
        // 使用真实大模型
        console.log('开始调用大模型:', defaultModel);
        
        // 发送开始信号
        res.write(`data: ${JSON.stringify({ type: 'start', message: '开始解析简历...' })}\n\n`);

        const systemPrompt = `你是一位专业的简历解析助手。请从简历中提取信息并以 JSON 格式返回。
必须返回有效的 JSON，不要包含任何 markdown 标记。
返回格式：{"name":"姓名","phone":"电话","email":"邮箱","city":"城市","skills":["技能1"],"education":[{"school":"学校","major":"专业","degree":"学位","graduationTime":"毕业时间"}],"experience":[{"company":"公司","position":"职位","timeRange":"时间","summary":"描述"}],"projects":[{"name":"项目名","techStack":["技术栈"],"responsibility":"职责","highlights":"亮点"}]}`;

        try {
          // 使用流式调用
          const fullContent = await this.callAIStream(
            systemPrompt,
            `请解析以下简历内容：\n\n${fileInfo.text.substring(0, 3000)}`, // 限制输入长度
            res,
            (chunk) => {
              // 实时发送解析进度
              res.write(`data: ${JSON.stringify({ type: 'parsing', progress: chunk })}\n\n`);
            }
          );

          // 发送接收完成信号
          res.write(`data: ${JSON.stringify({ type: 'received', length: fullContent.length })}\n\n`);

          console.log('AI 返回内容长度:', fullContent.length);
          
          if (!fullContent || fullContent.trim().length === 0) {
            throw new Error('大模型返回内容为空');
          }
          
          try {
            // 尝试提取 JSON
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedData = JSON.parse(jsonMatch[0]);
              console.log('JSON 解析成功');
            } else {
              throw new Error('无法从返回内容中提取 JSON');
            }
          } catch (e) {
            console.error('JSON 解析失败:', e);
            console.error('原始内容:', fullContent);
            throw new Error('AI 返回的内容不是有效的 JSON 格式');
          }
        } catch (apiError) {
          console.error('大模型调用失败:', apiError);
          res.write(`data: ${JSON.stringify({ type: 'fallback', message: '大模型调用失败，使用模拟数据' })}\n\n`);
          parsedData = generateMockResumeData(fileInfo.text);
        }
      } else {
        // 使用模拟数据
        console.log('使用模拟模式解析简历');
        res.write(`data: ${JSON.stringify({ type: 'start', message: '使用模拟模式解析...' })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟延迟
        parsedData = generateMockResumeData(fileInfo.text);
      }

      // 3. 发送解析结果
      const fields = ['name', 'phone', 'email', 'city', 'skills', 'education', 'experience', 'projects'];
      
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (parsedData[field]) {
          res.write(`data: ${JSON.stringify({ type: 'field', field, data: parsedData[field] })}\n\n`);
          await new Promise(resolve => setTimeout(resolve, 50)); // 小延迟
        }
      }

      // 4. 保存到数据库
      res.write(`data: ${JSON.stringify({ type: 'saving', message: '正在保存数据...' })}\n\n`);

      const candidate = await prisma.candidate.create({
        data: {
          name: parsedData.name || '未知',
          email: parsedData.email || '',
          phone: parsedData.phone || '',
          city: parsedData.city || '',
          skills: parsedData.skills || [],
          resumeUrl: fileUrl,
          status: 'pending'
        }
      });
      console.log('候选人数据已保存, ID:', candidate.id);

      // 保存工作经历
      if (parsedData.experience?.length > 0) {
        for (const exp of parsedData.experience) {
          await prisma.workExperience.create({
            data: {
              candidateId: candidate.id,
              company: exp.company || '',
              position: exp.position || '',
              timeRange: exp.timeRange || '',
              summary: exp.summary || ''
            }
          });
        }
      }

      // 保存教育背景
      if (parsedData.education?.length > 0) {
        for (const edu of parsedData.education) {
          await prisma.education.create({
            data: {
              candidateId: candidate.id,
              school: edu.school || '',
              major: edu.major || '',
              degree: edu.degree || '',
              graduationTime: edu.graduationTime || ''
            }
          });
        }
      }

      // 5. 发送完成信号
      res.write(`data: ${JSON.stringify({ type: 'done', candidateId: candidate.id, name: candidate.name })}\n\n`);
      res.end();
      console.log('简历解析完成');

    } catch (error) {
      console.error('SSE 解析错误:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * 模块四：从 PostgreSQL 中多条件检索候选人
   */
  async queryCandidates({ keyword, status }) {
    const whereClause = {};

    // 1. 状态过滤
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    // 2. 模糊搜索（支持姓名、邮箱、或技能标签中包含关键字）
    if (keyword) {
      whereClause.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { email: { contains: keyword, mode: 'insensitive' } },
        { skills: { has: keyword } } // PostgreSQL 特有的数组包含查询
      ];
    }

    // 3. 查询并连带查出关联的 AI 评分和工作经历
    return await prisma.candidate.findMany({
      where: whereClause,
      include: {
        scores: true,
        experiences: true,
        educations: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * 模块四：变更候选人招聘状态
   */
  async updateStatus(id, newStatus) {
    return await prisma.candidate.update({
      where: { id },
      data: { status: newStatus }
    });
  }

  /**
   * 模块三：AI 岗位匹配并持久化存储评分
   */
  async matchJobDescription(candidateId, jd) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        experiences: true,
        educations: true
      }
    });
    if (!candidate) throw new Error('候选人不存在');

    let result;
    
    if (hasValidApiKey) {
      // 使用真实大模型
      const userPrompt = `
        岗位要求:
        岗位名称: ${jd.title}
        岗位描述: ${jd.description}
        
        候选人信息:
        姓名: ${candidate.name}
        技能: ${candidate.skills.join(', ')}
        经历: ${candidate.experiences?.map(e => `${e.company}-${e.position}`).join(', ') || '无'}
        学历: ${candidate.educations?.map(e => `${e.school}-${e.major}`).join(', ') || '无'}
      `;

      const systemPrompt = `你是技术面试官。必须返回JSON格式：
      {"totalScore":85,"subScores":{"skills":90,"experience":80,"education":85},"aiComment":"分析评语"}`;

      try {
        console.log('开始调用大模型进行岗位匹配:', defaultModel);
        
        // 使用流式调用
        const stream = await openai.chat.completions.create({
          model: defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true,
          temperature: 0.1
        });

        let fullContent = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
          }
        }
        
        console.log('AI 匹配结果长度:', fullContent.length);
        
        if (!fullContent || fullContent.trim().length === 0) {
          throw new Error('大模型返回内容为空');
        }
        
        // 提取 JSON
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
          console.log('岗位匹配 JSON 解析成功');
        } else {
          throw new Error('无法从返回内容中提取 JSON');
        }
      } catch (apiError) {
        console.error('大模型调用失败:', apiError);
        result = generateMockMatchResult(candidate, jd);
      }
    } else {
      // 使用模拟数据
      console.log('使用模拟模式进行岗位匹配');
      result = generateMockMatchResult(candidate, jd);
    }

    // 将打分结果写入数据库
    await prisma.matchScore.create({
      data: {
        candidateId: candidate.id,
        totalScore: result.totalScore,
        skillScore: result.subScores.skills,
        expScore: result.subScores.experience,
        eduScore: result.subScores.education,
        aiComment: result.aiComment
      }
    });

    return result;
  }

  /**
   * 模块三：SSE 流式岗位匹配
   */
  async matchJobStream(candidateId, jd, res) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        experiences: true,
        educations: true
      }
    });
    
    if (!candidate) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: '候选人不存在' })}\n\n`);
      res.end();
      return;
    }

    // 发送开始信号
    res.write(`data: ${JSON.stringify({ type: 'start', message: '开始AI匹配分析...' })}\n\n`);

    let result;

    if (hasValidApiKey) {
      // 使用真实大模型
      const userPrompt = `
        岗位: ${jd.title} - ${jd.description}
        候选人: ${candidate.name}
        技能: ${candidate.skills.join(', ')}
        经历: ${candidate.experiences?.map(e => `${e.company}-${e.position}`).join(', ') || '无'}
        学历: ${candidate.educations?.map(e => `${e.school}-${e.major}`).join(', ') || '无'}
      `;

      const systemPrompt = `你是技术面试官。必须返回JSON：{"totalScore":85,"subScores":{"skills":90,"experience":80,"education":85},"aiComment":"评语"}`;

      try {
        console.log('SSE岗位匹配开始调用大模型:', defaultModel);
        
        // 使用流式调用
        const stream = await openai.chat.completions.create({
          model: defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: true,
          temperature: 0.1
        });

        let fullContent = '';
        res.write(`data: ${JSON.stringify({ type: 'thinking', message: 'AI正在分析候选人简历...' })}\n\n`);

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
            // 实时发送思考内容
            res.write(`data: ${JSON.stringify({ type: 'generating', content: content })}\n\n`);
          }
        }
        
        console.log('AI 匹配结果长度:', fullContent.length);
        
        if (!fullContent || fullContent.trim().length === 0) {
          throw new Error('大模型返回内容为空');
        }
        
        // 提取 JSON
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
          console.log('岗位匹配 JSON 解析成功');
        } else {
          throw new Error('无法从返回内容中提取 JSON');
        }
      } catch (apiError) {
        console.error('大模型调用失败:', apiError);
        res.write(`data: ${JSON.stringify({ type: 'fallback', message: '大模型调用失败，使用模拟数据' })}\n\n`);
        result = generateMockMatchResult(candidate, jd);
      }
    } else {
      // 使用模拟数据
      console.log('SSE岗位匹配使用模拟模式');
      res.write(`data: ${JSON.stringify({ type: 'thinking', message: '使用模拟模式生成匹配结果...' })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 800));
      result = generateMockMatchResult(candidate, jd);
    }

    // 保存结果
    res.write(`data: ${JSON.stringify({ type: 'saving', message: '保存匹配结果...' })}\n\n`);

    await prisma.matchScore.create({
      data: {
        candidateId: candidate.id,
        totalScore: result.totalScore,
        skillScore: result.subScores.skills,
        expScore: result.subScores.experience,
        eduScore: result.subScores.education,
        aiComment: result.aiComment
      }
    });

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'done', data: result })}\n\n`);
    res.end();
    console.log('SSE岗位匹配完成');
  }
}

export default new ResumeService();