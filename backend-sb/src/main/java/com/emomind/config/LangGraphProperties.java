package com.emomind.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "app.langgraph")
public class LangGraphProperties {

    /** Base URL of the ai-runtime Python sidecar (e.g. http://ai-runtime:8000). */
    private String runtimeUrl = "http://localhost:8000";

    /** Shared secret for X-Internal-Token header. Must be at least 32 chars in prod. */
    private String internalToken = "changeme-changeme-changeme-changeme";

    /** TCP connect timeout for ai-runtime (ms). */
    private long connectTimeoutMs = 5000L;

    /** Read/response timeout for ai-runtime (ms). */
    private long responseTimeoutMs = 120000L;

    /**
     * Total request timeout in milliseconds (covers full SSE stream).
     * Kept for M0 back-compat; equivalent to responseTimeoutMs.
     */
    private long requestTimeoutMs = 120000L;

    /** Default text model for ai_doctor graph. */
    private String textModel = "minimax-text-01";

    /** Max upload size in megabytes (M2: applied at FileController before forwarding). */
    private long maxFileSizeMb = 50L;
}
