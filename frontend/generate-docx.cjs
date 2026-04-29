const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, WidthType, BorderStyle, ShadingType, HeadingLevel,
        Column, SectionType } = require("docx");

const border = { style: BorderStyle.SINGLE, size: 6, color: "AAAAAA" };
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 32, font: "Arial", color: "1F4E79" })],
    spacing: { before: 240, after: 120 },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 26, font: "Arial", color: "2E75B6" })],
    spacing: { before: 160, after: 80 },
  });
}

function body(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Arial" })],
    spacing: { after: 80 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Arial" })],
    spacing: { after: 60 },
    indent: { left: 360, hanging: 360 },
    bullet: { level: 0 },
  });
}

function makeTable(headers, rows) {
  const colWidth = 4680;
  const headerCells = headers.map(h =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, size: 22, font: "Arial", color: "FFFFFF" })],
      })],
      width: { size: colWidth, type: WidthType.DXA },
      shading: { fill: "2E75B6", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      borders: { top: border, bottom: border, left: border, right: border },
    })
  );

  const dataRows = rows.map((row, idx) =>
    new TableRow({
      children: row.map(cellText =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: String(cellText), size: 21, font: "Arial" })],
          })],
          width: { size: colWidth, type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
          shading: idx % 2 === 0 ? { fill: "F2F2F2", type: ShadingType.CLEAR } : undefined,
        })
      ),
    })
  );

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [colWidth, colWidth],
    rows: [new TableRow({ children: headerCells }), ...dataRows],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal",
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal",
        quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 1 },
      },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
    },
    children: [

      // 标题
      new Paragraph({
        children: [new TextRun({
          text: "心理测评与咨询系统",
          bold: true, size: 40, font: "Arial", color: "1F4E79",
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({
          text: "项目技术栈说明（比赛报名用）",
          size: 26, font: "Arial", color: "666666",
        })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      }),

      // 一、项目概述
      h1("一、项目概述"),
      body("本项目是一套面向心理健康服务的全栈 Web 应用，集成 AI 心理医生对话、心理测评报告生成、用户与管理员双端管理等功能。系统采用前后端分离架构，前端基于 React 19 + TypeScript 构建，后端基于 FastAPI + PostgreSQL，并通过 Dify 平台接入大模型能力。"),

      // 二、前端技术栈
      h1("二、前端技术栈（Frontend）"),

      h2("2.1 核心框架与路由"),
      makeTable(
        ["技术类别", "技术名称及版本"],
        [
          ["前端框架", "React 19.1.1 + TypeScript 5.9"],
          ["构建工具", "Vite 7.3 + SWC 编译器"],
          ["路由管理", "TanStack Router 1.163（类型安全文件路由）"],
          ["状态/数据请求", "TanStack Query 5.91（React Query）"],
          ["表格处理", "TanStack Table 8.21"],
        ]
      ),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),

      h2("2.2 UI 组件与样式"),
      makeTable(
        ["技术类别", "技术名称及版本"],
        [
          ["UI 组件库", "shadcn/ui（New York 风格）+ Radix UI 原语"],
          ["样式方案", "Tailwind CSS 4.2 + tw-animate-css"],
          ["表单处理", "React Hook Form 7.68 + Zod 4.3（数据校验）"],
          ["图标库", "Lucide React 0.563"],
          ["主题切换", "next-themes 0.4.6"],
          ["提示组件", "Sonner 2.0.7（Toast 通知）"],
        ]
      ),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),

      h2("2.3 开发工具与测试"),
      makeTable(
        ["技术类别", "技术名称及版本"],
        [
          ["代码规范", "Biome 2.3"],
          ["E2E 端到端测试", "Playwright 1.58"],
          ["API 类型生成", "openapi-ts 0.73（根据后端 OpenAPI 规范自动生成前端类型）"],
          ["包管理", "npm / Node.js 22+"],
        ]
      ),

      // 三、后端技术栈
      h1("三、后端技术栈（Backend）"),

      h2("3.1 核心框架与数据库"),
      makeTable(
        ["技术类别", "技术名称及版本"],
        [
          ["编程语言", "Python 3.10+"],
          ["Web 框架", "FastAPI 0.114+"],
          ["ORM", "SQLModel（基于 Pydantic + SQLAlchemy）"],
          ["数据库", "PostgreSQL 14+（psycopg 3.1 驱动）"],
          ["数据库迁移", "Alembic 1.12"],
        ]
      ),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),

      h2("3.2 安全、认证与配置"),
      makeTable(
        ["技术类别", "技术名称及版本"],
        [
          ["用户认证与授权", "PyJWT 2.8 + passlib（Argon2 / bcrypt 密码哈希）"],
          ["配置管理", "Pydantic Settings 2.2"],
          ["异步 HTTP 客户端", "httpx 0.25"],
          ["邮件发送", "emails 0.6 + Jinja2 3.1（密码重置邮件）"],
          ["错误监控", "Sentry SDK 2.0"],
        ]
      ),

      new Paragraph({ children: [new TextRun("")], spacing: { after: 160 } }),

      h2("3.3 开发工具与部署"),
      makeTable(
        ["技术类别", "技术名称及版本"],
        [
          ["代码规范", "Ruff + MyPy（严格模式静态检查）"],
          ["单元测试", "pytest 7.4 + coverage 7.4"],
          ["容器化部署", "Docker + Dockerfile（支持 openEuler 等国产系统）"],
        ]
      ),

      // 四、核心功能技术
      h1("四、核心功能与对应技术"),
      makeTable(
        ["功能模块", "使用技术"],
        [
          ["AI 心理医生对话", "Dify API 接入（大模型对话）"],
          ["心理测评报告生成", "Dify Workflow + FastAPI 后端代理"],
          ["用户/管理员双端分化", "TanStack Router 路由守卫 + 后端权限校验"],
          ["会话历史管理", "FastAPI + PostgreSQL 持久化存储"],
          ["响应式布局", "Tailwind CSS + shadcn/ui 组件"],
          ["暗色/亮色主题切换", "next-themes + CSS 变量（oklch 色彩空间）"],
        ]
      ),

      // 五、系统架构特点
      h1("五、系统架构特点"),
      bullet("前后端完全分离，通过 OpenAPI 规范自动生成前端类型，保障类型安全；"),
      bullet("采用 TanStack Router 文件路由，路由即文件，开发体验优秀；"),
      bullet("使用 SQLModel 作为 ORM，兼具 Pydantic 的数据校验能力与 SQLAlchemy 的灵活查询；"),
      bullet("集成 Dify 大模型平台，实现 AI 心理医生对话与测评报告智能生成；"),
      bullet("前后端均支持 Docker 容器化部署，便于在 openEuler 等国产系统上运行；"),
      bullet("代码规范严格执行（Ruff / Biome），并通过 Playwright 实现端到端自动化测试。"),

      // 六、运行环境
      h1("六、运行环境"),
      makeTable(
        ["环境类别", "说明"],
        [
          ["操作系统", "Windows / Linux / openEuler（Docker 容器化）"],
          ["数据库", "PostgreSQL 14+"],
          ["Node.js 版本", "18+（推荐 20+）"],
          ["Python 版本", "3.10 ~ 3.12"],
          ["容器编排", "Docker + Docker Compose（可选）"],
        ]
      ),

      // 空行 + 页脚说明
      new Paragraph({ children: [new TextRun("")], spacing: { before: 400 } }),
      new Paragraph({
        children: [new TextRun({
          text: "注：本文档由项目代码整理生成，技术版本号为项目实际依赖版本。",
          size: 18, font: "Arial", color: "888888", italics: true,
        })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("技术栈说明_心理测评与咨询系统.docx", buffer);
  console.log("文档已生成：技术栈说明_心理测评与咨询系统.docx");
}).catch(err => {
  console.error("生成失败：", err);
});
