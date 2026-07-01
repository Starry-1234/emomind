# 11 · ConversationMeta（Spring 端会话元数据）

## 1. 模块定位

ConversationMeta 是 Spring Boot 端管理的会话**业务元数据**表，与 LangGraph `PostgresSaver` 通过 `thread_id` 关联。

**为什么需要两层？**

| 关注点 | ConversationMeta（Spring）| PostgresSaver（LangGraph）|
|--------|-------------------------|---------------------------|
| 业务元数据 | ✅ 会话名、所有者、创建时间、是否归档 | ❌ |
| 消息内容/state | ❌ | ✅ 完整 graph state |
| 权限校验 | ✅ 在 Spring 层完成 | ❌ 信任调用方 |
| 列表查询性能 | ✅ 有索引，开销低 | ❌ 反序列化 state 代价高 |
| 跨 graph 统计 | ✅ 容易 | ❌ |

## 2. 数据模型

### 2.1 Flyway V5 迁移

```sql
-- backend-sb/src/main/resources/db/migration/V5__add_conversation_meta.sql
CREATE TABLE conversation_meta (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    graph VARCHAR(50) NOT NULL,                 -- 'ai-doctor' | 'psych-test'
    thread_id TEXT NOT NULL,                    -- LangGraph thread_id
    title VARCHAR(255) NOT NULL DEFAULT '新会话',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,                -- 最后一条消息时间（用于排序）
    message_count INT NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- 业务元数据（如测评结果摘要）

    UNIQUE (user_id, thread_id)
);

-- 列表查询索引
CREATE INDEX conversation_meta_user_graph_updated_idx
    ON conversation_meta (user_id, graph, updated_at DESC)
    WHERE is_archived = FALSE;

-- 管理后台查询
CREATE INDEX conversation_meta_thread_id_idx
    ON conversation_meta (thread_id);

-- 全局活跃度统计
CREATE INDEX conversation_meta_last_message_idx
    ON conversation_meta (last_message_at DESC NULLS LAST)
    WHERE is_archived = FALSE;

COMMENT ON TABLE conversation_meta IS 'AI 会话业务元数据（与 LangGraph checkpoint 通过 thread_id 关联）';
COMMENT ON COLUMN conversation_meta.thread_id IS 'LangGraph thread_id';
COMMENT ON COLUMN conversation_meta.graph IS 'ai-doctor | psych-test';
COMMENT ON COLUMN conversation_meta.metadata IS '业务元数据（如测评分数、报告摘要）';
```

### 2.2 JPA 实体

```java
// backend-sb/src/main/java/com/emomind/entity/ConversationMeta.java
package com.emomind.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "conversation_meta")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class ConversationMeta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 50)
    private String graph;

    @Column(name = "thread_id", nullable = false)
    private String threadId;

    @Column(nullable = false, length = 255)
    @Builder.Default
    private String title = "新会话";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "last_message_at")
    private OffsetDateTime lastMessageAt;

    @Column(name = "message_count", nullable = false)
    @Builder.Default
    private Integer messageCount = 0;

    @Column(name = "is_archived", nullable = false)
    @Builder.Default
    private Boolean isArchived = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> metadata = new HashMap<>();
}
```

### 2.3 Repository

```java
// backend-sb/src/main/java/com/emomind/repository/ConversationMetaRepository.java
package com.emomind.repository;

import com.emomind.entity.ConversationMeta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationMetaRepository extends JpaRepository<ConversationMeta, Long> {

    Optional<ConversationMeta> findByUserIdAndThreadId(UUID userId, String threadId);

    @Query("""
        SELECT c FROM ConversationMeta c
        WHERE c.userId = :userId
          AND c.graph = :graph
          AND c.isArchived = false
        ORDER BY COALESCE(c.lastMessageAt, c.updatedAt) DESC
    """)
    List<ConversationMeta> findActiveByUserAndGraph(
        @Param("userId") UUID userId,
        @Param("graph") String graph
    );

    @Query("""
        SELECT c FROM ConversationMeta c
        WHERE c.userId = :userId
          AND c.graph = :graph
          AND c.isArchived = false
          AND LOWER(c.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
        ORDER BY COALESCE(c.lastMessageAt, c.updatedAt) DESC
    """)
    List<ConversationMeta> searchByTitle(
        @Param("userId") UUID userId,
        @Param("graph") String graph,
        @Param("keyword") String keyword
    );

    void deleteByUserIdAndThreadId(UUID userId, String threadId);

    long countByUserId(UUID userId);
}
```

## 3. Service 层

### 3.1 ConversationMetaService

```java
// backend-sb/src/main/java/com/emomind/service/ConversationMetaService.java
package com.emomind.service;

import com.emomind.entity.ConversationMeta;
import com.emomind.exception.ResourceNotFoundException;
import com.emomind.exception.UnauthorizedException;
import com.emomind.repository.ConversationMetaRepository;
import com.emomind.security.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationMetaService {

    private final ConversationMetaRepository repo;
    private final AiProxyService aiProxyService;

    @Transactional
    public ConversationMeta createOrGet(UUID userId, String graph, String threadId, String title) {
        return repo.findByUserIdAndThreadId(userId, threadId)
            .orElseGet(() -> repo.save(ConversationMeta.builder()
                .userId(userId)
                .graph(graph)
                .threadId(threadId)
                .title(title != null ? title : "新会话")
                .build()));
    }

    public List<ConversationMeta> list(UUID userId, String graph) {
        return repo.findActiveByUserAndGraph(userId, graph);
    }

    public List<ConversationMeta> listForAdmin(UUID userId, String graph) {
        return repo.findActiveByUserAndGraph(userId, graph);
    }

    public Optional<ConversationMeta> find(UUID userId, String threadId) {
        return repo.findByUserIdAndThreadId(userId, threadId);
    }

    @Transactional
    public ConversationMeta updateTitle(UUID userId, String threadId, String title) {
        ConversationMeta meta = repo.findByUserIdAndThreadId(userId, threadId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        meta.setTitle(title);
        return repo.save(meta);
    }

    @Transactional
    public ConversationMeta incrementMessageCount(UUID userId, String threadId) {
        ConversationMeta meta = repo.findByUserIdAndThreadId(userId, threadId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        meta.setMessageCount(meta.getMessageCount() + 1);
        meta.setLastMessageAt(java.time.OffsetDateTime.now());
        return repo.save(meta);
    }

    @Transactional
    public ConversationMeta updateMetadata(UUID userId, String threadId, Map<String, Object> metadata) {
        ConversationMeta meta = repo.findByUserIdAndThreadId(userId, threadId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        meta.getMetadata().putAll(metadata);
        return repo.save(meta);
    }

    @Transactional
    public void archive(UUID userId, String threadId) {
        ConversationMeta meta = repo.findByUserIdAndThreadId(userId, threadId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));
        meta.setIsArchived(true);
        repo.save(meta);
    }

    /**
     * 删除会话：删 ConversationMeta + 调 ai-runtime 删 checkpoint。
     * 权限校验：owner 或 admin。
     */
    @Transactional
    public void delete(UserDetailsImpl currentUser, UUID userId, String threadId) {
        ConversationMeta meta = repo.findByUserIdAndThreadId(userId, threadId)
            .orElseThrow(() -> new ResourceNotFoundException("Conversation not found"));

        // 权限：只有所有者或 admin 能删
        boolean isOwner = meta.getUserId().equals(currentUser.getId());
        boolean isAdmin = Boolean.TRUE.equals(currentUser.getSuperuser());
        if (!isOwner && !isAdmin) {
            throw new UnauthorizedException("Cannot delete another user's conversation");
        }

        // 1. 删 ConversationMeta
        repo.delete(meta);

        // 2. 调 ai-runtime 物理删 checkpoint
        try {
            aiProxyService.deleteConversation(userId.toString(), threadId);
        } catch (Exception e) {
            log.error("Failed to delete ai-runtime checkpoint for thread {}: {}", threadId, e.getMessage());
            // 不抛：ConversationMeta 已删；checkpoint 残留影响不大（孤儿数据）
        }
    }
}
```

## 4. Controller 集成

### 4.1 路由更新

```java
// AiController.java 片段
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiProxyService aiProxyService;
    private final ConversationMetaService conversationMetaService;

    @GetMapping("/conversations")
    public List<ConversationMetaDTO> listConversations(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam String graph,
            @RequestParam(required = false) UUID userId) {

        UUID targetUserId = (userId != null && Boolean.TRUE.equals(user.getSuperuser()))
            ? userId
            : user.getId();

        return conversationMetaService.list(targetUserId, graph).stream()
            .map(ConversationMetaDTO::from)
            .toList();
    }

    @DeleteMapping("/conversations/{threadId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConversation(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable String threadId,
            @RequestParam UUID userId) {  // 实际被操作的用户

        conversationMetaService.delete(user, userId, threadId);
    }

    @PostMapping("/conversations/{threadId}/title")
    public ConversationMetaDTO updateTitle(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable String threadId,
            @RequestParam UUID userId,
            @RequestBody Map<String, String> body) {

        return ConversationMetaDTO.from(
            conversationMetaService.updateTitle(userId, threadId, body.get("title"))
        );
    }
}
```

### 4.2 chat 流程中创建/更新 meta

在 `AiController.chat` 入口：

```java
@PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public ResponseEntity<StreamingResponseBody> chat(
        @AuthenticationPrincipal UserDetailsImpl user,
        @RequestBody ChatRequest request) {

    UUID userId = user.getId();

    // 1. 如果是新会话（thread_id 为空），提前预留 placeholder
    //    ai-runtime 会生成真实 thread_id 并通过 SSE event=message_end 回传
    //    前端再用真实 thread_id 调 /conversations 更新 title

    // 2. SSE 透传
    StreamingResponseBody body = output -> {
        aiProxyService.proxyChatStream(userId, user.getAuthorities(), request, output);
    };

    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("text/event-stream;charset=UTF-8"))
        .header("Cache-Control", "no-cache")
        .header("X-Accel-Buffering", "no")
        .body(body);
}
```

**问题**：SSE 是单向流，Spring 无法在中间插入 DB 写入而不破坏流。

**解决方案**：让 ai-runtime 在 SSE 流中发送一个特殊的 `conversation_created` 事件，前端收到后调 `/conversations` POST 端点创建 ConversationMeta。

或者：让前端在 chat 开始前调 `/conversations/preview` 拿到 placeholder thread_id，再传回 chat 请求。后端用这个 thread_id 创建 ConversationMeta。

### 4.3 推荐方案：前端 + ai-runtime 协同

```
[1] 前端点击"发送"
    │
    │  POST /api/v1/ai/chat (thread_id 留空)
    ▼
[2] Spring AiController.chat
    │  不创建 ConversationMeta
    │  转发到 ai-runtime
    ▼
[3] ai-runtime 生成 thread_id = thread_xxx
    │  SSE event=message_end { thread_id, run_id, ... }
    ▼
[4] 前端收到 message_end
    │  POST /api/v1/ai/conversations
    │  Body: { thread_id, graph, title }
    ▼
[5] Spring ConversationMetaService.createOrGet(...)
    │  创建 ConversationMeta（如果不存在）
```

**优点**：保持 SSE 流纯净，DB 写入在正常 HTTP 请求中。

## 5. ConversationMetaDTO

```java
// backend-sb/src/main/java/com/emomind/dto/response/ConversationMetaDTO.java
package com.emomind.dto.response;

import com.emomind.entity.ConversationMeta;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record ConversationMetaDTO(
    Long id,
    UUID userId,
    String graph,
    String threadId,
    String title,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime lastMessageAt,
    Integer messageCount,
    Boolean isArchived,
    Map<String, Object> metadata
) {
    public static ConversationMetaDTO from(ConversationMeta m) {
        return new ConversationMetaDTO(
            m.getId(), m.getUserId(), m.getGraph(), m.getThreadId(),
            m.getTitle(), m.getCreatedAt(), m.getUpdatedAt(),
            m.getLastMessageAt(), m.getMessageCount(), m.getIsArchived(),
            m.getMetadata()
        );
    }
}
```

## 6. 与 admin 功能的集成

### 6.1 现有 AdminController

```java
// 扩展：管理员可查看任意用户的会话
@GetMapping("/admin/conversations")
public List<ConversationMetaDTO> adminListConversations(
        @AuthenticationPrincipal UserDetailsImpl admin,
        @RequestParam UUID userId,
        @RequestParam String graph) {
    if (!Boolean.TRUE.equals(admin.getSuperuser())) {
        throw new UnauthorizedException("Admin only");
    }
    return conversationMetaService.listForAdmin(userId, graph).stream()
        .map(ConversationMetaDTO::from)
        .toList();
}
```

### 6.2 权限模型

| 操作 | 普通用户 | Admin |
|------|---------|-------|
| 列出自己的会话 | ✅ | ✅ |
| 列出他人会话 | ❌ | ✅（指定 user_id） |
| 创建/更新自己的 meta | ✅ | ✅ |
| 更新他人 meta | ❌ | ❌（暂不开放）|
| 删除自己的会话 | ✅ | ✅ |
| 删除他人会话 | ❌ | ✅ |

## 7. 测试

### 7.1 单元测试

```java
// ConversationMetaServiceTest.java
@ExtendWith(MockitoExtension.class)
class ConversationMetaServiceTest {

    @Mock ConversationMetaRepository repo;
    @Mock AiProxyService aiProxyService;
    @InjectMocks ConversationMetaService service;

    @Test
    void createOrGet_createsNewIfAbsent() {
        when(repo.findByUserIdAndThreadId(any(), any())).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ConversationMeta meta = service.createOrGet(UUID.randomUUID(), "ai-doctor", "thread_1", "测试");

        assertThat(meta.getTitle()).isEqualTo("测试");
        verify(repo).save(any());
    }

    @Test
    void delete_cascadesToAiRuntime() {
        // ...
    }

    @Test
    void delete_throwsUnauthorized_whenNotOwner() {
        // ...
    }
}
```

### 7.2 集成测试

```java
@SpringBootTest
@AutoConfigureMockMvc
class ConversationMetaIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ConversationMetaRepository repo;

    @Test
    @WithMockUser(username = "test@test.com")
    void authenticated_user_canListOwnConversations() throws Exception {
        mvc.perform(get("/api/v1/ai/conversations?graph=ai-doctor"))
            .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "test@test.com", roles = "USER")
    void nonAdmin_cannotListOtherUsersConversations() throws Exception {
        mvc.perform(get("/api/v1/ai/conversations?graph=ai-doctor&userId=" + UUID.randomUUID()))
            .andExpect(status().isForbidden());
    }
}
```

## 8. 迁移期兼容

`emomind-sb` → `emomind-lg` 迁移时，Dify 的会话数据可以导入到 `conversation_meta`：

```sql
-- 一次性导入脚本（V5 migration 后手动跑）
INSERT INTO conversation_meta (user_id, graph, thread_id, title, created_at, updated_at)
SELECT
    u.id,
    'ai-doctor',  -- 假设都映射到 ai-doctor
    dify_conversation_id,  -- Dify 的 conversation_id 字段
    name,
    created_at,
    updated_at
FROM dify_old_conversations  -- 临时表，从 Dify DB 导出
JOIN users u ON u.email = dify_old_conversations.user_email;
```

实际实施时根据 Dify DB schema 调整。

## 9. 已知坑

| 坑 | 解决 |
|----|------|
| thread_id 在 PostgresSaver 里可能含特殊字符 | 用 TEXT 列，不约束 |
| message_count 累加需要在每个 user/assistant 消息后触发 | 通过 ai-runtime 的 SSE 事件，Spring 监听并更新 |
| 管理员删除他人会话：ai-runtime checkpoint 删除需要 admin 凭证 | ai-runtime 的 `/v1/internal/checkpoints/{thread_id}` 仅校验 Internal Token，不校验 user；Spring 调用时直接传 |
| JSONB 字段查询性能 | 不做复杂查询；只存展示用元数据 |