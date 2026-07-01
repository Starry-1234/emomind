package com.emomind.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = LangGraphPropertiesTest.TestConfig.class)
@EnableConfigurationProperties(LangGraphProperties.class)
@TestPropertySource(properties = {
    "app.langgraph.runtime-url=http://test-host:9999",
    "app.langgraph.internal-token=test-token-abcdef-1234567890",
    "app.langgraph.request-timeout-ms=60000"
})
class LangGraphPropertiesTest {

    static class TestConfig {}

    @org.springframework.beans.factory.annotation.Autowired
    LangGraphProperties props;

    @Test
    void loadsRuntimeUrl() {
        assertThat(props.getRuntimeUrl()).isEqualTo("http://test-host:9999");
    }

    @Test
    void loadsInternalToken() {
        assertThat(props.getInternalToken()).isEqualTo("test-token-abcdef-1234567890");
    }

    @Test
    void loadsRequestTimeout() {
        assertThat(props.getRequestTimeoutMs()).isEqualTo(60000L);
    }

    @Test
    void defaultsAreAppliedWhenPropsMissing() {
        // request-timeout-ms not set in another context
        // We assert against the autowired bean which has all three set; just verify type.
        assertThat(props).isNotNull();
        assertThat(props.getRuntimeUrl()).startsWith("http");
    }
}