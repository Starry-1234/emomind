package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import com.emomind.exception.FileAccessDeniedException;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceFileAclTest {

    private MockWebServer server;
    private AiProxyService service;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        LangGraphProperties props = new LangGraphProperties();
        props.setRuntimeUrl(server.url("/").toString().replaceAll("/$", ""));
        props.setInternalToken("test-internal-token-32-chars-long-xxxx");
        service = new AiProxyService(
            WebClient.builder().baseUrl(props.getRuntimeUrl()).build(),
            props
        );
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void proxyFileDownload_returns_403_on_user_mismatch() {
        // ai-runtime returns 403 with code=FILE_ACCESS_DENIED
        server.enqueue(new MockResponse()
            .setResponseCode(403)
            .setHeader("Content-Type", "application/json")
            .setBody("{\"detail\":{\"code\":\"FILE_ACCESS_DENIED\"}}"));

        UUID userId = UUID.randomUUID();
        Mono<byte[]> mono = service.proxyFileDownload("file-1", userId);
        StepVerifier.create(mono)
            .expectErrorMatches(t -> t instanceof FileAccessDeniedException
                || (t.getMessage() != null && t.getMessage().toLowerCase().contains("access denied")))
            .verify();
    }

    @Test
    void proxyFileDownload_returns_bytes_on_200() {
        server.enqueue(new MockResponse()
            .setHeader("Content-Type", "image/png")
            .setBody(new okio.Buffer().write(new byte[]{1, 2, 3})));

        UUID userId = UUID.randomUUID();
        StepVerifier.create(service.proxyFileDownload("file-1", userId))
            .assertNext(bytes -> assertThat(bytes).isEqualTo(new byte[]{1, 2, 3}))
            .verifyComplete();
    }
}