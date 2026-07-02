package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AiProxyService {

    private static final Logger log = LoggerFactory.getLogger(AiProxyService.class);
    private final WebClient aiRuntimeWebClient;
    private final LangGraphProperties props;

    public AiProxyService(WebClient aiRuntimeWebClient, LangGraphProperties props) {
        this.aiRuntimeWebClient = aiRuntimeWebClient;
        this.props = props;
    }

    public Flux<DataBuffer> proxyChatStream(
            UUID userId,
            Set<String> roles,
            String graph,
            String threadId,
            Map<String, Object> input) {

        String traceId = UUID.randomUUID().toString();
        Map<String, Object> body = Map.of(
            "graph", graph,
            "thread_id", threadId == null ? "" : threadId,
            "input", input
        );

        return aiRuntimeWebClient.post()
            .uri("/v1/chat")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.TEXT_EVENT_STREAM)
            .header("X-User-Id", userId.toString())
            .header("X-User-Roles", String.join(",", roles))
            .header("X-Internal-Token", props.getInternalToken())
            .header("X-Trace-Id", traceId)
            .bodyValue(body)
            .retrieve()
            .bodyToFlux(DataBuffer.class)
            .doOnError(e -> log.error("ai-runtime chat stream error trace={}", traceId, e));
    }

    /** M5 stub — present so the controller compiles if any caller hits /chat/stop. */
    public Mono<Void> proxyStop(UUID userId, String threadId, String runId) {
        log.warn("proxyStop called but not implemented in M1 — thread={} run={}", threadId, runId);
        return Mono.empty();
    }
}
