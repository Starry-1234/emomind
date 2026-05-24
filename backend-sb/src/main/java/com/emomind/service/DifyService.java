package com.emomind.service;

import com.emomind.config.DifyProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DifyService {

    private final WebClient difyWebClient;
    private final DifyProperties difyProperties;

    public Flux<String> sendChatMessage(String apiKeyName, Map<String, Object> requestBody) {
        String apiKey = difyProperties.resolveApiKey(apiKeyName);
        return difyWebClient.post()
                .uri("/chat-messages")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(DataBuffer.class)
                .map(buffer -> {
                    byte[] bytes = new byte[buffer.readableByteCount()];
                    buffer.read(bytes);
                    return new String(bytes);
                })
                .doOnError(e -> log.error("Dify chat error: {}", e.getMessage()));
    }

    public Map<String, Object> uploadFile(String apiKeyName, Map<String, Object> requestBody) {
        String apiKey = difyProperties.resolveApiKey(apiKeyName);
        return difyWebClient.post()
                .uri("/files/upload")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    public Map<String, Object> getConversations(String user, String apiKeyName) {
        String apiKey = difyProperties.resolveApiKey(apiKeyName);
        return difyWebClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/conversations")
                        .queryParam("user", user)
                        .build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    public Map<String, Object> getMessages(String user, String conversationId, String apiKeyName) {
        String apiKey = difyProperties.resolveApiKey(apiKeyName);
        return difyWebClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/messages")
                        .queryParam("user", user)
                        .queryParam("conversation_id", conversationId)
                        .build())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .retrieve()
                .bodyToMono(Map.class)
                .block();
    }

    public void deleteConversation(String conversationId, String apiKeyName) {
        String apiKey = difyProperties.resolveApiKey(apiKeyName);
        difyWebClient.delete()
                .uri("/conversations/" + conversationId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .retrieve()
                .toBodilessEntity()
                .block();
    }
}
