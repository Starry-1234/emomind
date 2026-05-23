# 详细设计文档

## 1. 引言

本文档基于《概要设计文档》展开，详细描述 EmoMind 平台的数据库设计、API 接口设计、类设计、关键算法实现及配置方案。

---

## 2. 数据库详细设计

### 2.1 E-R 图

```
┌─────────────┐       ┌──────────────────────┐
│    User     │◄──────┤ FileAnalysisReport   │
│  (1)        │  1:N  │  (N)                 │
└──────┬──────┘       └──────────────────────┘
       │
       │              ┌──────────────────────┐
       └─────────────►│    TestRecord        │
          1:N         │  (N)                 │
                      └──────────────────────┘
```

### 2.2 表结构定义

#### users 表

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PK | gen_random_uuid() | 主键 |
| email | VARCHAR(255) | NOT NULL, UNIQUE | - | 邮箱地址 |
| hashed_password | VARCHAR | NOT NULL | - | BCrypt 密码哈希 |
| is_active | BOOLEAN | NOT NULL | TRUE | 账号是否激活 |
| is_superuser | BOOLEAN | NOT NULL | FALSE | 是否超级用户 |
| full_name | VARCHAR(255) | NULL | - | 全名 |
| streak_days | INTEGER | NOT NULL | 0 | 连续活跃天数 |
| last_active_date | TIMESTAMP | NULL | - | 最后活跃日期 |
| created_at | TIMESTAMP | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |

#### file_analysis_report 表

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PK | gen_random_uuid() | 主键 |
| file_name | VARCHAR(255) | NOT NULL | - | 文件名 |
| file_type | VARCHAR(50) | NOT NULL | - | 文件类型 |
| file_size | INTEGER | NULL | - | 文件大小（字节） |
| analysis_result | TEXT | NOT NULL | - | 分析结果文本 |
| conversation_id | VARCHAR | NULL | - | Dify 对话 ID |
| created_at | TIMESTAMP | NOT NULL | - | 创建时间 |
| owner_id | UUID | FK → users.id, ON DELETE CASCADE | - | 所属用户 |

#### test_record 表

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PK | gen_random_uuid() | 主键 |
| test_name | VARCHAR(255) | NOT NULL | - | 测评名称 |
| user_topic | VARCHAR(500) | NULL | - | 用户主题 |
| total_score | INTEGER | NULL | - | 总得分 |
| total_max | INTEGER | NULL | - | 满分 |
| result_description | TEXT | NULL | - | 结果描述 |
| questions | JSONB | NOT NULL | - | 题目列表 |
| answers | JSONB | NOT NULL | - | 答案列表 |
| scoring_ranges | JSONB | NULL | - | 评分区间 |
| conversation_id | VARCHAR | NULL | - | Dify 对话 ID |
| created_at | TIMESTAMP | NOT NULL | - | 创建时间 |
| owner_id | UUID | FK → users.id, ON DELETE CASCADE | - | 所属用户 |

### 2.3 索引设计

```sql
-- users 表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- file_analysis_report 表索引
CREATE INDEX idx_file_analysis_report_owner ON file_analysis_report(owner_id);
CREATE INDEX idx_file_analysis_report_created_at ON file_analysis_report(created_at);

-- test_record 表索引
CREATE INDEX idx_test_record_owner ON test_record(owner_id);
CREATE INDEX idx_test_record_created_at ON test_record(created_at);
```

### 2.4 Flyway 迁移脚本

**V1__init_schema.sql**

```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_superuser BOOLEAN DEFAULT FALSE NOT NULL,
    full_name VARCHAR(255),
    streak_days INTEGER DEFAULT 0 NOT NULL,
    last_active_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 文件分析报告表
CREATE TABLE file_analysis_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    analysis_result TEXT NOT NULL,
    conversation_id VARCHAR,
    created_at TIMESTAMP NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- 测评记录表
CREATE TABLE test_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(255) NOT NULL,
    user_topic VARCHAR(500),
    total_score INTEGER,
    total_max INTEGER,
    result_description TEXT,
    questions JSONB NOT NULL,
    answers JSONB NOT NULL,
    scoring_ranges JSONB,
    conversation_id VARCHAR,
    created_at TIMESTAMP NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_file_analysis_report_owner ON file_analysis_report(owner_id);
CREATE INDEX idx_file_analysis_report_created_at ON file_analysis_report(created_at);
CREATE INDEX idx_test_record_owner ON test_record(owner_id);
CREATE INDEX idx_test_record_created_at ON test_record(created_at);
```

**V2__seed_superuser.sql**

```sql
-- 超级用户由应用启动时根据环境变量自动创建
-- 此迁移脚本为空，仅作为版本标记
```

---

## 3. API 详细设计

### 3.1 认证模块 API

#### POST /api/v1/login/access-token

**描述**: OAuth2 Password Flow 登录

**请求参数** (application/x-www-form-urlencoded):

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 邮箱地址 |
| password | string | 是 | 密码 |

**响应 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**响应 400:**
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**响应 401:**
```json
{
  "detail": "Incorrect email or password"
}
```

#### POST /api/v1/login/test-token

**描述**: 验证当前 Token 并返回用户信息

**请求头**: `Authorization: Bearer {token}`

**响应 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "is_active": true,
  "is_superuser": false,
  "full_name": "张三",
  "streak_days": 5,
  "last_active_date": "2026-05-23T10:00:00"
}
```

#### POST /api/v1/password-recovery/{email}

**描述**: 发送密码重置邮件

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| email | string | 用户邮箱 |

**响应 200:**
```json
{
  "message": "Password recovery email sent"
}
```

**注意**: 无论邮箱是否存在，都返回相同的成功响应（防止邮箱枚举攻击）

#### POST /api/v1/reset-password/

**描述**: 使用重置 Token 修改密码

**请求体** (application/json):

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| token | string | 是 | 重置 Token |
| new_password | string | 是 | 新密码（最少 8 位） |

**响应 200:**
```json
{
  "message": "Password updated successfully"
}
```

### 3.2 用户管理模块 API

#### GET /api/v1/users/

**描述**: 获取所有用户列表（管理员）

**权限**: 超级用户

**Query 参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| skip | integer | 0 | 跳过记录数 |
| limit | integer | 100 | 返回记录数 |

**响应 200:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "is_active": true,
      "is_superuser": false,
      "full_name": "张三"
    }
  ],
  "count": 100
}
```

#### POST /api/v1/users/

**描述**: 创建用户（管理员）

**权限**: 超级用户

**请求体**:
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "full_name": "李四",
  "is_superuser": false
}
```

#### GET /api/v1/users/me

**描述**: 获取当前用户信息

**响应 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "is_active": true,
  "is_superuser": false,
  "full_name": "张三",
  "streak_days": 5,
  "last_active_date": "2026-05-23T10:00:00"
}
```

#### PATCH /api/v1/users/me

**描述**: 更新当前用户信息

**请求体**:
```json
{
  "email": "newemail@example.com",
  "full_name": "张三三"
}
```

#### DELETE /api/v1/users/me

**描述**: 删除当前用户

**响应 200:**
```json
{
  "message": "User deleted successfully"
}
```

#### PATCH /api/v1/users/me/password

**描述**: 修改当前用户密码

**请求体**:
```json
{
  "current_password": "oldpass123",
  "new_password": "newpass123"
}
```

#### POST /api/v1/users/signup

**描述**: 用户注册

**请求体**:
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "full_name": "王五"
}
```

#### GET /api/v1/users/{id}

**描述**: 获取指定用户信息（管理员）

**权限**: 超级用户

#### PATCH /api/v1/users/{id}

**描述**: 更新指定用户（管理员）

**权限**: 超级用户

#### DELETE /api/v1/users/{id}

**描述**: 删除指定用户（管理员）

**权限**: 超级用户

### 3.3 文件分析报告模块 API

#### GET /api/v1/analysis/reports

**描述**: 获取当前用户的分析报告列表

**Query 参数**: skip, limit

**响应 200:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "file_name": "report.pdf",
      "file_type": "application/pdf",
      "file_size": 1024000,
      "analysis_result": "分析结果文本...",
      "conversation_id": "conv-123",
      "created_at": "2026-05-23T10:00:00",
      "owner_id": "550e8400-e29b-41d4-a716-446655440001"
    }
  ],
  "count": 10
}
```

#### POST /api/v1/analysis/reports

**描述**: 创建分析报告

**请求体**:
```json
{
  "file_name": "report.pdf",
  "file_type": "application/pdf",
  "file_size": 1024000,
  "analysis_result": "分析结果文本...",
  "conversation_id": "conv-123"
}
```

#### GET /api/v1/analysis/reports/{report_id}

**描述**: 获取单个分析报告详情

#### DELETE /api/v1/analysis/reports/{report_id}

**描述**: 删除分析报告

### 3.4 心理测评记录模块 API

#### GET /api/v1/test-records/

**描述**: 获取当前用户的测评记录列表

**Query 参数**: skip, limit

**响应 200:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "test_name": "MBTI 性格测试",
      "user_topic": "职业规划",
      "total_score": 85,
      "total_max": 100,
      "result_description": "你是 ENFJ 型人格...",
      "questions": [...],
      "answers": [...],
      "scoring_ranges": [...],
      "conversation_id": "conv-456",
      "created_at": "2026-05-23T10:00:00",
      "owner_id": "550e8400-e29b-41d4-a716-446655440001"
    }
  ],
  "count": 5
}
```

#### POST /api/v1/test-records/

**描述**: 创建测评记录

**请求体**:
```json
{
  "test_name": "MBTI 性格测试",
  "user_topic": "职业规划",
  "total_score": 85,
  "total_max": 100,
  "result_description": "你是 ENFJ 型人格...",
  "questions": [...],
  "answers": [...],
  "scoring_ranges": [...],
  "conversation_id": "conv-456"
}
```

#### GET /api/v1/test-records/{id}

**描述**: 获取单个测评记录详情

#### PUT /api/v1/test-records/{id}

**描述**: 更新测评记录

#### DELETE /api/v1/test-records/{id}

**描述**: 删除测评记录

### 3.5 Dify AI 代理模块 API

#### POST /api/v1/dify/chat-messages

**描述**: 发送聊天消息，SSE 流式响应

**Query 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| api_key_name | string | 是 | 使用的 Dify 应用名称 |

**请求体**: Dify 原始请求格式

**响应**: `text/event-stream` (SSE)

**响应头**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

#### POST /api/v1/dify/files/upload

**描述**: 上传文件到 Dify

**Query 参数**: api_key_name

**请求体**:
```json
{
  "file": "base64-encoded-file-content",
  "filename": "document.pdf"
}
```

#### GET /api/v1/dify/conversations

**描述**: 获取对话列表

**Query 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user | string | 是 | 用户标识 |
| api_key_name | string | 是 | Dify 应用名称 |

#### GET /api/v1/dify/messages

**描述**: 获取消息历史

**Query 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user | string | 是 | 用户标识 |
| conversation_id | string | 是 | 对话 ID |
| api_key_name | string | 是 | Dify 应用名称 |

#### DELETE /api/v1/dify/conversations/{id}

**描述**: 删除对话

**Query 参数**: user, api_key_name

### 3.6 管理员统计模块 API

#### GET /api/v1/admin/stats

**描述**: 获取仪表盘统计数据

**权限**: 超级用户

**响应 200:**
```json
{
  "total_users": 100,
  "total_test_records": 500,
  "total_analysis_reports": 200,
  "today_new_users": 5,
  "today_new_test_records": 20,
  "today_new_analysis_reports": 10
}
```

#### GET /api/v1/admin/test-records

**描述**: 获取所有测评记录（管理员）

**权限**: 超级用户

**Query 参数**: skip, limit, user_id（可选）

#### DELETE /api/v1/admin/test-records/{id}

**描述**: 删除任意测评记录（管理员）

**权限**: 超级用户

### 3.7 健康检查 API

#### GET /api/v1/utils/health-check/

**描述**: 服务健康检查

**响应 200:**
```json
{
  "status": "ok"
}
```

---

## 4. 类详细设计

### 4.1 实体类设计

#### User

```java
@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "hashed_password", nullable = false)
    private String hashedPassword;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "is_superuser", nullable = false)
    private Boolean isSuperuser = false;

    @Column(name = "full_name", length = 255)
    private String fullName;

    @Column(name = "streak_days", nullable = false)
    private Integer streakDays = 0;

    @Column(name = "last_active_date")
    private LocalDateTime lastActiveDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

#### FileAnalysisReport

```java
@Entity
@Table(name = "file_analysis_report")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileAnalysisReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "file_type", nullable = false, length = 50)
    private String fileType;

    @Column(name = "file_size")
    private Integer fileSize;

    @Column(name = "analysis_result", nullable = false, columnDefinition = "TEXT")
    private String analysisResult;

    @Column(name = "conversation_id")
    private String conversationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

#### TestRecord

```java
@Entity
@Table(name = "test_record")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "test_name", nullable = false, length = 255)
    private String testName;

    @Column(name = "user_topic", length = 500)
    private String userTopic;

    @Column(name = "total_score")
    private Integer totalScore;

    @Column(name = "total_max")
    private Integer totalMax;

    @Column(name = "result_description", columnDefinition = "TEXT")
    private String resultDescription;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "questions", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> questions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answers", nullable = false, columnDefinition = "jsonb")
    private List<Map<String, Object>> answers;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "scoring_ranges", columnDefinition = "jsonb")
    private List<Map<String, Object>> scoringRanges;

    @Column(name = "conversation_id")
    private String conversationId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
```

### 4.2 DTO 类设计

#### TokenResponse

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenResponse {
    private String accessToken;
    private String tokenType;
}
```

#### UserResponse

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private UUID id;
    private String email;
    private Boolean isActive;
    private Boolean isSuperuser;
    private String fullName;
    private Integer streakDays;
    private LocalDateTime lastActiveDate;
    private LocalDateTime createdAt;
}
```

#### PageResponse

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PageResponse<T> {
    private List<T> data;
    private Long count;
}
```

#### MessageResponse

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private String message;
}
```

### 4.3 Repository 接口设计

```java
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}

@Repository
public interface FileAnalysisReportRepository extends JpaRepository<FileAnalysisReport, UUID> {
    List<FileAnalysisReport> findByOwnerId(UUID ownerId, Pageable pageable);
    long countByOwnerId(UUID ownerId);
}

@Repository
public interface TestRecordRepository extends JpaRepository<TestRecord, UUID> {
    List<TestRecord> findByOwnerId(UUID ownerId, Pageable pageable);
    long countByOwnerId(UUID ownerId);
}
```

### 4.4 Service 类设计

```java
public interface UserService {
    TokenResponse login(String email, String password);
    UserResponse register(UserRegisterRequest request);
    UserResponse getCurrentUser(UUID userId);
    UserResponse updateCurrentUser(UUID userId, UserUpdateMeRequest request);
    void deleteCurrentUser(UUID userId);
    PageResponse<UserResponse> getAllUsers(Pageable pageable);
    UserResponse createUser(UserCreateRequest request);
    UserResponse updateUser(UUID userId, UserUpdateRequest request);
    void deleteUser(UUID userId);
    void updatePassword(UUID userId, UpdatePasswordRequest request);
    void resetPassword(String token, String newPassword);
    void sendPasswordRecoveryEmail(String email);
    void updateStreakIfNeeded(UUID userId);
}

public interface AnalysisService {
    PageResponse<AnalysisReportResponse> getReports(UUID ownerId, Pageable pageable);
    AnalysisReportResponse createReport(UUID ownerId, AnalysisReportCreateRequest request);
    AnalysisReportResponse getReport(UUID reportId, UUID ownerId);
    void deleteReport(UUID reportId, UUID ownerId);
}

public interface TestRecordService {
    PageResponse<TestRecordResponse> getRecords(UUID ownerId, Pageable pageable);
    TestRecordResponse createRecord(UUID ownerId, TestRecordCreateRequest request);
    TestRecordResponse getRecord(UUID recordId, UUID ownerId);
    TestRecordResponse updateRecord(UUID recordId, UUID ownerId, TestRecordUpdateRequest request);
    void deleteRecord(UUID recordId, UUID ownerId);
    PageResponse<TestRecordResponse> getAllRecords(UUID adminId, UUID userId, Pageable pageable);
    void deleteAnyRecord(UUID recordId, UUID adminId);
}

public interface AdminStatsService {
    AdminStatsResponse getStats();
}

public interface DifyService {
    StreamingResponseBody sendChatMessage(String apiKeyName, Map<String, Object> requestBody);
    Map<String, Object> uploadFile(String apiKeyName, Map<String, Object> requestBody);
    Map<String, Object> getConversations(String user, String apiKeyName);
    Map<String, Object> getMessages(String user, String conversationId, String apiKeyName);
    void deleteConversation(String conversationId, String user, String apiKeyName);
}
```

### 4.5 Controller 类设计

```java
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LoginController {
    private final UserService userService;

    @PostMapping("/login/access-token")
    public ResponseEntity<TokenResponse> login(@Valid @ModelAttribute LoginRequest request) { }

    @PostMapping("/login/test-token")
    public ResponseEntity<UserResponse> testToken(@AuthenticationPrincipal UserDetailsImpl user) { }

    @PostMapping("/password-recovery/{email}")
    public ResponseEntity<MessageResponse> recoverPassword(@PathVariable String email) { }

    @PostMapping("/reset-password/")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody PasswordResetRequest request) { }
}

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageResponse<UserResponse>> getAllUsers(Pageable pageable) { }

    @PostMapping("/")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) { }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) { }

    @PatchMapping("/me")
    public ResponseEntity<UserResponse> updateCurrentUser(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody UserUpdateMeRequest request) { }

    @DeleteMapping("/me")
    public ResponseEntity<MessageResponse> deleteCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) { }

    @PatchMapping("/me/password")
    public ResponseEntity<MessageResponse> updatePassword(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody UpdatePasswordRequest request) { }

    @PostMapping("/signup")
    public ResponseEntity<UserResponse> signup(@Valid @RequestBody UserRegisterRequest request) { }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> getUserById(@PathVariable UUID id) { }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserUpdateRequest request) { }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse> deleteUser(@PathVariable UUID id) { }
}
```

### 4.6 Security 类设计

```java
@Component
public class JwtTokenProvider {

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration}")
    private long jwtExpiration;

    public String generateToken(String userId) { }
    public String getUserIdFromToken(String token) { }
    public boolean validateToken(String token) { }
    private Key getSigningKey() { }
}

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenProvider tokenProvider;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException { }
}

@Component
@RequiredArgsConstructor
public class StreakUpdateFilter extends OncePerRequestFilter {
    private final UserService userService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException { }
}
```

---

## 5. 关键算法设计

### 5.1 JWT 签发与验证

**签发流程：**

```
1. 用户登录验证通过后，获取用户 UUID
2. 构造 JWT Payload: { "sub": "user-uuid", "exp": 当前时间 + 8天 }
3. 使用 HS256 算法和配置的 Secret Key 签名
4. 返回 access_token
```

**验证流程：**

```
1. 从请求头提取 Bearer Token
2. 解析 JWT 获取用户 UUID (sub 字段)
3. 验证签名是否有效
4. 验证 Token 是否过期
5. 查询用户是否存在且激活
6. 将用户信息存入 SecurityContext
```

### 5.2 密码哈希与验证

**哈希流程：**

```
1. 接收明文密码
2. 使用 BCryptPasswordEncoder（强度 10）生成哈希
3. 存储哈希值到数据库
```

**验证流程：**

```
1. 接收明文密码和数据库中的哈希值
2. 使用 BCryptPasswordEncoder.matches() 验证
3. 返回验证结果
```

**兼容性处理：**

如果数据库中存在旧系统的 Argon2 哈希密码，需要配置 Spring Security 的 DelegatingPasswordEncoder 以同时支持 Argon2 和 BCrypt 验证。

### 5.3 Streak 连续活跃计算

```
输入: userId
1. 查询用户的 last_active_date 和 streak_days
2. 获取当前日期（Asia/Shanghai 时区）
3. 如果 last_active_date 为 null:
     streak_days = 1
4. 否则:
     lastDate = last_active_date 的日期部分
     today = 当前日期
     yesterday = today - 1 天

     如果 lastDate == yesterday:
         streak_days += 1
     否则如果 lastDate < yesterday:
         streak_days = 1
     否则 (lastDate == today):
         不更新

5. 更新 last_active_date = 当前时间
6. 保存用户记录
```

### 5.4 SSE 流式代理实现

```
客户端请求 ──▶ DifyController
                    │
                    ▼
              StreamingResponseBody
                    │
                    ▼
              DifyService.streamChatMessage()
                    │
                    ▼
              WebClient (异步 HTTP)
                    │
                    ▼
              Dify AI Platform
                    │
                    ▼
              Flux<String> (响应流)
                    │
                    ▼
              逐块写入 OutputStream
                    │
                    ▼
              客户端接收 SSE 事件
```

---

## 6. 异常处理设计

### 6.1 异常分类

| 异常类型 | 说明 | HTTP 状态码 |
|---------|------|------------|
| ServiceException | 业务逻辑异常 | 400 |
| ResourceNotFoundException | 资源不存在 | 404 |
| UnauthorizedException | 未认证或认证失败 | 401 |
| AccessDeniedException | 权限不足 | 403 |
| MethodArgumentNotValidException | 参数验证失败 | 422 |
| Exception | 其他未预期异常 | 500 |

### 6.2 全局异常处理

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ServiceException.class)
    public ResponseEntity<MessageResponse> handleServiceException(ServiceException e) {
        return ResponseEntity.badRequest()
                .body(new MessageResponse(e.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<MessageResponse> handleNotFound(ResourceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new MessageResponse(e.getMessage()));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<MessageResponse> handleUnauthorized(UnauthorizedException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new MessageResponse(e.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<MessageResponse> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new MessageResponse("Not enough permissions"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationException(
            MethodArgumentNotValidException e) {
        List<Map<String, Object>> errors = e.getBindingResult().getFieldErrors().stream()
                .map(error -> Map.of(
                        "loc", Arrays.asList("body", error.getField()),
                        "msg", error.getDefaultMessage(),
                        "type", "value_error"
                ))
                .collect(Collectors.toList());

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("detail", errors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MessageResponse> handleException(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Internal server error"));
    }
}
```

### 6.3 错误响应格式

**验证错误（422）:**

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "invalid email format",
      "type": "value_error"
    },
    {
      "loc": ["body", "password"],
      "msg": "ensure this value has at least 8 characters",
      "type": "value_error"
    }
  ]
}
```

**业务错误（400）:**

```json
{
  "message": "Email already registered"
}
```

**认证错误（401）:**

```json
{
  "message": "Could not validate credentials"
}
```

---

## 7. 配置详细设计

### 7.1 application.yml 配置

```yaml
server:
  port: 8080

spring:
  application:
    name: emomind

  datasource:
    url: jdbc:postgresql://${POSTGRES_SERVER:localhost}:${POSTGRES_PORT:5432}/${POSTGRES_DB:emomind}
    username: ${POSTGRES_USER:postgres}
    password: ${POSTGRES_PASSWORD:}
    driver-class-name: org.postgresql.Driver
    hikari:
      minimum-idle: 5
      maximum-pool-size: 20
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000

  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        jdbc:
          time_zone: Asia/Shanghai
        format_sql: true
    show-sql: false

  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

  mail:
    host: ${SMTP_HOST:}
    port: ${SMTP_PORT:587}
    username: ${SMTP_USER:}
    password: ${SMTP_PASSWORD:}
    protocol: smtp
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: ${SMTP_TLS:true}
      mail.smtp.ssl.enable: ${SMTP_SSL:false}

app:
  jwt:
    secret: ${SECRET_KEY:}
    expiration: 691200000  # 8 days in milliseconds
  frontend:
    host: ${FRONTEND_HOST:http://localhost:5173}
  cors:
    origins: ${BACKEND_CORS_ORIGINS:http://localhost:5173}
  dify:
    api-url: ${DIFY_API_URL:http://localhost/v1}
    ai-doctor-api-key: ${DIFY_AI_DOCTOR_API_KEY:}
    test-api-key: ${DIFY_TEST_API_KEY:}
  first-superuser:
    email: ${FIRST_SUPERUSER:}
    password: ${FIRST_SUPERUSER_PASSWORD:}
  email:
    from: ${EMAILS_FROM_EMAIL:}
    from-name: ${EMAILS_FROM_NAME:EmoMind}
    reset-token-expire-hours: ${EMAIL_RESET_TOKEN_EXPIRE_HOURS:48}

springdoc:
  api-docs:
    path: /docs
  swagger-ui:
    path: /docs/swagger-ui.html
```

### 7.2 环境配置

**application-dev.yml（开发环境）:**

```yaml
spring:
  jpa:
    show-sql: true
    properties:
      hibernate:
        format_sql: true

logging:
  level:
    com.emomind: DEBUG
    org.springframework.security: DEBUG
```

**application-prod.yml（生产环境）:**

```yaml
spring:
  jpa:
    show-sql: false

logging:
  level:
    com.emomind: INFO
    org.springframework.security: WARN
```

### 7.3 环境变量映射

| 环境变量 | application.yml 配置 | 默认值 | 必填 |
|---------|---------------------|--------|------|
| SECRET_KEY | app.jwt.secret | - | 是 |
| POSTGRES_SERVER | spring.datasource.url | localhost | 否 |
| POSTGRES_PORT | spring.datasource.url | 5432 | 否 |
| POSTGRES_DB | spring.datasource.url | emomind | 否 |
| POSTGRES_USER | spring.datasource.username | postgres | 否 |
| POSTGRES_PASSWORD | spring.datasource.password | - | 是 |
| FRONTEND_HOST | app.frontend.host | http://localhost:5173 | 否 |
| BACKEND_CORS_ORIGINS | app.cors.origins | http://localhost:5173 | 否 |
| SMTP_HOST | spring.mail.host | - | 否 |
| SMTP_PORT | spring.mail.port | 587 | 否 |
| SMTP_USER | spring.mail.username | - | 否 |
| SMTP_PASSWORD | spring.mail.password | - | 否 |
| SMTP_TLS | spring.mail.properties.mail.smtp.starttls.enable | true | 否 |
| EMAILS_FROM_EMAIL | app.email.from | - | 否 |
| EMAILS_FROM_NAME | app.email.from-name | EmoMind | 否 |
| FIRST_SUPERUSER | app.first-superuser.email | - | 否 |
| FIRST_SUPERUSER_PASSWORD | app.first-superuser.password | - | 否 |
| DIFY_API_URL | app.dify.api-url | http://localhost/v1 | 否 |
| DIFY_AI_DOCTOR_API_KEY | app.dify.ai-doctor-api-key | - | 否 |
| DIFY_TEST_API_KEY | app.dify.test-api-key | - | 否 |

---

## 8. 前端设计

### 8.1 路由设计

| 路由 | 文件 | 说明 | 权限 |
|------|------|------|------|
| / | index.tsx | 根路由重定向 | - |
| /login | login.tsx | 登录页面 | 公开 |
| /signup | signup.tsx | 注册页面 | 公开 |
| /recover-password | recover-password.tsx | 密码找回 | 公开 |
| /reset-password | reset-password.tsx | 密码重置 | 公开 |
| /user | user/route.tsx | 用户布局 | 普通用户 |
| /user/ | user/index.tsx | 用户首页 | 普通用户 |
| /user/ai-doctor | user/ai-doctor/index.tsx | AI 医生入口 | 普通用户 |
| /user/ai-doctor/chat/$sessionId | user/ai-doctor/chat/$sessionId.tsx | AI 医生对话 | 普通用户 |
| /user/test | user/test/index.tsx | 心理测评入口 | 普通用户 |
| /user/test/chat/$sessionId | user/test/chat/$sessionId.tsx | 测评对话 | 普通用户 |
| /user/test-records | user/test-records.tsx | 测评记录 | 普通用户 |
| /user/consultations | user/consultations.tsx | 分析报告 | 普通用户 |
| /user/settings | user/settings.tsx | 用户设置 | 普通用户 |
| /_admin-layout | _admin-layout.tsx | 管理员布局 | 超级用户 |
| /_admin-layout/admin | _admin-layout/admin.tsx | 管理仪表盘 | 超级用户 |
| /_admin-layout/user-manage | _admin-layout/user-manage.tsx | 用户管理 | 超级用户 |
| /_admin-layout/chat-history | _admin-layout/chat-history.tsx | 聊天历史 | 超级用户 |
| /_admin-layout/admin-test-records | _admin-layout/admin-test-records.tsx | 测评管理 | 超级用户 |
| /_admin-layout/admin-settings | _admin-layout/admin-settings.tsx | 管理设置 | 超级用户 |

### 8.2 页面组件设计

**登录页面:**
- 邮箱输入框（带格式验证）
- 密码输入框（带可见性切换）
- 登录按钮
- 跳转注册链接
- 跳转密码找回链接

**注册页面:**
- 邮箱输入框
- 密码输入框（最少 8 位提示）
- 全名输入框（可选）
- 注册按钮
- 跳转登录链接

**AI 医生对话页面:**
- 消息列表区域（滚动）
- 输入框 + 发送按钮
- 文件上传按钮
- 对话历史侧边栏
- SSE 流式消息展示

**心理测评页面:**
- 测评入口列表
- 测评对话界面
- 结果展示页面

**用户设置页面:**
- 个人信息编辑
- 密码修改
- 账户删除

**管理仪表盘:**
- 统计数据卡片（用户数、测评数、报告数）
- 今日新增趋势
- 图表展示

### 8.3 状态管理设计

**认证状态:**
- Token 存储：localStorage
- 登录状态：全局 Context
- 用户信息：TanStack Query 缓存

**数据获取:**
- 使用 TanStack Query 管理服务端状态
- 分页数据使用 useQuery + useInfiniteQuery
- 乐观更新用于创建/删除操作

**本地状态:**
- 表单状态：React useState
- UI 状态：React useState/useReducer
- 全局 UI：React Context（主题、Toast 通知）

### 8.4 API 客户端设计

**自动生成的 OpenAPI 客户端:**
- 基于 springdoc-openapi 生成的 OpenAPI 3.0 文档
- 使用 @hey-api/openapi-ts 生成 TypeScript 客户端
- 包含所有 API 端点的类型安全调用

**自定义 Dify API 客户端:**
- 使用原生 fetch API 处理 SSE 流式响应
- 手动管理 Authorization Header
- 支持 AbortController 取消请求

**请求拦截:**
- 自动注入 JWT Token
- 401/403 错误统一处理（跳转登录）
- 请求/响应日志（开发环境）
