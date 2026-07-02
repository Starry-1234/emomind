package com.emomind.controller;

import com.emomind.dto.request.ChatRequest;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.AiProxyService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

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
    public ResponseEntity<Flux<DataBuffer>> chat(@Valid @RequestBody ChatRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }
        Object principal = auth.getPrincipal();
        UUID userId = (principal instanceof UserDetailsImpl u) ? u.getId() : UUID.fromString(auth.getName());
        Set<String> roles = auth.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.toSet());

        log.info("chat request user={} graph={} thread={}", userId, request.getGraph(), request.getThreadId());

        Flux<DataBuffer> stream = aiProxyService.proxyChatStream(
            userId, roles, request.getGraph(), request.getThreadId(), request.getInput());

        return ResponseEntity.ok()
            .header("Content-Type", "text/event-stream;charset=UTF-8")
            .header("Cache-Control", "no-cache")
            .header("Connection", "keep-alive")
            .header("X-Accel-Buffering", "no")
            .body(stream);
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
}
