package com.emomind.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * AI gateway controller — proxies requests to the LangGraph ai-runtime.
 *
 * M0: only /healthz is implemented (returns 200 if Spring can reach this code).
 * Real /chat (SSE), /chat/stop, /conversations, /messages, /files endpoints
 * land in M1 / M4.
 *
 * All endpoints under /api/v1/ai/** require authentication (handled by SecurityConfig),
 * except /api/v1/ai/healthz which is public for health checks.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI", description = "LangGraph ai-runtime 代理（聊天 / 会话 / 文件）")
public class AiController {

    @GetMapping("/healthz")
    @Operation(summary = "AI 路由存活检查（公开）")
    public ResponseEntity<Map<String, Object>> healthz() {
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "service", "ai-gateway",
            "note", "ai-runtime integration ships in M1"
        ));
    }

    /**
     * Catch-all for unimplemented endpoints so they return 501 instead of 404
     * while we're still building M1+ endpoints.
     */
    @RequestMapping(value = "/**", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.NOT_IMPLEMENTED)
    public ResponseEntity<Map<String, Object>> notImplemented() {
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).body(Map.of(
            "code", "NOT_IMPLEMENTED",
            "message", "This AI endpoint is not yet implemented (Milestone 0 stub)"
        ));
    }
}