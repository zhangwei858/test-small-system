# 小学考试评测系统 — Python 重构设计文档

日期: 2026-05-07

## 1. 概述

将现有 Node.js + Express 后端重构为 Python + FastAPI，保持 API 接口完全兼容，前端零改动。

### 技术选型

| 层次 | 原方案 | 新方案 |
|------|--------|--------|
| 后端框架 | Express 4.x | FastAPI 0.104+ |
| 数据库驱动 | pg (node-postgres) | SQLAlchemy 2.0 + asyncpg |
| 数据校验 | 手动校验 | Pydantic v2 |
| 文件上传 | multer | python-multipart |
| 限流 | express-rate-limit | slowapi |
| 日志 | winston + daily-rotate | logging + TimedRotatingFileHandler |
| 数据库迁移 | 手动 SQL 脚本 | Alembic |
| 配置管理 | dotenv | pydantic-settings |

### 设计原则

1. **API 兼容**：所有接口路径、请求/响应格式与原版一致
2. **分层架构**：Router → Service → Model，职责清晰
3. **类型安全**：Pydantic Schema 覆盖所有请求/响应
4. **异步优先**：全链路 async/await
5. **前端不变**：静态文件直接挂载，零改动

## 2. 项目结构

```
小学考试题/
├── app/                        # Python 后端
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py         # Pydantic Settings
│   │   ├── database.py         # SQLAlchemy async engine
│   │   └── logger.py           # 日志配置
│   ├── models/                 # SQLAlchemy ORM 模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── grade.py
│   │   ├── question_type.py
│   │   ├── question.py
│   │   ├── exam_paper.py
│   │   ├── exam_record.py
│   │   ├── answer_record.py
│   │   ├── wrong_answer.py
│   │   ├── prize.py
│   │   └── lottery_record.py
│   ├── schemas/                # Pydantic 请求/响应模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── question.py
│   │   ├── exam.py
│   │   ├── lottery.py
│   │   ├── prize.py
│   │   └── common.py
│   ├── routers/                # API 路由
│   │   ├── __init__.py
│   │   ├── users.py
│   │   ├── questions.py
│   │   ├── exams.py
│   │   ├── grades.py
│   │   ├── types.py
│   │   ├── papers.py
│   │   ├── lottery.py
│   │   ├── prizes.py
│   │   └── wrong_answers.py
│   ├── services/               # 业务逻辑
│   │   ├── __init__.py
│   │   ├── user_service.py
│   │   ├── question_service.py
│   │   ├── exam_service.py
│   │   ├── lottery_service.py
│   │   ├── prize_service.py
│   │   └── parser_service.py
│   ├── dependencies.py         # 依赖注入
│   └── middleware/
│       ├── __init__.py
│       └── performance.py
├── static/                     # 前端静态文件（原 public/）
│   ├── css/
│   ├── js/
│   ├── images/
│   ├── videos/
│   └── index.html
├── 题库/                       # 题库 TXT 文件
├── uploads/                    # 上传目录
├── logs/                       # 日志目录
├── scripts/
│   ├── init_database.py
│   └── init_prizes.py
├── migrations/                 # Alembic 迁移
├── .env
├── .env.example
├── requirements.txt
├── alembic.ini
└── README.md
```

## 3. 数据模型

### 3.1 数据库表（与原版一致）

```sql
-- users 表
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'examiner' CHECK (role IN ('admin', 'examiner')),
  allowed_grades JSONB DEFAULT '["low", "middle", "high"]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- grades 表
CREATE TABLE grades (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  level VARCHAR(10) NOT NULL CHECK (level IN ('low', 'middle', 'high'))
);

-- question_types 表
CREATE TABLE question_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(200)
);

-- questions 表
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  grade_id INT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  type_id INT NOT NULL REFERENCES question_types(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  options JSONB,
  answer VARCHAR(500) NOT NULL,
  points INT DEFAULT 10 CHECK (points > 0),
  paper_id INT REFERENCES exam_papers(id),
  reading_content TEXT,
  reading_title VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- exam_papers 表
CREATE TABLE exam_papers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade_id INT REFERENCES grades(id) ON DELETE CASCADE,
  source_file VARCHAR(255) UNIQUE,
  question_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- exam_records 表
CREATE TABLE exam_records (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL,
  grade_id INT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  total_score INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL,
  correct_count INT NOT NULL DEFAULT 0,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed'))
);

-- answer_records 表
CREATE TABLE answer_records (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exam_records(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer VARCHAR(500),
  is_correct BOOLEAN NOT NULL,
  points_earned INT NOT NULL CHECK (points_earned >= 0)
);

-- wrong_answers 表
CREATE TABLE wrong_answers (
  id SERIAL PRIMARY KEY,
  user_name VARCHAR(100) NOT NULL,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- prizes 表
CREATE TABLE prizes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  emoji VARCHAR(10),
  color VARCHAR(20),
  base_probability DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- lottery_records 表
CREATE TABLE lottery_records (
  id SERIAL PRIMARY KEY,
  exam_id INT NOT NULL REFERENCES exam_records(id) ON DELETE CASCADE,
  user_name VARCHAR(100) NOT NULL,
  prize_name VARCHAR(100) NOT NULL,
  prize_emoji VARCHAR(10),
  is_redeemed BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 SQLAlchemy ORM 模型映射

每个表对应一个 ORM 模型类，使用 `Mapped` 类型注解。JSONB 字段使用 `JSON` 类型。外键关系通过 `relationship` 定义。

## 4. API 接口清单

所有接口路径与原版完全一致，确保前端零改动。

### 4.1 用户管理 `/api/users`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /login | 登录（自动注册） |
| POST | / | 注册考生 |
| GET | / | 获取用户列表 |
| GET | /:username | 获取用户信息 |
| PUT | /:id | 更新用户 |
| DELETE | /:id | 删除用户 |

### 4.2 题目管理 `/api/questions`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | / | 获取题目列表（分页） |
| GET | /:id | 获取单个题目 |
| POST | / | 创建题目 |
| PUT | /:id | 更新题目 |
| DELETE | /:id | 删除题目 |
| POST | /import | 上传TXT导入 |
| POST | /scan-bank | 扫描题库文件夹 |
| POST | /clear | 清空题库 |
| POST | /reset | 清空并重扫 |

### 4.3 考试管理 `/api/exams`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /start | 开始考试 |
| GET | /:examId | 获取考试状态 |
| POST | /:examId/submit | 提交单题答案 |
| POST | /:examId/submit-all | 批量提交答案 |
| GET | /:examId/result | 完成/获取考试结果 |
| GET | /:examId/answer/:questionId | 获取单题答案 |
| GET | /:examId/details | 获取考试详情 |
| GET | /history | 按用户查询历史 |
| GET | /history/all | 所有考试历史 |

### 4.4 年级/题型/试卷

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /api/grades | 年级列表（含题目数） |
| GET | /api/grades/:id | 单个年级 |
| GET | /api/types | 题型列表 |
| GET | /api/types/:id | 单个题型 |
| GET | /api/papers | 试卷列表 |
| GET | /api/papers/:id | 单个试卷 |

### 4.5 抽奖系统

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/lottery/draw | 抽奖 |
| GET | /api/lottery/records | 用户抽奖记录 |
| GET | /api/lottery/records/all | 所有抽奖记录 |
| PUT | /api/lottery/redeem | 更新兑现状态 |
| POST | /api/lottery/demo | 演示抽奖 |
| GET | /api/prizes | 奖项列表 |
| POST | /api/prizes | 创建奖项 |
| PUT | /api/prizes/:id | 更新奖项 |
| DELETE | /api/prizes/:id | 删除奖项 |
| GET | /api/prizes/dynamic | 动态概率 |

### 4.6 错题本 `/api/wrong-answers`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /user/:userName | 用户错题列表 |
| GET | /user/:userName/count | 错题数量 |
| DELETE | /:id | 删除单条错题 |
| DELETE | /user/:userName | 清空错题本 |
| POST | /practice | 错题练习 |

### 4.7 其他

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /health | 健康检查 |
| GET | /videos/:name | 视频流（Range支持） |

## 5. 核心业务逻辑

### 5.1 TXT 题库解析（parser_service.py）

三种解析模式：

1. **结构化格式**：`=== 题目开始 ===` / `=== 题目结束 ===` 标记
2. **阅读理解格式**：长下划线分隔阅读材料 + 选择题部分
3. **自然格式**：数字编号 + 选项 + 答案的普通试卷格式

年级自动识别规则：
- 包含"幼儿园/幼升小/低年级" → grade_id=1
- 包含"三年级/中年级" → grade_id=2
- 包含"高年级/五年级/六年级" → grade_id=3
- 默认 → grade_id=2

### 5.2 答案判定（exam_service.py）

```
正确答案格式判断：
- 正确/错误 → 判断题，转换为 A/B 匹配
- A-D 单字母 → 选择题，直接匹配
- 其他内容 → 填空题，大写去空格精确匹配
```

### 5.3 抽奖动态概率（prize_service.py）

```
题目数 < 10 时：
  bonus = min((10 - questionCount) * 5, 30)
  默认奖项概率 = min(base_probability + bonus, 95)
  其余奖项保持基础概率
  默认奖项补齐 = 100 - 其余奖项概率之和
```

### 5.4 评分规则

```
accuracy = round(correctCount / totalQuestions * 100)
totalScore = accuracy  (百分制)
celebration = totalScore == 100
```

## 6. 中间件与安全

### 6.1 CORS
- 允许来源：FRONTEND_URL + localhost:3000 + 127.0.0.1:3000
- 允许凭证
- 方法：GET/POST/PUT/DELETE/OPTIONS

### 6.2 限流
- 通用 API：15分钟200次
- 登录：15分钟10次
- 上传：1小时5次

### 6.3 性能监控
- 记录请求耗时
- > 3秒 慢请求告警
- 5xx 错误记录

### 6.4 视频流
- 支持 HTTP Range 请求
- Content-Type: video/mp4
- 缓存策略：public, max-age=3600

## 7. 依赖清单

```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
python-multipart>=0.0.6
slowapi>=0.1.9
python-dotenv>=1.0.0
alembic>=1.12.0
aiofiles>=23.0.0
```

## 8. 启动与部署

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化数据库
python scripts/init_database.py

# 开发模式
uvicorn app.main:app --reload --port 3000

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 3000 --workers 4
```

## 9. 实施顺序

1. 基础框架搭建（config/database/logger/main.py）
2. ORM 模型层（10个模型）
3. Pydantic Schema 层
4. 用户管理模块（router + service）
5. 年级/题型/试卷模块
6. 题目管理模块（含 parser_service）
7. 考试模块
8. 错题本模块
9. 抽奖系统
10. 中间件与安全
11. 数据库初始化脚本
12. 集成测试与前端验证
