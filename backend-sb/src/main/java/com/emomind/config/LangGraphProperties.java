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

    /** Total request timeout in milliseconds (covers full SSE stream). */
    private long requestTimeoutMs = 120000L;

    /** TCP connect timeout for ai-runtime. */
    private long connectTimeoutMs = 5000L;
}