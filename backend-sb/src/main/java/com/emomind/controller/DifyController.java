package com.emomind.controller;

import com.emomind.dto.response.MessageResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.DifyService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/dify")
@RequiredArgsConstructor
@Tag(name = "Dify AI", description = "Dify AI 平台代理（聊天、文件上传、会话管理）")
public class DifyController {

    private static final String SSE_CONTENT_TYPE = MediaType.TEXT_EVENT_STREAM_VALUE + ";charset=UTF-8";
    private static final int FLUSH_THRESHOLD = 512;

    private final DifyService difyService;
    private final ObjectMapper objectMapper;

    @PostMapping(value = "/chat-messages", produces = SSE_CONTENT_TYPE)
    @Operation(summary = "发送聊天消息，返回 SSE 流式响应")
    public void sendChatMessage(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestBody Map<String, Object> requestBody,
            HttpServletResponse response) {

        requestBody.put("user", user.getId().toString());

        // 必须在获取 OutputStream 之前设置头
        response.setContentType(SSE_CONTENT_TYPE);
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("X-Accel-Buffering", "no");

        OutputStream out = null;
        // 客户端断开时 dispose 上游 subscription，让 WebClient 立即停止从 Dify 读取，
        // 避免 blockLast() 在请求线程上无限等待慢响应耗尽 Tomcat 工作线程。
        final java.util.concurrent.atomic.AtomicReference<org.reactivestreams.Subscription> subscriptionRef =
                new java.util.concurrent.atomic.AtomicReference<>();
        try {
            out = response.getOutputStream();
            final OutputStream finalOut = out; // 用于 lambda 内引用
            final int[] bytesSinceFlush = {0};

            difyService.sendChatMessage(apiKeyName, requestBody)
                    .doOnSubscribe(subscriptionRef::set)
                    .doOnNext(chunk -> {
                        try {
                            byte[] bytes = chunk.getBytes(StandardCharsets.UTF_8);
                            synchronized (finalOut) {
                                finalOut.write(bytes);
                                bytesSinceFlush[0] += bytes.length;
                                if (bytesSinceFlush[0] >= FLUSH_THRESHOLD) {
                                    finalOut.flush();
                                    bytesSinceFlush[0] = 0;
                                }
                            }
                        } catch (IOException e) {
                            log.warn("Failed to write chunk: {}", e.getMessage());
                            throw new RuntimeException(e);
                        }
                    })
                    .doOnCancel(() -> {
                        log.debug("SSE stream cancelled by client");
                        org.reactivestreams.Subscription sub = subscriptionRef.get();
                        if (sub != null) {
                            sub.cancel();
                        }
                    })
                    .blockLast();

            // blockLast() 成功完成，立即写 [DONE]，此时 out 一定还开着
            synchronized (out) {
                out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
                out.flush();
            }
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            boolean clientAbort = msg.contains("Broken pipe")
                    || msg.contains("Connection reset")
                    || msg.contains("cancel");
            if (clientAbort) {
                log.debug("SSE stream aborted by client: {}", msg);
            } else {
                log.error("SSE stream exception: {}", msg);
            }
            // 尝试写入错误帧 + [DONE]，如果 out 已关闭则静默失败
            if (out != null) {
                try {
                    synchronized (out) {
                        // 用 Jackson 序列化错误对象，自动处理 \n、\r、\t、Unicode 转义，
                        // 避免手写字符串拼接破坏 SSE 帧和 JSON 语法。
                        Map<String, Object> errorPayload = new LinkedHashMap<>();
                        errorPayload.put("event", "error");
                        errorPayload.put("message", msg);
                        String errorJson = objectMapper.writeValueAsString(errorPayload);
                        out.write(("data: " + errorJson + "\n\n").getBytes(StandardCharsets.UTF_8));
                        out.write("data: [DONE]\n\n".getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    }
                } catch (IOException ignored) {
                    // 客户端已断开或 Jackson 异常，忽略
                }
            }
        } finally {
            // 显式关闭输出流，确保 chunked encoding 的终止块被发送
            if (out != null) {
                try {
                    out.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    @PostMapping("/files/upload")
    @Operation(summary = "上传文件到 Dify")
    public ResponseEntity<Map<String, Object>> uploadFile(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestBody Map<String, Object> requestBody) {

        requestBody.put("user", user.getId().toString());
        return ResponseEntity.ok(difyService.uploadFile(apiKeyName, requestBody));
    }

    @GetMapping("/conversations")
    @Operation(summary = "获取用户的对话列表（管理员可查看指定用户的会话）")
    public ResponseEntity<Map<String, Object>> getConversations(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestParam(name = "user", required = false) String targetUserId) {

        String userId = resolveTargetUserId(user, targetUserId);
        return ResponseEntity.ok(difyService.getConversations(userId, apiKeyName));
    }

    @GetMapping("/messages")
    @Operation(summary = "获取指定对话的消息历史（管理员可查看指定用户的会话）")
    public ResponseEntity<Map<String, Object>> getMessages(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestParam(name = "conversation_id") String conversationId,
            @RequestParam(name = "user", required = false) String targetUserId) {

        String userId = resolveTargetUserId(user, targetUserId);
        return ResponseEntity.ok(difyService.getMessages(userId, conversationId, apiKeyName));
    }

    private String resolveTargetUserId(UserDetailsImpl currentUser, String targetUserId) {
        if (Boolean.TRUE.equals(currentUser.getSuperuser()) && targetUserId != null) {
            return targetUserId;
        }
        return currentUser.getId().toString();
    }

    @DeleteMapping("/conversations/{id}")
    @Operation(summary = "删除指定对话（管理员可删除指定用户的会话）")
    public ResponseEntity<MessageResponse> deleteConversation(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable String id,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestParam(name = "user", required = false) String targetUserId) {

        String userId = resolveTargetUserId(user, targetUserId);
        difyService.deleteConversation(id, userId, apiKeyName);
        return ResponseEntity.ok(new MessageResponse("Conversation deleted successfully"));
    }
}
