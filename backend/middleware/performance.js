const logger = require('../config/logger');

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const { method, path, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    const logData = {
      method,
      path,
      statusCode,
      duration,
      ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    if (duration > 3000) {
      logger.warn(`慢请求警告: ${method} ${path} 耗时 ${duration}ms`, logData);
    }

    if (statusCode >= 500) {
      logger.error(`服务器错误: ${method} ${path} ${statusCode}`, logData);
    }

    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      logger.debug(`请求完成: ${method} ${path} ${statusCode} - ${duration}ms`, logData);
    }
  });

  next();
};

module.exports = performanceMonitor;