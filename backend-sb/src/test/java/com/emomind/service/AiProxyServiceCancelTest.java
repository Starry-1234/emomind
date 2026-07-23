package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceCancelTest {

    private MockWebServer server;
    private AiProxyService service;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        LangGraphProperties props = new LangGraphProperties();
        props.setRuntimeUrl(server.url("/").toString().replaceAll("/$", ""));
        props.setInternalToken("test-internal-token-32-chars-long-pad");
        WebClient wc = WebClient.builder().baseUrl(props.getRuntimeUrl()).build();
        service = new AiProxyService(wc, props);
    }

    @AfterEach
    void tearDown() throws Exception { server.shutdown(); }

    @Test
    void proxyCancel_sets_redis_flag() throws Exception {
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "application/json")
            .setBody("{\"thread_id\":\"t-1\",\"cancelled\":true}"));

        UUID userId = UUID.randomUUID();
        Mono<java.util.Map> mono = service.proxyCancel(userId, "t-1");
        StepVerifier.create(mono)
            .assertNext(body -> {
                assertThat(body).containsEntry("cancelled", true);
            })
            .verifyComplete();

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/conversations/t-1/cancel");
        assertThat(req.getMethod()).isEqualTo("POST");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-pad");
    }
}
