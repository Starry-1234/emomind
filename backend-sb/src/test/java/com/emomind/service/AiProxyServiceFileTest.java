package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceFileTest {

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
        props.setMaxFileSizeMb(50L);

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
    void proxyFileUpload_forwardsMultipart_andReturnsMap() throws Exception {
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "application/json")
            .setBody("{\"file_id\":\"abc123\",\"url\":\"http://x\",\"mime\":\"image/png\",\"size\":1024,\"name\":\"a.png\"}"));

        UUID userId = UUID.randomUUID();
        byte[] data = new byte[]{1, 2, 3, 4};
        MockMultipartFile mf = new MockMultipartFile("file", "a.png", "image/png", data);

        Map<String, Object> result = service.proxyFileUpload(mf, userId);
        assertThat(result).containsEntry("file_id", "abc123");
        assertThat(result).containsEntry("mime", "image/png");
        assertThat(result).containsEntry("size", 1024);

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/files/upload");
        assertThat(req.getMethod()).isEqualTo("POST");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-xxxx");
        assertThat(req.getHeader("X-Trace-Id")).isNotBlank();
        String body = req.getBody().readUtf8();
        assertThat(body).contains("a.png");
        assertThat(body).contains("image/png");
    }

    @Test
    void proxyFileDownload_returnsByteArray() throws Exception {
        byte[] payload = new byte[]{0x10, 0x20, 0x30};
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "image/png")
            .setBody(new okio.Buffer().write(payload)));

        UUID userId = UUID.randomUUID();
        Mono<byte[]> mono = service.proxyFileDownload("abc123", userId);
        StepVerifier.create(mono)
            .assertNext(bytes -> {
                assertThat(bytes).isEqualTo(payload);
            })
            .verifyComplete();

        RecordedRequest req = server.takeRequest();
        assertThat(req.getPath()).isEqualTo("/v1/files/abc123");
        assertThat(req.getMethod()).isEqualTo("GET");
        assertThat(req.getHeader("X-Internal-Token")).isEqualTo("test-internal-token-32-chars-long-xxxx");
        assertThat(req.getHeader("X-User-Id")).isEqualTo(userId.toString());
    }
}