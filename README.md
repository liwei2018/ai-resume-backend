# AI Resume Backend

AI 简历解析平台的后端服务，提供简历上传、大模型解析、候选人管理和岗位匹配 API。

## 📋 项目简介

后端服务基于 Express 框架，集成豆包大模型（火山引擎）和 PostgreSQL 数据库，提供完整的简历解析与人才匹配能力。核心特性包括分字段逐步调用 AI 实现真正的流式解析体验。

## 🏗️ 项目架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Express 应用                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │   Router     │  │  Controller  │  │    Service       │       │
│  │  路由层      │  │  控制层      │  │    业务层        │       │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘       │
│         │                 │                   │                  │
│         └─────────────────┼───────────────────┘                  │
│                           ▼                                      │
│  ┌───────────────────────────────────────────────┐               │
│  │           AI Service (Doubao API)             │               │
│  │           PDF Parser (pdf-parse)              │               │
│  └───────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                           │ PostgreSQL
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    数据库 (Prisma ORM)                           │
│  ┌───────────┐ ┌──────────────┐ ┌───────────┐ ┌─────────────┐  │
│  │ Candidate │ │Experience   │ │Education  │ │MatchScore  │  │
│  └───────────┘ └──────────────┘ └───────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **Express** | 5.x | Web 框架 |
| **Prisma** | 5.x | ORM 工具 |
| **PostgreSQL** | 16+ | 数据库 |
| **openai** | 6.x | 大模型客户端 |
| **pdf-parse** | 1.1.1 | PDF 解析 |
| **multer** | 2.x | 文件上传 |
| **cors** | 2.x | 跨域处理 |

## 🚀 本地开发

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 16.0

### 安装步骤

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件
```

### 环境变量配置

```env
# 服务器配置
PORT=8000

# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"

# 大模型配置（火山引擎）
DOUBAO_API_KEY="your-api-key"
DOUBAO_MODEL="doubao-seed-evolving"
DOUBAO_API_BASE="https://ark.cn-beijing.volces.com/api/v3"

# 文件上传目录（相对于前端项目的 public/uploads）
UPLOAD_DIR="../ai-resume-platform/public/uploads"
```

### 数据库迁移

```bash
# 创建数据库表
npx prisma migrate dev

# 查看数据库
npx prisma studio
```

### 启动服务

```bash
# 开发模式
npm start

# 服务运行在 http://localhost:8000
```

## 🔧 API 接口

### 模块一：简历上传

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/upload` | POST | 上传 PDF 简历文件 |

### 模块二：简历解析（分字段逐步调用 AI）

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/extract/stream` | POST | SSE 流式解析简历 |

#### SSE 事件类型

| 事件类型 | 说明 | 数据结构 |
|----------|------|----------|
| `start` | 开始解析 | `{message}` |
| `parsing_field` | 开始解析字段 | `{field, label, progress}` |
| `field` | 字段解析完成 | `{field, data, label}` |
| `field_done` | 字段发送完成 | `{field, label, progress}` |
| `saving` | 保存数据中 | `{message}` |
| `done` | 解析完成 | `{candidateId, name}` |
| `error` | 解析失败 | `{error}` |

#### 字段解析顺序

1. 姓名 → 2. 电话 → 3. 邮箱 → 4. 城市 → 5. 技能 → 6. 教育背景 → 7. 工作履历 → 8. 项目经验

每个字段独立调用一次 AI，解析完成后立即发送到前端，实现真正的逐步渲染效果。

### 模块三：候选人管理

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/candidates` | GET | 获取候选人列表 |
| `/api/candidates/:id` | GET | 获取候选人详情 |
| `/api/candidates/:id/status` | PUT | 更新状态 |
| `/api/candidates/:id` | DELETE | 删除候选人 |

### 模块四：岗位匹配

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/match` | POST | 岗位匹配评分 |
| `/api/match/stream` | POST | SSE 流式匹配 |

## 📊 数据库模型

### Candidate（候选人）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| name | String | 姓名 |
| phone | String | 电话 |
| email | String | 邮箱 |
| city | String | 城市 |
| status | String | 状态 |
| resumeUrl | String | 简历路径 |
| skills | String[] | 技能标签 |
| createdAt | DateTime | 创建时间 |

### WorkExperience（工作经历）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| candidateId | String | 候选人 ID |
| company | String | 公司名称 |
| position | String | 职位 |
| timeRange | String | 时间范围 |
| summary | String | 工作描述 |

### Education（教育背景）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| candidateId | String | 候选人 ID |
| school | String | 学校 |
| major | String | 专业 |
| degree | String | 学历 |
| graduationTime | String | 毕业时间 |

### Project（项目经验）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| candidateId | String | 候选人 ID |
| name | String | 项目名称 |
| techStack | String[] | 技术栈 |
| responsibility | String | 职责 |
| highlights | String | 项目亮点 |

### MatchScore（匹配评分）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| candidateId | String | 候选人 ID |
| totalScore | Int | 综合得分 |
| skillScore | Int | 技能得分 |
| expScore | Int | 经验得分 |
| eduScore | Int | 学历得分 |
| aiComment | String | AI 评语 |

## 📦 项目结构

```
ai-resume-backend/
├── src/
│   ├── config/          # 配置文件
│   │   ├── db.js        # 数据库配置
│   │   └── openai.js    # 大模型配置
│   ├── controllers/     # 控制器
│   │   └── resumeController.js
│   ├── routes/          # 路由
│   │   └── resumeRoutes.js
│   ├── services/        # 服务层
│   │   └── resumeService.js
│   ├── utils/           # 工具函数
│   │   └── response.js  # 统一响应
│   └── app.js           # 应用入口
├── prisma/              # Prisma 配置
│   └── schema.prisma    # 数据模型
├── server.js            # 服务启动文件
├── package.json
└── .env                 # 环境变量
```

## 🎯 关键特性

### SSE 流式输出
- 简历解析和岗位匹配支持 SSE 实时进度反馈
- 事件类型：start、parsing_field、field、field_done、saving、done、error

### 分字段逐步调用 AI
- 简历解析时，每个字段独立调用一次 AI
- 实现真正的"边思考边输出"效果
- 用户可以看到字段逐个解析并逐步渲染到页面
- 共 8 个字段，按顺序依次调用

### 模拟模式
- 当 API Key 无效时自动切换到模拟数据模式
- 确保开发环境稳定运行

### 统一响应格式
- 所有接口返回 `{code, data, msg}` 格式
- 方便前端统一处理

### 详细日志输出
- 后端打印详细的执行日志
- 包括每个字段的调用状态、返回结果
- 便于调试和问题排查

## 📝 开发注意事项

1. **大模型 API Key**：需在火山引擎控制台获取
2. **PDF 解析**：使用 pdf-parse 1.1.1 版本，CommonJS 模块
3. **文件上传**：PDF 文件存储在前端项目的 `public/uploads` 目录
4. **CORS**：开发环境允许本地访问，生产环境需配置具体域名
5. **日志查看**：后端启动后，上传简历可看到详细的字段解析日志

## 📄 许可证

MIT License