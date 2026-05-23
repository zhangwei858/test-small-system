# 小学考试评测系统

> 版本 2.1.0 | FastAPI + PostgreSQL + 原生前端

一个面向小学生（幼儿园至三年级）的在线考试评测系统，支持多种题型、试卷模式、成绩统计、抽奖系统和错题管理。

## 功能特性

- **用户系统**：多用户登录，支持头像和视频展示
- **年级管理**：幼儿园 ~ 三年级分级考试
- **试卷模式**：支持按试卷（如"幼儿园0508"）进行专项练习
- **题型丰富**：选择题、填空题、判断题、计算题、阅读题、识字题
- **自动评分**：Answer 后立即出分，支持庆祝动画（≥90分）
- **错题本**：记录错题，支持重做
- **抽奖系统**：考试积分兑换抽奖机会
- **管理后台**：题库管理、用户管理

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI 0.104+ | 异步 Web 框架 |
| 数据库 | PostgreSQL | 通过 asyncpg 连接池访问 |
| 数据库驱动 | asyncpg 0.29+ | 显式 SQL 直连 |
| 前端 | 原生 HTML5 + CSS3 + JS | 无框架，模块化单页应用 |
| 数据验证 | Pydantic 2.0+ | 请求/响应序列化 |

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd 小学考试题
```

### 2. 配置环境

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kaoshiku
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. 初始化数据库

确保 PostgreSQL 已运行，创建数据库 `kaoshiku`，然后导入 `app/data/init_db.py` 中的建表脚本。

题库源文件位于 `题库/` 目录，可按需导入。

### 4. 安装依赖

```bash
pip install -r requirements.txt
```

### 5. 启动服务

```bash
python run.py
```

服务运行在 `http://localhost:3000`

## 项目结构

```
小学考试题/
├── run.py                  # 启动入口
├── requirements.txt        # Python 依赖
├── .env.example            # 环境变量模板
├── app/                    # 后端核心
│   ├── main.py             # FastAPI 应用入口
│   ├── config/             # 配置（数据库、日志）
│   ├── core/               # 数据库连接池
│   ├── middleware/          # 中间件（性能监控）
│   ├── routers/            # API 路由（9个模块）
│   ├── services/           # 业务逻辑（显式 SQL）
│   ├── schemas/            # Pydantic 数据模型
│   └── data/               # 数据库初始化脚本
├── static/                 # 前端静态资源
│   ├── index.html          # 单页入口
│   ├── css/style.css       # 样式表
│   ├── js/                 # 前端模块（9个）
│   │   ├── state.js        # 状态管理
│   │   ├── api.js          # API 调用
│   │   ├── utils.js        # 工具函数
│   │   ├── exam.js         # 考试核心逻辑
│   │   ├── welcome.js      # 首页/试卷选择
│   │   ├── lottery.js      # 抽奖模块
│   │   ├── manage.js       # 管理后台
│   │   ├── wrong-answers.js # 错题管理
│   │   ├── reading-exam.js  # 阅读题
│   │   └── main.js         # 入口/路由
│   ├── images/             # 用户头像/背景图
│   └── videos/             # 用户视频
└── 题库/                   # 题目导入源文件
```

## API 概览

| 路由 | 说明 |
|------|------|
| `/api/users` | 用户登录/管理 |
| `/api/grades` | 年级管理 |
| `/api/questions` | 题库管理 |
| `/api/types` | 题型管理 |
| `/api/exams` | 考试（开始、提交、结果） |
| `/api/papers` | 试卷管理 |
| `/api/lottery` | 抽奖系统 |
| `/api/prizes` | 奖品管理 |
| `/api/wrong-answers` | 错题管理 |

## License

MIT