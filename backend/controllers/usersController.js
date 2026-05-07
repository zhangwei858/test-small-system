const User = require('../models/User');

exports.login = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        code: 400,
        message: '请输入用户名'
      });
    }

    let user = await User.findByUsername(username);

    if (!user) {
      user = await User.create({ username, role: 'examiner', allowedGrades: ['low', 'middle', 'high'] });
    }

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        allowed_grades: user.allowed_grades
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      code: 500,
      message: '登录失败',
      error: error.message
    });
  }
};

exports.registerExaminer = async (req, res) => {
  try {
    const { username, allowedGrades } = req.body;

    if (!username) {
      return res.status(400).json({
        code: 400,
        message: '请输入用户名'
      });
    }

    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        code: 400,
        message: '用户名已存在'
      });
    }

    const user = await User.create({
      username,
      role: 'examiner',
      allowedGrades: allowedGrades || ['low', 'middle', 'high']
    });

    res.status(201).json({
      code: 201,
      message: '注册成功',
      data: user
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      code: 500,
      message: '注册失败',
      error: error.message
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();

    res.json({
      code: 200,
      message: 'success',
      data: users
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户列表失败',
      error: error.message
    });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await User.findByUsername(req.params.username);

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    res.json({
      code: 200,
      message: 'success',
      data: user
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户信息失败',
      error: error.message
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { role, allowedGrades } = req.body;

    const user = await User.update(req.params.id, { role, allowedGrades });

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    res.json({
      code: 200,
      message: '更新成功',
      data: user
    });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新用户失败',
      error: error.message
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.delete(req.params.id);

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: '用户不存在'
      });
    }

    res.json({
      code: 200,
      message: '删除成功',
      data: user
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除用户失败',
      error: error.message
    });
  }
};