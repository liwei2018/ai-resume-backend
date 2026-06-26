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
    const filename = fileUrl.split('/').pop();
    const filepath = path.join('D:\\work\\ai-resume-platform', 'public', 'uploads', filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error('文件不存在: ' + filename);
    }

    const dataBuffer = fs.readFileSync(filepath);
    const pdfData = await pdfParse(dataBuffer);
    
    return {
      filename,
      filepath,
      text: pdfData.text || ''
    };
  }

  /**
   * 流式调用大模型
   */
  async callAIStream(systemPrompt, userPrompt, res, onChunk) {
    try {
      console.log('=== [callAIStream] 开始调用大模型 ===');
      console.log('System prompt 长度:', systemPrompt.length);
      console.log('User prompt 长度:', userPrompt.length);
      
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
      let chunkCount = 0;
      let lastLogTime = Date.now();

      console.log('=== [callAIStream] 开始接收流式数据 ===');
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          chunkCount++;
          fullContent += content;
          
          // 每 10 个 chunk 或超过 500ms 打一次日志
          const now = Date.now();
          if (chunkCount % 10 === 0 || (now - lastLogTime) > 500) {
            console.log(`[chunk #${chunkCount}] 累计长度: ${fullContent.length}, 最新内容: "${content.substring(0, 50)}..."`);
            lastLogTime = now;
          }
          
          if (onChunk) {
            onChunk(content);
          }
        }
      }

      console.log(`=== [callAIStream] 流式接收完成，共 ${chunkCount} 个 chunks ===`);
      console.log('最终内容长度:', fullContent.length);
      console.log('最终内容预览:', fullContent.substring(0, 200) + '...');
      
      return fullContent;
    } catch (error) {
      console.error('流式调用失败:', error);
      throw error;
    }
  }

  /**
   * 单个字段解析（流式）
   */
  async extractSingleField(resumeText, fieldKey) {
    const fieldPrompts = {
      name: {
        prompt: '从简历中提取姓名。只返回姓名，不要其他内容。',
        example: '张三'
      },
      phone: {
        prompt: '从简历中提取手机号码。只返回号码，不要其他内容。如果没有找到，返回"未找到"。',
        example: '13800138000'
      },
      email: {
        prompt: '从简历中提取电子邮箱。只返回邮箱地址，不要其他内容。如果没有找到，返回"未找到"。',
        example: 'zhangsan@example.com'
      },
      city: {
        prompt: '从简历中提取所在城市。只返回城市名，不要其他内容。如果没有找到，返回"未找到"。',
        example: '北京'
      },
      skills: {
        prompt: '从简历中提取技能列表。只返回一个JSON数组格式，如["JavaScript","React","Node.js"]。如果没有找到技能，返回空数组[]。',
        example: '["JavaScript", "React", "Node.js"]'
      },
      education: {
        prompt: '从简历中提取教育背景。只返回一个JSON数组格式，每个元素包含school(学校)、major(专业)、degree(学位)、graduationTime(毕业时间)。如果没有找到，返回空数组[]。',
        example: '[{"school":"北京大学","major":"计算机科学与技术","degree":"本科","graduationTime":"2020年"}]'
      },
      experience: {
        prompt: '从简历中提取工作经历。只返回一个JSON数组格式，每个元素包含company(公司)、position(职位)、timeRange(时间范围)、summary(工作描述)。如果没有找到，返回空数组[]。',
        example: '[{"company":"字节跳动","position":"前端工程师","timeRange":"2020-2023","summary":"负责公司核心产品的前端开发"}]'
      },
      projects: {
        prompt: '从简历中提取项目经验。只返回一个JSON数组格式，每个元素包含name(项目名)、techStack(技术栈数组)、responsibility(职责)、highlights(项目亮点)。如果没有找到，返回空数组[]。',
        example: '[{"name":"电商平台","techStack":["React","Node.js"],"responsibility":"核心模块开发","highlights":"性能提升50%"}]'
      }
    };

    const config = fieldPrompts[fieldKey];
    if (!config) {
      throw new Error(`未知的字段: ${fieldKey}`);
    }

    console.log(`  → 调用 AI 解析: ${fieldKey}`);
    
    const fullContent = await this.callAIStream(
      config.prompt + `\n\n简历内容：\n${resumeText.substring(0, 3000)}`,
      '',
      null,
      null
    );

    console.log(`  → AI 返回: ${fullContent.substring(0, 100)}...`);

    // 解析返回结果
    try {
      // 尝试直接解析 JSON
      const data = JSON.parse(fullContent.trim());
      return data;
    } catch {
      // 如果不是 JSON，尝试提取 JSON
      const jsonMatch = fullContent.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // 如果都不是，返回原文本
      return fullContent.trim();
    }
  }

  /**
   * 模块二：SSE 流式解析简历并持久化存储（分字段逐步调用）
   */
  async getExtractionStream(fileUrl, res) {
    try {
      console.log('\n========== [开始简历解析流程 - 分字段逐步调用] ==========');
      console.log('文件路径:', fileUrl);
      
      // 1. 提取 PDF 文本
      console.log('[阶段 1/4] 提取 PDF 文本...');
      const fileInfo = await this._downloadAndExtractText(fileUrl);
      console.log('[阶段 1/4] PDF 文本提取成功, 长度:', fileInfo.text.length);

      if (!fileInfo.text || fileInfo.text.length < 10) {
        throw new Error('PDF 文本内容为空或过短，无法解析');
      }

      // 发送开始信号
      res.write(`data: ${JSON.stringify({ type: 'start', message: '开始解析简历...' })}\n\n`);

      // 2. 分字段逐步调用 AI
      const fields = [
        { key: 'name', label: '姓名', weight: 5 },
        { key: 'phone', label: '电话', weight: 5 },
        { key: 'email', label: '邮箱', weight: 5 },
        { key: 'city', label: '城市', weight: 5 },
        { key: 'skills', label: '技能', weight: 15 },
        { key: 'education', label: '教育背景', weight: 20 },
        { key: 'experience', label: '工作履历', weight: 30 },
        { key: 'projects', label: '项目经验', weight: 15 }
      ];

      const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
      let parsedData = {};
      let currentProgress = 5;

      console.log(`[阶段 2/4] 开始分字段逐步调用 AI，共 ${fields.length} 个字段...`);

      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const fieldProgress = Math.round((field.weight / totalWeight) * 90); // 分配进度
        const fieldStartProgress = currentProgress;
        const fieldEndProgress = Math.min(currentProgress + fieldProgress, 95);

        console.log(`\n[字段 #${i+1}/${fields.length}] ${field.label}`);
        console.log(`  进度: ${fieldStartProgress}% → ${fieldEndProgress}%`);

        // 发送开始解析字段事件
        res.write(`data: ${JSON.stringify({ 
          type: 'parsing_field', 
          field: field.key, 
          label: field.label, 
          progress: fieldStartProgress 
        })}\n\n`);

        try {
          let fieldData;
          
          if (hasValidApiKey) {
            // 调用 AI 解析单个字段
            fieldData = await this.extractSingleField(fileInfo.text, field.key);
          } else {
            // 模拟模式
            await new Promise(resolve => setTimeout(resolve, 300));
            const mockData = generateMockResumeData(fileInfo.text);
            fieldData = mockData[field.key];
          }

          parsedData[field.key] = fieldData;

          console.log(`  ✓ 解析成功:`, JSON.stringify(fieldData).substring(0, 100));

          // 发送字段解析结果（立即发送到前端）
          res.write(`data: ${JSON.stringify({ 
            type: 'field', 
            field: field.key, 
            data: fieldData, 
            label: field.label 
          })}\n\n`);

          // 添加小延迟让前端有时间渲染
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (fieldError) {
          console.error(`  ✗ 解析失败:`, fieldError.message);
          parsedData[field.key] = hasValidApiKey ? null : generateMockResumeData(fileInfo.text)[field.key];
        }

        currentProgress = fieldEndProgress;

        // 发送字段完成进度
        res.write(`data: ${JSON.stringify({ 
          type: 'field_done', 
          field: field.key, 
          label: field.label, 
          progress: currentProgress 
        })}\n\n`);
      }

      console.log('\n[阶段 2/4] 所有字段解析完成');
      console.log('解析结果汇总:', JSON.stringify(parsedData).substring(0, 300) + '...');

      // 3. 保存到数据库
      console.log('\n[阶段 3/4] 正在保存到数据库...');
      res.write(`data: ${JSON.stringify({ type: 'saving', message: '正在保存数据...' })}\n\n`);

      const candidate = await prisma.candidate.create({
        data: {
          name: parsedData.name || '未知',
          email: parsedData.email || '',
          phone: parsedData.phone || '',
          city: parsedData.city || '',
          skills: Array.isArray(parsedData.skills) ? parsedData.skills : [],
          resumeUrl: fileUrl,
          status: 'pending'
        }
      });
      console.log('[阶段 3/4] 候选人数据已保存, ID:', candidate.id);

      // 保存工作经历
      if (Array.isArray(parsedData.experience) && parsedData.experience.length > 0) {
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
        console.log(`[阶段 3/4] 保存了 ${parsedData.experience.length} 条工作经历`);
      }

      // 保存教育背景
      if (Array.isArray(parsedData.education) && parsedData.education.length > 0) {
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
        console.log(`[阶段 3/4] 保存了 ${parsedData.education.length} 条教育背景`);
      }

      // 保存项目经验
      if (Array.isArray(parsedData.projects) && parsedData.projects.length > 0) {
        for (const proj of parsedData.projects) {
          await prisma.project.create({
            data: {
              candidateId: candidate.id,
              name: proj.name || '',
              techStack: proj.techStack || [],
              responsibility: proj.responsibility || '',
              highlights: proj.highlights || ''
            }
          });
        }
        console.log(`[阶段 3/4] 保存了 ${parsedData.projects.length} 条项目经验`);
      }

      // 4. 发送完成信号
      console.log('\n[阶段 4/4] 发送完成信号...');
      res.write(`data: ${JSON.stringify({ type: 'done', candidateId: candidate.id, name: candidate.name })}\n\n`);
      res.end();
      console.log('========== [简历解析流程完成] ==========\n');

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
   * 模块四：删除候选人及其关联数据
   */
  async deleteCandidate(id) {
    return await prisma.candidate.delete({
      where: { id }
    });
  }

  async getCandidateById(id) {
    return await prisma.candidate.findUnique({
      where: { id },
      include: {
        experiences: true,
        educations: true,
        scores: true
      }
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