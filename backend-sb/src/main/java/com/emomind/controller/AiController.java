package com.emomind.controller;

import com.emomind.dto.request.ChatRequest;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.AiProxyService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);
    private final AiProxyService aiProxyService;

    public AiController(AiProxyService aiProxyService) {
        this.aiProxyService = aiProxyService;
    }

    @GetMapping("/healthz")
    public ResponseEntity<?> healthz() {
        return ResponseEntity.ok().body(java.util.Map.of(
            "status", "ok",
            "service", "ai-gateway",
            "note", "ai-runtime integration ships in M1"
        ));
    }

    @PostMapping(value = "/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public void chat(@Valid @RequestBody ChatRequest request, HttpServletResponse response) throws java.io.IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"detail\":\"Unauthorized\"}");
            return;
        }
        Object principal = auth.getPrincipal();
        UUID userId = (principal instanceof UserDetailsImpl u) ? u.getId() : UUID.fromString(auth.getName());
        Set<String> roles = auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.toSet());

        log.info("chat request user={} graph={} thread={}", userId, request.getGraph(), request.getThreadId());

        // SSE 三层透传：同步写 ai-runtime 的 DataBuffer 字节到 servlet OutputStream。
        // 不返回 ResponseEntity/StreamingResponseBody — 那会触发 Spring MVC 异步派发，
        // 异步派发时 SecurityContext 已被清理，filter chain 第二次跑会 401
        // （response 已 committed → "Unable to handle" 噪音）。
        // 原代码 ResponseEntity<Flux<DataBuffer>> 还会被 Spring MVC 当 POJO 序列化成
        // DataBuffer 内部 JSON 字段。
        response.setStatus(HttpStatus.OK.value());
        response.setContentType("text/event-stream;charset=UTF-8");
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Connection", "keep-alive");
        response.setHeader("X-Accel-Buffering", "no");

        Flux<DataBuffer> stream = aiProxyService.proxyChatStream(
            userId, roles, request.getGraph(), request.getThreadId(), request.getInput());

        java.io.OutputStream out = response.getOutputStream();
        try {
            if (stream == null) {
                throw new IllegalStateException("ai-runtime returned null stream");
            }
            for (DataBuffer buf : stream.toIterable()) {
                try {
                    byte[] bytes = new byte[buf.readableByteCount()];
                    buf.read(bytes);
                    out.write(bytes);
                    out.flush();
                } finally {
                    DataBufferUtils.release(buf);
                }
            }
        } catch (java.io.IOException e) {
            // 客户端断开 / 写错误 — response 已 committed，只能 log
            log.warn("chat stream write error user={}: {}", userId, e.getMessage());
        } catch (RuntimeException e) {
            // 写之前的异常（ai-runtime 连不上等）— response 已 committed
            log.error("chat stream error user={}: {}", userId, e.getMessage(), e);
        }
    }

    /**
     * Cancel a running chat stream. M1: no-op (M5 will wire Redis-backed cancel
     * via ai-runtime's /v1/chat/stop). Frontend uses AbortSignal at the call site
     * for actual stream termination; this endpoint exists so the route is wired
     * end-to-end and M5+ diagnostics can be added without a frontend change.
     */
    @PostMapping("/chat/stop")
    public ResponseEntity<Void> stopChat(@RequestBody Map<String, String> body) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Object principal = auth.getPrincipal();
        UUID userId = (principal instanceof UserDetailsImpl u) ? u.getId() : UUID.fromString(auth.getName());

        String threadId = body == null ? "" : (body.get("thread_id") == null ? "" : body.get("thread_id"));
        String runId = body == null ? "" : (body.get("run_id") == null ? "" : body.get("run_id"));
        log.info("stop request user={} thread={} run={}", userId, threadId, runId);

        aiProxyService.proxyStop(userId, threadId, runId);
        return ResponseEntity.noContent().build();
    }

    /**
     * M5 T3: cancel a running conversation. Proxies POST
     * /v1/conversations/{threadId}/cancel to ai-runtime, which sets a
     * Redis cancel flag (M5 T1). Returns 200 with the ai-runtime body
     * (e.g. {cancelled: true}); 401 if unauthenticated; 503 on ai-runtime
     * failure. Not a streaming response — a normal JSON Mono.
     */
    @PostMapping("/conversations/{threadId}/cancel")
    public Mono<ResponseEntity<Map>> cancel(@PathVariable String threadId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return Mono.just(ResponseEntity.status(401).build());
        }
        Object principal = auth.getPrincipal();
        UUID userId = (principal instanceof UserDetailsImpl u) ? u.getId() : UUID.fromString(auth.getName());

        log.info("cancel conversation user={} thread_id={}", userId, threadId);
        return aiProxyService.proxyCancel(userId, threadId)
            .map(body -> ResponseEntity.ok(body))
            .onErrorResume(e -> Mono.just(ResponseEntity.status(503).build()));
    }
}
