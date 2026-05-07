const { query } = require('../config/database');
const Question = require('../models/Question');
const Grade = require('../models/Grade');
const QuestionType = require('../models/QuestionType');
const ExamPaper = require('../models/ExamPaper');
const fs = require('fs');
const path = require('path');

exports.getQuestions = async (req, res) => {
  try {
    const { grade_id, type_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const filters = {};
    if (grade_id) filters.grade_id = parseInt(grade_id);
    if (type_id) filters.type_id = parseInt(type_id);

    filters.limit = parseInt(limit);
    filters.offset = parseInt(offset);

    const questions = await Question.findAll(filters);
    const total = await Question.count({ grade_id, type_id });

    res.json({
      code: 200,
      message: 'success',
      data: {
        questions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取题目列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取题目列表失败',
      error: error.message
    });
  }
};

exports.getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        code: 404,
        message: '题目不存在'
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: question
    });
  } catch (error) {
    console.error('获取题目失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取题目失败',
      error: error.message
    });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const { grade_id, type_id, content, options, answer, points } = req.body;

    if (!grade_id || !type_id || !content || !answer) {
      return res.status(400).json({
        code: 400,
        message: '缺少必填字段'
      });
    }

    const question = await Question.create({
      grade_id,
      type_id,
      content,
      options,
      answer,
      points: parseInt(points) || 10
    });

    res.status(201).json({
      code: 201,
      message: '题目创建成功',
      data: question
    });
  } catch (error) {
    console.error('创建题目失败:', error);
    res.status(500).json({
      code: 500,
      message: '创建题目失败',
      error: error.message
    });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { grade_id, type_id, content, options, answer, points } = req.body;

    const question = await Question.update(req.params.id, {
      grade_id,
      type_id,
      content,
      options,
      answer,
      points: parseInt(points) || 10
    });

    if (!question) {
      return res.status(404).json({
        code: 404,
        message: '题目不存在'
      });
    }

    res.json({
      code: 200,
      message: '题目更新成功',
      data: question
    });
  } catch (error) {
    console.error('更新题目失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新题目失败',
      error: error.message
    });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.delete(req.params.id);

    if (!question) {
      return res.status(404).json({
        code: 404,
        message: '题目不存在'
      });
    }

    res.json({
      code: 200,
      message: '题目删除成功',
      data: question
    });
  } catch (error) {
    console.error('删除题目失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除题目失败',
      error: error.message
    });
  }
};

exports.importQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        message: '未上传文件'
      });
    }

    const { grade_id, type_id } = req.body;
    
    if (!grade_id) {
      return res.status(400).json({
        code: 400,
        message: '请选择年级'
      });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const questions = parseTxtFile(fileContent, parseInt(grade_id), type_id ? parseInt(type_id) : null);

    if (questions.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '文件格式错误或未找到有效题目'
      });
    }

    const fileName = req.file.decodedName || req.file.originalname;
    const paperName = fileName.replace(/\.[^/.]+$/, '');

    const existingResult = await query(
      'SELECT * FROM exam_papers WHERE source_file = $1',
      [fileName]
    );
    const existingPaper = existingResult.rows[0];

    let paper;
    if (existingPaper) {
      console.log(`文件 ${fileName} 已存在试卷记录，更新试卷 ID: ${existingPaper.id}`);
      await query('DELETE FROM questions WHERE paper_id = $1', [existingPaper.id]);
      
      await query(
        'UPDATE exam_papers SET grade_id = $1, question_count = 0 WHERE id = $2',
        [parseInt(grade_id), existingPaper.id]
      );
      
      const updatedResult = await query('SELECT * FROM exam_papers WHERE id = $1', [existingPaper.id]);
      paper = updatedResult.rows[0];
    } else {
      console.log(`文件 ${fileName} 不存在试卷记录，创建新试卷`);
      const result = await query(
        'INSERT INTO exam_papers (name, grade_id, source_file, question_count) VALUES ($1, $2, $3, 0) RETURNING *',
        [paperName, parseInt(grade_id), fileName]
      );
      paper = result.rows[0];
    }

    const results = [];
    for (const questionData of questions) {
      try {
        const question = await Question.create({
          ...questionData,
          paper_id: paper.id
        });
        results.push({ success: true, question });
      } catch (error) {
        results.push({ success: false, error: error.message, question: questionData });
      }
    }

    await query(
      'UPDATE exam_papers SET question_count = $1 WHERE id = $2',
      [results.filter(r => r.success).length, paper.id]
    );

    fs.unlinkSync(filePath);

    res.json({
      code: 200,
      message: '导入完成',
      data: {
        success_count: results.filter(r => r.success).length,
        fail_count: results.filter(r => !r.success).length,
        success_list: results.filter(r => r.success).map(r => ({
          content: r.question.content,
          type_name: r.question.type_name,
          points: r.question.points
        })),
        fail_list: results.filter(r => !r.success).map(r => ({
          content: r.question.content,
          error: r.error
        }))
      }
    });
  } catch (error) {
    console.error('导入题目失败:', error);
    res.status(500).json({
      code: 500,
      message: '导入题目失败',
      error: error.message
    });
  }
};

exports.clearQuestionBank = async (req, res) => {
  try {
    console.log('开始清空题库...');
    
    await query('DELETE FROM answer_records');
    console.log('已删除答题记录');
    
    await query('DELETE FROM exam_records');
    console.log('已删除考试记录');
    
    await query('DELETE FROM questions');
    console.log('已删除题目');
    
    await query('UPDATE exam_papers SET question_count = 0');
    console.log('已重置试卷题目计数');

    res.json({
      code: 200,
      message: '题库清空成功',
      data: {}
    });
  } catch (error) {
    console.error('清空题库失败:', error);
    res.status(500).json({
      code: 500,
      message: '清空题库失败',
      error: error.message
    });
  }
};

exports.resetAndRescan = async (req, res) => {
  try {
    console.log('开始重置并重扫题库...');
    
    await query('DELETE FROM answer_records');
    console.log('已删除答题记录');
    
    await query('DELETE FROM exam_records');
    console.log('已删除考试记录');
    
    await query('DELETE FROM questions');
    console.log('已删除题目');
    
    await query('UPDATE exam_papers SET question_count = 0');
    console.log('已重置试卷题目计数');

    const bankPath = path.resolve(__dirname, '../../题库');

    if (!fs.existsSync(bankPath)) {
      return res.status(400).json({
        code: 400,
        message: '题库文件夹不存在'
      });
    }

    const files = fs.readdirSync(bankPath).filter(f => f.endsWith('.txt'));
    console.log(`[扫描题库] 找到文件列表: ${JSON.stringify(files)}`);
    const paperResults = [];

    for (const file of files) {
      console.log(`[扫描题库] 正在处理文件: ${file}`);
      const filePath = path.join(bankPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const questions = parseTxtFile(content);

      const paperName = file.replace(/\.[^/.]+$/, '');
      
      let gradeId = 2;
      if (content.includes('幼儿园') || content.includes('幼升小') || content.includes('低年级')) {
        gradeId = 1;
      } else if (content.includes('三年级') || content.includes('中年级')) {
        gradeId = 2;
      } else if (content.includes('高年级') || content.includes('五年级') || content.includes('六年级')) {
        gradeId = 3;
      }

      const existingResult = await query(
        'SELECT * FROM exam_papers WHERE source_file = $1',
        [file]
      );
      const existingPaper = existingResult.rows[0];

      let paper;
      if (existingPaper) {
        console.log(`文件 ${file} 已存在，更新试卷 ID: ${existingPaper.id}`);
        await query('DELETE FROM questions WHERE paper_id = $1', [existingPaper.id]);
        
        await query(
          'UPDATE exam_papers SET grade_id = $1, question_count = 0 WHERE id = $2',
          [gradeId, existingPaper.id]
        );
        
        const updatedResult = await query('SELECT * FROM exam_papers WHERE id = $1', [existingPaper.id]);
        paper = updatedResult.rows[0];
      } else {
        console.log(`文件 ${file} 不存在，创建新试卷`);
        const result = await query(
          'INSERT INTO exam_papers (name, grade_id, source_file, question_count) VALUES ($1, $2, $3, 0) ON CONFLICT (source_file) DO UPDATE SET grade_id = $2, question_count = 0 RETURNING *',
          [paperName, gradeId, file]
        );
        paper = result.rows[0];
      }

      console.log(`[扫描题库] 文件 ${file}，准备插入 ${questions.length} 道题目`);
      const questionsResults = [];
      for (const questionData of questions) {
        try {
          const question = await Question.create({
            ...questionData,
            paper_id: paper.id
          });
          questionsResults.push({ success: true, question });
        } catch (error) {
          console.log(`[扫描题库] 插入题目失败: ${error.message}`);
          questionsResults.push({ success: false, error: error.message, question: questionData });
        }
      }
      console.log(`[扫描题库] 文件 ${file}，成功插入 ${questionsResults.filter(r => r.success).length} 道题目`);

      await query(
        'UPDATE exam_papers SET question_count = $1 WHERE id = $2',
        [questionsResults.filter(r => r.success).length, paper.id]
      );

      paperResults.push({
        paper,
        file,
        total_questions: questions.length,
        success: questionsResults.filter(r => r.success).length,
        failed: questionsResults.filter(r => !r.success).length,
        questions: questionsResults
      });
    }

    const allSuccessList = [];
    const allFailList = [];
    
    for (const paperResult of paperResults) {
      for (const q of paperResult.questions) {
        if (q.success) {
          allSuccessList.push({
            content: q.question.content,
            type_name: q.question.type_name,
            points: q.question.points
          });
        } else {
          allFailList.push({
            content: q.question.content,
            error: q.error
          });
        }
      }
    }

    res.json({
      code: 200,
      message: '题库重置并重扫完成',
      success_count: allSuccessList.length,
      fail_count: allFailList.length,
      success_list: allSuccessList,
      fail_list: allFailList
    });
  } catch (error) {
    console.error('重置并重扫题库失败:', error);
    res.status(500).json({
      code: 500,
      message: '重置并重扫题库失败',
      error: error.message
    });
  }
};

exports.scanQuestionBank = async (req, res) => {
  try {
    const bankPath = path.resolve(__dirname, '../../题库');

    if (!fs.existsSync(bankPath)) {
      return res.status(400).json({
        code: 400,
        message: '题库文件夹不存在'
      });
    }

    const files = fs.readdirSync(bankPath).filter(f => f.endsWith('.txt'));
    console.log(`[扫描题库] 找到文件列表: ${JSON.stringify(files)}`);
    const paperResults = [];

    for (const file of files) {
      console.log(`[扫描题库] 正在处理文件: ${file}`);
      const filePath = path.join(bankPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const questions = parseTxtFile(content);

      const paperName = file.replace(/\.[^/.]+$/, '');
      
      let gradeId = 2;
      if (content.includes('幼儿园') || content.includes('幼升小') || content.includes('低年级')) {
        gradeId = 1;
      } else if (content.includes('三年级') || content.includes('中年级')) {
        gradeId = 2;
      } else if (content.includes('高年级') || content.includes('五年级') || content.includes('六年级')) {
        gradeId = 3;
      }

      const existingResult = await query(
        'SELECT * FROM exam_papers WHERE source_file = $1',
        [file]
      );
      const existingPaper = existingResult.rows[0];

      let paper;
      if (existingPaper) {
        console.log(`文件 ${file} 已存在，更新试卷 ID: ${existingPaper.id}`);
        await query('DELETE FROM questions WHERE paper_id = $1', [existingPaper.id]);
        
        await query(
          'UPDATE exam_papers SET grade_id = $1, question_count = 0 WHERE id = $2',
          [gradeId, existingPaper.id]
        );
        
        const updatedResult = await query('SELECT * FROM exam_papers WHERE id = $1', [existingPaper.id]);
        paper = updatedResult.rows[0];
      } else {
        console.log(`文件 ${file} 不存在，创建新试卷`);
        const result = await query(
          'INSERT INTO exam_papers (name, grade_id, source_file, question_count) VALUES ($1, $2, $3, 0) ON CONFLICT (source_file) DO UPDATE SET grade_id = $2, question_count = 0 RETURNING *',
          [paperName, gradeId, file]
        );
        paper = result.rows[0];
      }

      console.log(`[扫描题库] 文件 ${file}，准备插入 ${questions.length} 道题目`);
      const questionsResults = [];
      for (const questionData of questions) {
        try {
          const question = await Question.create({
            ...questionData,
            paper_id: paper.id
          });
          questionsResults.push({ success: true, question });
        } catch (error) {
          console.log(`[扫描题库] 插入题目失败: ${error.message}`);
          questionsResults.push({ success: false, error: error.message, question: questionData });
        }
      }
      console.log(`[扫描题库] 文件 ${file}，成功插入 ${questionsResults.filter(r => r.success).length} 道题目`);

      await query(
        'UPDATE exam_papers SET question_count = $1 WHERE id = $2',
        [questionsResults.filter(r => r.success).length, paper.id]
      );

      paperResults.push({
        paper,
        file,
        total_questions: questions.length,
        success: questionsResults.filter(r => r.success).length,
        failed: questionsResults.filter(r => !r.success).length,
        questions: questionsResults
      });
    }

    const allSuccessList = [];
    const allFailList = [];
    
    for (const paperResult of paperResults) {
      for (const q of paperResult.questions) {
        if (q.success) {
          allSuccessList.push({
            content: q.question.content,
            type_name: q.question.type_name,
            points: q.question.points
          });
        } else {
          allFailList.push({
            content: q.question.content,
            error: q.error
          });
        }
      }
    }

    res.json({
      code: 200,
      message: '题库扫描导入完成',
      success_count: allSuccessList.length,
      fail_count: allFailList.length,
      success_list: allSuccessList,
      fail_list: allFailList
    });
  } catch (error) {
    console.error('扫描题库失败:', error);
    res.status(500).json({
      code: 500,
      message: '扫描题库失败',
      error: error.message
    });
  }
};

function parseTxtFile(content, gradeId = null, typeId = null) {
  console.log(`[parseTxtFile] 内容长度: ${content.length}, 指定年级ID: ${gradeId}, 指定题型ID: ${typeId}`);
  if (content.includes('=== 题目开始 ===')) {
    console.log('[parseTxtFile] 使用结构化格式解析');
    return parseStructuredFormat(content, gradeId, typeId);
  }
  if (isReadingComprehension(content)) {
    console.log('[parseTxtFile] 检测到阅读理解格式');
    return parseReadingComprehension(content, gradeId, typeId);
  }
  console.log('[parseTxtFile] 使用自然格式解析');
  return parseNaturalFormat(content, gradeId, typeId);
}

function isReadingComprehension(content) {
  const hasLongSeparator = /_{10,}/.test(content);
  const hasReadingKeyword = content.includes('阅读') && (content.includes('短文') || content.includes('回答问题') || content.includes('阅读理解'));
  const hasChoiceSection = content.includes('选择题');
  return hasLongSeparator && hasReadingKeyword && hasChoiceSection;
}

function parseReadingComprehension(content, specifiedGradeId = null, specifiedTypeId = null) {
  const questions = [];
  let gradeId = specifiedGradeId || 2;

  if (!specifiedGradeId) {
    if (content.includes('幼儿园') || content.includes('幼升小') || content.includes('低年级')) {
      gradeId = 1;
    } else if (content.includes('三年级') || content.includes('中年级')) {
      gradeId = 2;
    } else if (content.includes('高年级') || content.includes('五年级') || content.includes('六年级')) {
      gradeId = 3;
    }
  }

  const pointsMatch = content.match(/每题(\d+)分/);
  const sectionPoints = pointsMatch ? parseInt(pointsMatch[1]) : 20;

  const lines = content.split('\n');
  const longSepLines = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^_{10,}$/.test(trimmed)) {
      longSepLines.push(i);
    }
  }

  let readingContent = '';
  let readingTitle = '';

  if (longSepLines.length >= 2) {
    const startLine = longSepLines[0];
    const endLine = longSepLines[1];
    const passageLines = [];

    for (let i = startLine + 1; i < endLine; i++) {
      passageLines.push(lines[i]);
    }

    const passageText = passageLines.join('\n');

    for (const line of passageLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('　') && !trimmed.startsWith(' ') && trimmed.length < 20 && !trimmed.includes('。') && !trimmed.includes('，')) {
        readingTitle = trimmed;
        break;
      }
    }

    readingContent = passageText
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`[阅读理解] 提取标题: "${readingTitle}"`);
    console.log(`[阅读理解] 提取内容长度: ${readingContent.length}`);
  }

  const choiceSectionIdx = content.indexOf('选择题');
  if (choiceSectionIdx === -1) {
    console.log('[阅读理解] 未找到选择题部分');
    return questions;
  }

  const choiceContent = content.substring(choiceSectionIdx);
  const choiceLines = choiceContent.split('\n');
  let pendingQuestion = null;
  let pendingOptions = [];
  let pendingAnswer = null;

  for (let i = 0; i < choiceLines.length; i++) {
    const line = choiceLines[i].trim();
    if (!line) continue;

    if (line.startsWith('选择题') || line.startsWith('——')) continue;

    const numMatch = line.match(/^\d+\s*[.、．]\s*(.+)/);
    if (numMatch) {
      if (pendingQuestion && pendingOptions.length > 0 && pendingAnswer) {
        questions.push({
          grade_id: gradeId,
          type_id: specifiedTypeId || 5,
          content: pendingQuestion,
          options: JSON.stringify(pendingOptions),
          answer: pendingAnswer,
          points: sectionPoints,
          reading_content: readingContent,
          reading_title: readingTitle
        });
      }

      pendingQuestion = numMatch[1].trim();
      pendingOptions = [];
      pendingAnswer = null;
      continue;
    }

    const answerMatch = line.match(/答案[：:]\s*([A-D])/);
    if (answerMatch && pendingQuestion) {
      pendingAnswer = answerMatch[1];
      continue;
    }

    const inlineOptions = line.match(/^([A-D])\s*[.、．]\s*(.+)/);
    if (inlineOptions && pendingQuestion) {
      const singleLineOptions = line.match(/([A-D])\s*[.、．]\s*([^A-D]+?)(?=\s+[A-D]\s*[.、．]|$)/g);
      if (singleLineOptions && singleLineOptions.length >= 2) {
        for (const opt of singleLineOptions) {
          const m = opt.match(/([A-D])\s*[.、．]\s*(.+)/);
          if (m) {
            pendingOptions.push(`${m[1]}. ${m[2].trim()}`);
          }
        }
      } else {
        pendingOptions.push(`${inlineOptions[1]}. ${inlineOptions[2].trim()}`);
      }
      continue;
    }
  }

  if (pendingQuestion && pendingOptions.length > 0 && pendingAnswer) {
    questions.push({
      grade_id: gradeId,
      type_id: specifiedTypeId || 5,
      content: pendingQuestion,
      options: JSON.stringify(pendingOptions),
      answer: pendingAnswer,
      points: sectionPoints,
      reading_content: readingContent,
      reading_title: readingTitle
    });
  }

  console.log(`[阅读理解] 解析完成，共 ${questions.length} 道题目`);
  return questions;
}

function parseStructuredFormat(content, gradeId = null, typeId = null) {
  const questions = [];
  const blocks = content.split('=== 题目开始 ===').filter(block => block.trim());

  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 4) continue;

    const question = {};
    let gradeName = null;
    let typeName = null;

    lines.forEach(line => {
      if (line.startsWith('题目编号：')) {
        question.id = line.substring('题目编号：'.length);
      } else if (line.startsWith('年级：')) {
        gradeName = line.substring('年级：'.length);
      } else if (line.startsWith('题型：')) {
        typeName = line.substring('题型：'.length);
      } else if (line.startsWith('分值：')) {
        question.points = parseInt(line.substring('分值：'.length)) || 10;
      } else if (line.startsWith('题目：')) {
        question.content = line.substring('题目：'.length);
      } else if (line.startsWith('选项：')) {
        const optionLines = [];
        let inOptions = false;
        for (let i = lines.indexOf(line) + 1; i < lines.length; i++) {
          const optionLine = lines[i];
          if (optionLine.match(/^[A-D]\./)) {
            inOptions = true;
            optionLines.push(optionLine);
          } else if (optionLine.startsWith('正确答案：') || optionLine.startsWith('=== 题目结束 ===')) {
            break;
          } else if (inOptions) {
            optionLines.push(optionLine);
          }
        }
        question.options = optionLines.length > 0 ? JSON.stringify(optionLines) : null;
      } else if (line.startsWith('正确答案：')) {
        question.answer = line.substring('正确答案：'.length);
      }
    });

    if (gradeId) {
      question.grade_id = gradeId;
    } else if (gradeName) {
      switch (gradeName) {
        case '低年级': case '幼儿园': question.grade_id = 1; break;
        case '中年级': case '三年级': question.grade_id = 2; break;
        case '高年级': question.grade_id = 3; break;
      }
    }

    if (typeId) {
      question.type_id = typeId;
    } else if (typeName) {
      switch (typeName) {
        case '选择题': question.type_id = 1; break;
        case '填空题': question.type_id = 2; break;
        case '判断题': question.type_id = 3; break;
        case '计算题': question.type_id = 7; break;
      }
    }

    if (question.grade_id && question.type_id && question.content && question.answer) {
      questions.push({
        grade_id: question.grade_id,
        type_id: question.type_id,
        content: question.content,
        options: question.options || null,
        answer: question.answer,
        points: question.points || 10
      });
    }
  }

  return questions;
}

function parseNaturalFormat(content, specifiedGradeId = null, specifiedTypeId = null) {
  const questions = [];
  let gradeId = specifiedGradeId || 2;

  if (!specifiedGradeId) {
    if (content.includes('幼儿园') || content.includes('幼升小') || content.includes('20以内')) {
      gradeId = 1;
    } else if (content.includes('三年级') || content.includes('中年级')) {
      gradeId = 2;
    } else if (content.includes('高年级') || content.includes('五年级') || content.includes('六年级')) {
      gradeId = 3;
    }
  }

  const isReadingComprehension = content.includes('阅读') && content.includes('短文');
  const isLiteracyQuiz = content.includes('拼音') && content.includes('选择');
  let readingPassage = null;
  let readingTitle = null;

  if (isReadingComprehension) {
    const titleLineMatch = content.match(/^\s{4,}(\S+)\s*$/m);
    if (titleLineMatch) {
      readingTitle = titleLineMatch[1].trim();
    }
    const passageMatch = content.match(/_{3,}[\s\S]*?\n\s*\n([\s\S]+?)\n\s*_{3,}/);
    if (passageMatch) {
      readingPassage = passageMatch[1].trim();
    } else {
      const titleMatch = content.match(/(?:^|\n)\s{0,6}(\S+)\s*\n/);
      if (titleMatch) {
        const titleLine = titleMatch[1];
        const afterTitle = content.substring(content.indexOf(titleLine) + titleLine.length);
        const passageEndMatch = afterTitle.match(/[\s\S]*?(?=选择|答案|第\s*1\s*[.、．])/);
        if (passageEndMatch) {
          let passageText = passageEndMatch[0].trim();
          passageText = passageText.replace(/^_{3,}[\s\S]*?\n/, '').replace(/\n\s*_{3,}$/, '').trim();
          if (passageText.length > 20) {
            readingPassage = passageText;
          }
        }
      }
    }
    if (!readingPassage) {
      const lines = content.split('\n');
      let passageStart = -1;
      let passageEnd = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('___') || lines[i].match(/^\s{4,}\S/)) {
          if (passageStart === -1) passageStart = i;
        }
        if (passageStart !== -1 && passageEnd === -1) {
          if (lines[i].includes('选择') || lines[i].match(/^\d+\s*[.、．]/)) {
            passageEnd = i;
            break;
          }
        }
      }
      if (passageStart !== -1 && passageEnd !== -1 && passageEnd > passageStart) {
        let passageLines = lines.slice(passageStart, passageEnd);
        passageLines = passageLines.filter(l => !l.trim().startsWith('___'));
        readingPassage = passageLines.join('\n').trim();
      }
    }
    console.log(`[阅读理解] 检测到阅读理解题，短文长度: ${readingPassage ? readingPassage.length : 0}`);
  }

  const lines = content.split('\n');
  let currentSection = '';
  let sectionPoints = 10;
  let pendingQuestion = null;
  let pendingOptions = [];
  let pendingAnswer = null;
  let pendingReadingContent = null;
  let pendingReadingTitle = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('——') || line.startsWith('──') || line.match(/^─+$/) || line.match(/^—+$/)) continue;

    const sectionMatch = line.match(/^[一二三四五六七八九十]+[、．.]\s*(.+?)(?:[。：:]|（|\(|$)/);
    if (sectionMatch) {
      if (pendingQuestion && pendingOptions.length > 0 && pendingAnswer) {
        const questionTypeId = determineQuestionTypeId(currentSection, specifiedTypeId, isLiteracyQuiz, isReadingComprehension);
        questions.push({
          grade_id: gradeId,
          type_id: questionTypeId,
          content: pendingQuestion,
          options: pendingOptions.length > 0 ? JSON.stringify(pendingOptions) : null,
          answer: pendingAnswer,
          points: sectionPoints,
          reading_content: pendingReadingContent, reading_title: pendingReadingTitle
        });
        pendingQuestion = null;
        pendingOptions = [];
        pendingAnswer = null;
        pendingReadingContent = null;
        pendingReadingTitle = null;
      }

      currentSection = sectionMatch[1].trim();
      const pointsMatch = line.match(/每[题空](?:\s*[（(])?\s*(\d+)\s*分/);
      if (pointsMatch) {
        sectionPoints = parseInt(pointsMatch[1]);
      } else {
        sectionPoints = 10;
      }
      console.log(`解析到题型: "${currentSection}"，分值: ${sectionPoints}分`);
      continue;
    }

    const bareSectionMatch = line.match(/^[（(]\s*每[题空]\s*(\d+)\s*分/);
    if (bareSectionMatch) {
      sectionPoints = parseInt(bareSectionMatch[1]);
      if (!currentSection) {
        if (isLiteracyQuiz) currentSection = '识字';
        else if (isReadingComprehension) currentSection = '阅读选择';
        else currentSection = '选择';
      }
      console.log(`解析到无序号题型，当前: "${currentSection}"，分值: ${sectionPoints}分`);
      continue;
    }

    const readingSectionMatch = line.match(/^选择[题]?[（(].*[）)]$/);
    if (readingSectionMatch && !currentSection.includes('选择')) {
      currentSection = '选择';
      const pointsInLine = line.match(/每[题空]\s*(\d+)\s*分/);
      if (pointsInLine) sectionPoints = parseInt(pointsInLine[1]);
      console.log(`解析到阅读选择题标题，分值: ${sectionPoints}分`);
      continue;
    }

    const shouldProcessType = !specifiedTypeId || 
      (specifiedTypeId === 7 && (currentSection.includes('写得数') || currentSection.includes('计算') || currentSection.includes('竖式') || currentSection.includes('脱式') || currentSection.includes('连加') || currentSection.includes('口算') || currentSection.includes('数学'))) ||
      (specifiedTypeId === 1 && currentSection.includes('选择')) ||
      (specifiedTypeId === 3 && currentSection.includes('判断')) ||
      (specifiedTypeId === 2 && (currentSection.includes('填空') || currentSection.includes('填一填'))) ||
      (specifiedTypeId === 8 && (currentSection.includes('识字') || currentSection.includes('拼音'))) ||
      (specifiedTypeId === 5 && (currentSection.includes('阅读') || currentSection.includes('选择')));

    if (!shouldProcessType && currentSection) {
      continue;
    }

    if (currentSection.includes('写得数') || currentSection.includes('计算') || currentSection.includes('竖式') || currentSection.includes('脱式') || currentSection.includes('连加') || currentSection.includes('口算') || currentSection.includes('数学')) {
      const questionTypeId = specifiedTypeId || 7;
      console.log(`[计算题] 当前题型: "${currentSection}"，行长度: ${line.length}，行: "${line}"`);
      const calcMatchWithNumber = line.match(/^\d+\s*[.、．]\s*([\d\s+\-×÷*/.()]+?)\s*=\s*[（(]\s*(\S+)\s*[）)]/);
      console.log(`  calcMatchWithNumber: ${calcMatchWithNumber}`);
      if (calcMatchWithNumber) {
        const expression = calcMatchWithNumber[1].trim();
        const answer = calcMatchWithNumber[2].trim();

        if (expression.length >= 3) {
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: `${expression} = ______`,
            options: null,
            answer: answer,
            points: sectionPoints,
            reading_content: null, reading_title: null
          });
        }
        continue;
      }

      const calcMatchSimple = line.match(/^\d+\s*[.、．]\s*([\d\s+\-×÷*/.]+?)\s*=\s*(\S+)$/);
      if (calcMatchSimple) {
        const expression = calcMatchSimple[1].trim();
        const answer = calcMatchSimple[2].trim();

        if (expression.length >= 3) {
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: `${expression} = ______`,
            options: null,
            answer: answer,
            points: sectionPoints,
            reading_content: null, reading_title: null
          });
        }
        continue;
      }

      const calcMatchNoNumber = line.match(/^([\d\s+\-×÷*/.()\u00d7xX]+?)\s*=\s*(\S+)$/);
      console.log(`  calcMatchNoNumber: ${calcMatchNoNumber}`);
      if (calcMatchNoNumber) {
        const expression = calcMatchNoNumber[1].trim();
        const answer = calcMatchNoNumber[2].trim();
        console.log(`  expression: "${expression}", answer: "${answer}", condition: ${expression.length >= 3 && !line.startsWith('(')}`);

        if (expression.length >= 3 && !line.startsWith('(')) {
          console.log(`  添加题目: ${expression} = ______, answer: ${answer}`);
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: `${expression} = ______`,
            options: null,
            answer: answer,
            points: sectionPoints,
            reading_content: null, reading_title: null
          });
        }
        continue;
      }

      const calcMatchNoNumberBracket = line.match(/^([\d\s+\-×÷*/.()]+?)\s*=\s*[（(]\s*(\S+)\s*[）)]$/);
      if (calcMatchNoNumberBracket) {
        const expression = calcMatchNoNumberBracket[1].trim();
        const answer = calcMatchNoNumberBracket[2].trim();

        if (expression.length >= 3) {
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: `${expression} = ______`,
            options: null,
            answer: answer,
            points: sectionPoints,
            reading_content: null, reading_title: null
          });
        }
        continue;
      }

      const calcMatchNoNumBracketWithSpace = line.match(/^([\d\s+\-×÷*/.()]+?)\s*=\s*[（(]\s+(\S+)\s+[）)]$/);
      if (calcMatchNoNumBracketWithSpace) {
        const expression = calcMatchNoNumBracketWithSpace[1].trim();
        const answer = calcMatchNoNumBracketWithSpace[2].trim();

        if (expression.length >= 3) {
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: `${expression} = ______`,
            options: null,
            answer: answer,
            points: sectionPoints,
            reading_content: null, reading_title: null
          });
        }
        continue;
      }

      if (line.match(/^\(\d+\)$/)) {
        continue;
      }
    }

    if (currentSection.includes('选择') || currentSection.includes('识字') || currentSection.includes('拼音') || currentSection.includes('阅读')) {
      const questionTypeId = determineQuestionTypeId(currentSection, specifiedTypeId, isLiteracyQuiz, isReadingComprehension);
      const numMatch = line.match(/^\d+\s*[.、．]/);
      if (numMatch) {
        if (pendingQuestion && pendingOptions.length > 0 && pendingAnswer) {
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: pendingQuestion,
            options: JSON.stringify(pendingOptions),
            answer: pendingAnswer,
            points: sectionPoints,
            reading_content: pendingReadingContent, reading_title: pendingReadingTitle
          });
        } else if (pendingQuestion && pendingOptions.length > 0 && !pendingAnswer) {
          pendingAnswer = 'A';
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: pendingQuestion,
            options: JSON.stringify(pendingOptions),
            answer: pendingAnswer,
            points: sectionPoints,
            reading_content: pendingReadingContent, reading_title: pendingReadingTitle
          });
        }
        
        pendingQuestion = line.substring(numMatch[0].length).trim();
        pendingOptions = [];
        pendingAnswer = null;
        pendingReadingContent = (isReadingComprehension && readingPassage) ? readingPassage : null;
        pendingReadingTitle = (isReadingComprehension && readingTitle) ? readingTitle : null;
        continue;
      }

      const optionMatch = line.match(/^[A-D]\s*[.．、]\s*(.+)/);
      if (optionMatch) {
        const inlineOptions = line.match(/[A-D]\s*[.．、]\s*[^A-D]+/g);
        if (inlineOptions && inlineOptions.length > 1) {
          inlineOptions.forEach(opt => pendingOptions.push(opt.trim()));
        } else {
          pendingOptions.push(line.trim());
        }
        continue;
      }

      const answerWithParens = line.match(/答案[：:]\s*[（(]\s*([A-D])\s*[）)]/);
      if (answerWithParens && pendingQuestion) {
        pendingAnswer = answerWithParens[1];
        questions.push({
          grade_id: gradeId,
          type_id: questionTypeId,
          content: pendingQuestion,
          options: pendingOptions.length > 0 ? JSON.stringify(pendingOptions) : null,
          answer: pendingAnswer,
          points: sectionPoints,
          reading_content: pendingReadingContent, reading_title: pendingReadingTitle
        });
        pendingQuestion = null;
        pendingOptions = [];
        pendingAnswer = null;
        pendingReadingContent = null;
        pendingReadingTitle = null;
        continue;
      }

      const answerNoParens = line.match(/答案[：:]\s*([A-D])(?:[（(]|$|\s)/);
      if (answerNoParens && pendingQuestion) {
        pendingAnswer = answerNoParens[1];
        questions.push({
          grade_id: gradeId,
          type_id: questionTypeId,
          content: pendingQuestion,
          options: pendingOptions.length > 0 ? JSON.stringify(pendingOptions) : null,
          answer: pendingAnswer,
          points: sectionPoints,
          reading_content: pendingReadingContent, reading_title: pendingReadingTitle
        });
        pendingQuestion = null;
        pendingOptions = [];
        pendingAnswer = null;
        pendingReadingContent = null;
        pendingReadingTitle = null;
        continue;
      }

      const inlineAnswerMatch = line.match(/[（(]\s*([A-D])\s*[）)]/);
      if (inlineAnswerMatch) {
        const answer = inlineAnswerMatch[1];
        const optionsStr = line.substring(line.indexOf(inlineAnswerMatch[0]) + inlineAnswerMatch[0].length).trim();
        
        let questionContent = line.replace(/\s*[（(]\s*[A-D]\s*[）)]\s*/, ' （ ）').trim();
        if (questionContent.length < 5) {
          questionContent = line.trim();
        }
        
        const options = [];
        const optPattern = /([A-D])[.．]\s*([^.．\n]+?)(?=\s+[A-D][.．]|$)/g;
        let optMatch;
        while ((optMatch = optPattern.exec(optionsStr)) !== null) {
          options.push(`${optMatch[1]}. ${optMatch[2].trim()}`);
        }
        
        questions.push({
          grade_id: gradeId,
          type_id: questionTypeId,
          content: questionContent,
          options: options.length >= 2 ? JSON.stringify(options) : null,
          answer: answer,
          points: sectionPoints,
          reading_content: (isReadingComprehension && readingPassage) ? readingPassage : null,
          reading_title: (isReadingComprehension && readingTitle) ? readingTitle : null
        });
        continue;
      }
    }

    if (currentSection.includes('判断')) {
      const questionTypeId = specifiedTypeId || 3;
      const judgeMatch = line.match(/^\d+\s*[.、．]\s*(.+?)\s*[（(]\s*([√×✓✗对错TF])\s*[）)]/);
      if (judgeMatch) {
        let answer = judgeMatch[2];
        if (answer === '√' || answer === '✓' || answer === '对' || answer === 'T') answer = '正确';
        if (answer === '×' || answer === '✗' || answer === '错' || answer === 'F') answer = '错误';

        questions.push({
          grade_id: gradeId,
          type_id: questionTypeId,
          content: judgeMatch[1].trim(),
          options: JSON.stringify(['A. 正确', 'B. 错误']),
          answer: answer,
          points: sectionPoints,
          reading_content: null, reading_title: null
        });
        continue;
      }
    }

    if (currentSection.includes('填空') || currentSection.includes('填一填')) {
      const questionTypeId = specifiedTypeId || 2;
      const arrowAnswerMatch = line.match(/→\s*答案[：:]\s*(\S+)/);
      const bracketAnswerMatch = line.match(/[（(]\s*(\S+?)\s*[）)]/);
      
      if (arrowAnswerMatch || bracketAnswerMatch) {
        const answer = arrowAnswerMatch ? arrowAnswerMatch[1].trim() : bracketAnswerMatch[1].trim();
        const numMatch = line.match(/^\d+\s*[.、．]/);
        
        let questionContent = numMatch ? line.substring(numMatch[0].length) : line;
        questionContent = questionContent.replace(/→\s*答案[：:]\s*\S+/, '').trim();
        questionContent = questionContent.replace(/[（(]\s*\S+?\s*[）)]/g, '(      )').trim();

        if (questionContent.length >= 5) {
          questions.push({
            grade_id: gradeId,
            type_id: questionTypeId,
            content: questionContent,
            options: null,
            answer: answer,
            points: sectionPoints,
            reading_content: null, reading_title: null
          });
        }
        continue;
      }
    }
  }

  if (pendingQuestion && pendingOptions.length > 0) {
    const questionTypeId = determineQuestionTypeId(currentSection, specifiedTypeId, isLiteracyQuiz, isReadingComprehension);
    if (!pendingAnswer) pendingAnswer = 'A';
    questions.push({
      grade_id: gradeId,
      type_id: questionTypeId,
      content: pendingQuestion,
      options: JSON.stringify(pendingOptions),
      answer: pendingAnswer,
      points: sectionPoints,
      reading_content: pendingReadingContent, reading_title: pendingReadingTitle
    });
  }

  console.log(`[parseNaturalFormat] 返回题目数量: ${questions.length}`);
  return questions;
}

function determineQuestionTypeId(section, specifiedTypeId, isLiteracyQuiz, isReadingComprehension) {
  if (specifiedTypeId) return specifiedTypeId;
  if (section.includes('识字') || section.includes('拼音')) return 8;
  if (section.includes('阅读') || (isReadingComprehension && section.includes('选择'))) return 5;
  if (section.includes('选择')) return 1;
  if (section.includes('判断')) return 3;
  if (section.includes('填空') || section.includes('填一填')) return 2;
  if (section.includes('写得数') || section.includes('计算') || section.includes('口算')) return 7;
  return 1;
}
