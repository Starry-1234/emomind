package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceTestRecordTest {

    private MockWebServer server;
    private AiProxyService service;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        LangGraphProperties props = new LangGraphProperties();
        props.setRuntimeUrl(server.url("/").toString().replaceAll("/$", ""));
        props.setInternalToken("test-internal-token-32-chars-long-xxxx");
        WebClient webClient = WebClient.builder().baseUrl(props.getRuntimeUrl()).build();
        service = new AiProxyService(webClient, props);
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void proxyTestRecordPersist_forwards_body_and_returns_id() throws Exception {
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "application/json")
            .setBody("{\"test_record_id\":\"r-1\"}"));

        UUID userId = UUID.randomUUID();
        Map<String, Object> body = Map.of(
            "graph", "psych-test",
            "thread_id", "t-1",
            "test_name", "PHQ",
            "user_topic", "x",
            "total_score", 5,
            "total_max", 27,
            "result_description", "ok",
            "questions", List.of(),
            "answers", List.of(),
            "scoring_ranges", List.of()
        );
        String id = service.proxyTestRecordPersist(userId, body);
        assertThat(id).isEqualTo("r-1");

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/test-records");
        assertThat(req.getMethod()).isEqualTo("POST");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-xxxx");
        String reqBody = req.getBody().readUtf8();
        assertThat(reqBody).contains("psych-test").contains("PHQ");
    }
}