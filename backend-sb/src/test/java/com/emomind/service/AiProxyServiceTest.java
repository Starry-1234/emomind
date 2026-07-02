package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceTest {

    private MockWebServer server;
    private AiProxyService service;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();

        LangGraphProperties props = new LangGraphProperties();
        props.setRuntimeUrl(server.url("/").toString().replaceAll("/$", ""));
        props.setInternalToken("test-internal-token-32-chars-long-xxxx");
        props.setConnectTimeoutMs(1000L);
        props.setResponseTimeoutMs(5000L);

        WebClient webClient = WebClient.builder()
            .baseUrl(props.getRuntimeUrl())
            .build();
        service = new AiProxyService(webClient, props);
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void proxyChatStream_injectsRequiredHeaders() throws Exception {
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "text/event-stream")
            .setBody("event: message_end\ndata: {\"thread_id\":\"t1\",\"run_id\":\"r1\",\"full_content\":\"hi\"}\n\n"));

        UUID userId = UUID.randomUUID();
        Flux<?> stream = service.proxyChatStream(
            userId, Set.of("ROLE_USER"), "ai-doctor", null, Map.of("messages", java.util.List.of()));

        StepVerifier.create(stream).expectNextCount(1).verifyComplete();

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/chat");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
        assertThat(req.getHeader("X-User-Roles")).isEqualTo("ROLE_USER");
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-xxxx");
        assertThat(req.getHeader("X-Trace-Id")).isNotBlank();
        assertThat(req.getMethod()).isEqualTo("POST");
    }
}
