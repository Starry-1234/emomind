package com.emomind.controller;

import com.emomind.dto.response.MessageResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.DifyService;
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
public class DifyController {

    private final DifyService difyService;

    @PostMapping(value = "/chat-messages", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
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
    public ResponseEntity<Map<String, Object>> uploadFile(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestBody Map<String, Object> requestBody) {

        requestBody.put("user", user.getId().toString());
        return ResponseEntity.ok(difyService.uploadFile(apiKeyName, requestBody));
    }

    @GetMapping("/conversations")
    public ResponseEntity<Map<String, Object>> getConversations(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName) {

        return ResponseEntity.ok(difyService.getConversations(
                user.getId().toString(), apiKeyName));
    }

    @GetMapping("/messages")
    public ResponseEntity<Map<String, Object>> getMessages(
            @AuthenticationPrincipal UserDetailsImpl user,
            @RequestParam(name = "api_key_name") String apiKeyName,
            @RequestParam(name = "conversation_id") String conversationId) {

        return ResponseEntity.ok(difyService.getMessages(
                user.getId().toString(), conversationId, apiKeyName));
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<MessageResponse> deleteConversation(
            @PathVariable String id,
            @RequestParam(name = "api_key_name") String apiKeyName) {

        difyService.deleteConversation(id, apiKeyName);
        return ResponseEntity.ok(new MessageResponse("Conversation deleted successfully"));
    }
}
