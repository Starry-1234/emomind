package com.emomind.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.*;

class DifyPropertiesTest {

    @Test
    void shouldReturnEmptyKeysByDefault() {
        DifyProperties properties = new DifyProperties();
        assertThat(properties.getApiKeys()).isEmpty();
        assertThat(properties.resolveApiKey("ai-doctor")).isEmpty();
    }

    @Test
    void shouldReturnKeysWhenSet() {
        DifyProperties properties = new DifyProperties();
        properties.setAiDoctorApiKey("doctor-key");
        properties.setTestApiKey("test-key");

        var keys = properties.getApiKeys();
        assertThat(keys).hasSize(2);
        assertThat(keys.get("ai-doctor")).isEqualTo("doctor-key");
        assertThat(keys.get("test")).isEqualTo("test-key");
    }

    @Test
    void shouldIgnoreBlankKeys() {
        DifyProperties properties = new DifyProperties();
        properties.setAiDoctorApiKey("  ");
        properties.setTestApiKey("valid-key");

        var keys = properties.getApiKeys();
        assertThat(keys).hasSize(1);
        assertThat(keys.get("test")).isEqualTo("valid-key");
    }

    @Test
    void shouldResolveUnknownKeyToEmpty() {
        DifyProperties properties = new DifyProperties();
        properties.setAiDoctorApiKey("doctor-key");

        assertThat(properties.resolveApiKey("unknown")).isEmpty();
    }

    @Test
    void shouldReturnDefaultApiUrl() {
        DifyProperties properties = new DifyProperties();
        assertThat(properties.getApiUrl()).isEqualTo("http://localhost/v1");
    }
}
