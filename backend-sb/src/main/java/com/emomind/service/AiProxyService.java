package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import com.emomind.exception.FileAccessDeniedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
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

    /**
     * Backward-compat no-op. Kept so the {@code /chat/stop} route stays wired
     * (legacy clients may still call it). The real cancel path is
     * {@code proxyCancel} (M5 T3), which sets a Redis flag via ai-runtime.
     */
    public Mono<Void> proxyStop(UUID userId, String threadId, String runId) {
        log.info("proxyStop called (legacy endpoint, no-op) thread={} run={}", threadId, runId);
        return Mono.empty();
    }

    /** M2: forward multipart upload to ai-runtime /v1/files/upload. */
    public Map<String, Object> proxyFileUpload(MultipartFile file, UUID userId) {
        String traceId = UUID.randomUUID().toString();
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (Exception e) {
            throw new RuntimeException("Failed to read uploaded file", e);
        }
        long size = bytes.length;
        if (size > props.getMaxFileSizeMb() * 1024L * 1024L) {
            throw new IllegalArgumentException(
                "File too large: " + size + " bytes (max " + props.getMaxFileSizeMb() + " MB)");
        }
        ByteArrayResource resource = new ByteArrayResource(bytes) {
            @Override
            public String getFilename() { return originalName; }
            @Override
            public long contentLength() { return size; }
        };
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("file", resource).header("Content-Type", contentType);
        return aiRuntimeWebClient.post()
            .uri("/v1/files/upload")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .header("X-User-Id", userId.toString())
            .header("X-Internal-Token", props.getInternalToken())
            .header("X-Trace-Id", traceId)
            .bodyValue(builder.build())
            .retrieve()
            .bodyToMono(Map.class)
            .doOnError(e -> log.error("ai-runtime file upload error trace={}", traceId, e))
            .block();
    }

    /** M2: forward file download from ai-runtime /v1/files/{fileId}. */
    public Mono<byte[]> proxyFileDownload(String fileId, UUID userId) {
        String traceId = UUID.randomUUID().toString();
        return aiRuntimeWebClient.get()
            .uri("/v1/files/{fileId}", fileId)
            .header("X-User-Id", userId.toString())
            .header("X-Internal-Token", props.getInternalToken())
            .header("X-Trace-Id", traceId)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, resp -> {
                if (resp.statusCode().value() == 403) {
                    return resp.bodyToMono(String.class).flatMap(body ->
                        Mono.error(new FileAccessDeniedException("File access denied: " + fileId))
                    );
                }
                return resp.createException();
            })
            .bodyToMono(byte[].class)
            .doOnError(e -> log.error("ai-runtime file download error trace={}", traceId, e));
    }

    /**
     * M4 T2: forward a completed psych-test (or other scored) result to
     * ai-runtime's POST /v1/test-records so the Python side can persist it.
     * Returns the test_record_id from the ai-runtime response.
     */
    public String proxyTestRecordPersist(UUID userId, Map<String, Object> body) {
        String traceId = UUID.randomUUID().toString();
        @SuppressWarnings("unchecked")
        Map<String, Object> resp = aiRuntimeWebClient.post()
            .uri("/v1/test-records")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-User-Id", userId.toString())
            .header("X-Internal-Token", props.getInternalToken())
            .header("X-Trace-Id", traceId)
            .bodyValue(body)
            .retrieve()
            .bodyToMono(Map.class)
            .doOnError(e -> log.error("ai-runtime test record persist error trace={}", traceId, e))
            .block();
        return resp != null ? (String) resp.get("test_record_id") : null;
    }

    /**
     * M5 T3: forward POST /v1/conversations/{threadId}/cancel to ai-runtime,
     * which sets a Redis cancel flag (wired in M5 T1). Returns the parsed
     * JSON body (e.g. {thread_id, cancelled}). X-User-Id is the caller's id.
     */
    public Mono<Map> proxyCancel(UUID userId, String threadId) {
        String traceId = UUID.randomUUID().toString();
        return aiRuntimeWebClient.post()
            .uri("/v1/conversations/{threadId}/cancel", threadId)
            .header("X-User-Id", userId.toString())
            .header("X-Internal-Token", props.getInternalToken())
            .header("X-Trace-Id", traceId)
            .retrieve()
            .bodyToMono(Map.class)
            .doOnError(e -> log.error("ai-runtime cancel error trace={}", traceId, e));
    }

    /**
     * M5 T3: forward GET /v1/files?prefix=X to ai-runtime, which returns only
     * files owned by the calling user (ACL enforced server-side via X-User-Id;
     * T4 adds the ai-runtime endpoint). prefix is optional (null = no filter).
     */
    public Flux<Map> proxyFileList(UUID userId, String prefix) {
        String traceId = UUID.randomUUID().toString();
        return aiRuntimeWebClient.get()
            .uri(uriBuilder -> {
                var b = uriBuilder.path("/v1/files");
                if (prefix != null && !prefix.isBlank()) {
                    b.queryParam("prefix", prefix);
                }
                return b.build();
            })
            .header("X-User-Id", userId.toString())
            .header("X-Internal-Token", props.getInternalToken())
            .header("X-Trace-Id", traceId)
            .retrieve()
            .bodyToFlux(Map.class)
            .doOnError(e -> log.error("ai-runtime file list error trace={}", traceId, e));
    }
}
