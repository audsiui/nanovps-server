// 统一的 API 响应封装

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

// 成功响应
export function success<T>(data: T, message = '操作成功'): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
  };
}

// 创建成功
export function created<T>(data: T, message = '创建成功'): ApiResponse<T> {
  return {
    code: 201,
    message,
    data,
  };
}

// 错误响应
export function error(message: string, code = 500): ApiResponse<null> {
  return {
    code,
    message,
    data: null,
  };
}

// 常用错误快捷方法
export const errors = {
  // 400 - 请求参数错误
  badRequest: (message = '请求参数错误') => error(message, 400),

  // 401 - 未登录
  unauthorized: (message = '请先登录') => error(message, 401),

  // 403 - 权限不足
  forbidden: (message = '权限不足') => error(message, 403),

  // 404 - 资源不存在
  notFound: (message = '资源不存在') => error(message, 404),

  // 409 - 资源冲突
  conflict: (message = '资源已存在') => error(message, 409),

  // 422 - 验证错误
  validation: (message = '数据验证失败') => error(message, 422),

  // 500 - 服务器内部错误
  internal: (message = '服务器内部错误') => error(message, 500),
};
