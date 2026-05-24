package com.emomind.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

@Data
@Configuration
@ConfigurationProperties(prefix = "app.dify")
public class DifyProperties {

    private String apiUrl = "http://localhost/v1";
    private String aiDoctorApiKey = "";
    private String testApiKey = "";

    public Map<String, String> getApiKeys() {
        Map<String, String> keys = new HashMap<>();
        if (!aiDoctorApiKey.isBlank()) {
            keys.put("ai-doctor", aiDoctorApiKey);
        }
        if (!testApiKey.isBlank()) {
            keys.put("test", testApiKey);
        }
        return keys;
    }

    public String resolveApiKey(String apiKeyName) {
        return getApiKeys().getOrDefault(apiKeyName, "");
    }
}
