# AI Resume Backend

AI 简历解析平台的后端服务，提供简历上传、大模型解析、候选人管理和岗位匹配 API。

## 📋 项目简介

后端服务基于 Express 框架，集成豆包大模型（火山引擎）和 PostgreSQL 数据库，提供完整的简历解析与人才匹配能力。

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

# 文件上传目录
UPLOAD_DIR="./uploads"
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

### 模块二：简历解析

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/extract/stream` | POST | SSE 流式解析简历 |

### 模块三：候选人管理

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/candidates` | GET | 获取候选人列表 |
| `/api/candidates/:id` | GET | 获取候选人详情 |
| `/api/candidates/:id/status` | PUT | 更新状态 |

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
├── uploads/             # 上传文件目录
├── server.js            # 服务启动文件
├── package.json
└── .env                 # 环境变量
```

## 🎯 关键特性

### SSE 流式输出
- 简历解析和岗位匹配支持 SSE 实时进度反馈
- 事件类型：start、parsing、field、saving、done、error

### 模拟模式
- 当 API Key 无效时自动切换到模拟数据模式
- 确保开发环境稳定运行

### 统一响应格式
- 所有接口返回 `{code, data, msg}` 格式
- 方便前端统一处理

## 📝 开发注意事项

1. **大模型 API Key**：需在火山引擎控制台获取
2. **PDF 解析**：使用 pdf-parse 1.1.1 版本，CommonJS 模块
3. **文件上传**：PDF 文件存储在 `uploads` 目录
4. **CORS**：开发环境允许本地访问，生产环境需配置具体域名

## 📄 许可证

MIT License
