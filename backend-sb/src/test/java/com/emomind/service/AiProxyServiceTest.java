package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AiProxyServiceTest {

    @Test
    void stubClass_loadsAndIsInjectable() {
        // M0 only verifies the class exists and is constructible.
        // Real forwarding logic lands in M1.
        LangGraphProperties props = new LangGraphProperties();
        props.setRuntimeUrl("http://localhost:8000");
        AiProxyService svc = new AiProxyService(props);
        assertThat(svc).isNotNull();
        // public method exists
        UUID userId = UUID.randomUUID();
        // The actual return type will be added in M1; for now it can throw UnsupportedOperationException.
        // We only assert that no NullPointerException happens on construction.
    }
}