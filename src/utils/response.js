/**
 * 统一响应格式工具
 * 所有接口返回格式: { code: '', data: '', msg: '' }
 */

/**
 * 成功响应
 * @param {*} data - 返回数据
 * @param {string} msg - 成功消息
 */
export function success(data = null, msg = '操作成功') {
  return {
    code: 0,
    data,
    msg
  };
}

/**
 * 失败响应
 * @param {string} msg - 错误消息
 * @param {number} code - 错误码
 * @param {*} data - 额外数据
 */
export function error(msg = '操作失败', code = -1, data = null) {
  return {
    code,
    data,
    msg
  };
}

/**
 * 响应状态码定义
 */
export const ResponseCode = {
  SUCCESS: 0,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
  VALIDATION_ERROR: 422
};
