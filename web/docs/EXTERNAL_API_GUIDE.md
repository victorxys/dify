# 外部系统认证 API 接入指南

本指南面向需要调用本系统（ExamDB 后端）开放接口进行身份验证的外部系统开发者。由于安全原因，调用受限 API 必须经过双重鉴权：使用分配的 `API Key` 确认系统身份，同时提供合法用户的注册信息获取该用户的访问凭证（Token）。

## 接口说明

**名称：** 外部系统用户登录认证 API
**URL：** `hr.mengyimengsao.com/api/auth/login` (例如：`https://hr.mengyimengsao.com/api/auth/login`)
**Method：** `POST`
**Content-Type：** `application/json`

---

## 鉴权方式

本接口要求必须在请求 Header 中携带合法、分配给贵系统的 API Key，用于区分系统调用来源。

### 1. Header (请求头)

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `X-API-Key` | String | **是** | 本系统分配给你们的授权通信密钥。 |

- **针对 `school.mengyimengsao.com` 的专属 Key 为：** `mengschooldjdhangld@djd721`
- **针对 AI 聊天机器人的专属 Key 为：** `api_key_123`

### 2. Body (请求体)

本接口目的是让你们能够获取特定用户在 ExamDB 系统内的身份 `Token`。因此，你们需要提供用户的登录凭证：

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `phone_number` | String | **是** | 用户在 ExamDB 系统注册的手机号 |
| `password` | String | **是** | 用户的登录密码（对于某些导入的用户，默认密码通常是身份证号后 6 位）|

**请求 Body 结构示例：**
```json
{
    "phone_number": "13812345678",
    "password": "your_password"
}
```

---

## 响应说明

### 1. 认证成功 (HTTP Status: 200 OK)

接口将返回一个 JSON 对象，其中包含用户的基本资料和一个 `access_token`。拿到这串 token 后，你们可以将它置于后续业务请求的 `Authorization` 头中（格式为 `Bearer <access_token>`），从而代表该用户操作或查询业务数据。

**返回示例：**
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE...",
    "user": {
        "id": "e6a123f1-4b72-4f81-9d2a-8c9f5d1e2b4a",
        "username": "张三"
    }
}
```

### 2. 认证失败 

当系统身份校验不通过，或提供的用户账密有误时，接口将返回 400 或 401 状态码，并在 `error` 字段告知具体原因。

**常见错误码及响应：**

- **HTTP 401 Unauthorized (系统身份不合法)**
  表示 `X-API-Key` 缺失或无效。
  ```json
  { "error": "Invalid API Key" }
  ```

- **HTTP 400 Bad Request (参数缺失)**
  没有按照规范传递 JSON Body，或缺少必要字段。
  ```json
  { "error": "Missing phone_number or password" }
  ```

- **HTTP 401 Unauthorized (用户不存在 / 密码错误)**
  ```json
  { "error": "手机号不正确，请与管理员确认手机号" }
  ```
  ```json
  { "error": "密码错误,默认密码为身份证号后6位" }
  ```

- **HTTP 401 Unauthorized (账号异常)**
  该用户在 ExamDB 中的状态为非正常（如被拉黑、封禁、未激活等）。
  ```json
  { "error": "用户未激活，请联系管理员" }
  ```

---

## 接入建议

- **传输层安全：** API 交互过程中的 `X-API-Key` 属于敏感数据，请务必保证在生产环境的所有请求都在 HTTPS 协议上进行，以防被监听窃取。
- **Token 保管：** 对于返回的 `access_token`，请在贵系统中稳妥存储。它有一定的有效期，过期后接口会返回 `401 Unauthorized`，届时请重新调用本接口获取新 Token。
- **不要写死配置：** 请将分配给贵系统的 API Key 放在你们自己的环境变量、配置中心或 `.env` 里，避免硬编码泄漏到前端代码或仓库中。
