package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.buffer.DataBuffer;
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

    /** M5 stub — present so the controller compiles if any caller hits /chat/stop. */
    public Mono<Void> proxyStop(UUID userId, String threadId, String runId) {
        log.warn("proxyStop called but not implemented in M1 — thread={} run={}", threadId, runId);
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
            .bodyToMono(byte[].class)
            .doOnError(e -> log.error("ai-runtime file download error trace={}", traceId, e));
    }
}
