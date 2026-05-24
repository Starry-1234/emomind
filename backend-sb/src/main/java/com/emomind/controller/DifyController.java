package com.emomind.controller;

import com.emomind.dto.response.MessageResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.DifyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dify")
@RequiredArgsConstructor
@Tag(name = "Dify AI", description = "Dify AI 平台代理（聊天、文件上传、会话管理）")
public class DifyController {

    private final DifyService difyService;

    @PostMapping(value = "/chat-messages", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "发送聊天消息，返回 SSE 流式响应")
    public ResponseEntity<StreamingResponseBody> sendChatMessage(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestBody Map<String, Object> requestBody) {

        requestBody.put("user", user.getId().toString());

        StreamingResponseBody stream = out -> {
            difyService.sendChatMessage(apiKeyName, requestBody)
                    .doOnNext(chunk -> {
                        try {
                            out.write(chunk.getBytes());
                            out.flush();
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    })
                    .blockLast();
        };

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .body(stream);
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
    @Operation(summary = "获取当前用户的对话列表")
    public ResponseEntity<Map<String, Object>> getConversations(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName) {

        return ResponseEntity.ok(difyService.getConversations(
                user.getId().toString(), apiKeyName));
    }

    @GetMapping("/messages")
    @Operation(summary = "获取指定对话的消息历史")
    public ResponseEntity<Map<String, Object>> getMessages(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestParam(name = "conversation_id") String conversationId) {

        return ResponseEntity.ok(difyService.getMessages(
                user.getId().toString(), conversationId, apiKeyName));
    }

    @DeleteMapping("/conversations/{id}")
    @Operation(summary = "删除指定对话")
    public ResponseEntity<MessageResponse> deleteConversation(
            @PathVariable String id,
            @RequestParam(name = "api_key_name") String apiKeyName) {

        difyService.deleteConversation(id, apiKeyName);
        return ResponseEntity.ok(new MessageResponse("Conversation deleted successfully"));
    }
}
