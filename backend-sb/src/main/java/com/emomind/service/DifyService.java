package com.emomind.service;

import com.emomind.config.DifyProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class DifyService {

    private final WebClient difyWebClient;
    private final DifyProperties difyProperties;

    public Flux<String> sendChatMessage(String apiKeyName, Map<String, Object> requestBody) {
        String apiKey = difyProperties.resolveApiKey(apiKeyName);
        log.info("Sending chat message to Dify with key: {}", apiKeyName);
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
                    String chunk = new String(bytes, StandardCharsets.UTF_8);
                    log.debug("Dify chunk received: {}", chunk);
                    return chunk;
                })
                .doOnError(e -> {
                    if (e instanceof WebClientResponseException wcre) {
                        log.error("Dify API error: {} - {}", wcre.getStatusCode(), wcre.getResponseBodyAsString());
                    } else {
                        log.error("Dify chat error: {} - {}", e.getClass().getSimpleName(), e.getMessage());
                    }
                });
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
                .onStatus(status -> status.value() == 404, response -> {
                    log.warn("Dify conversations not found for user {}, key {}", user, apiKeyName);
                    return Mono.empty();
                })
                .bodyToMono(Map.class)
                .switchIfEmpty(Mono.just(Map.of("data", List.of(), "has_more", false, "limit", 20)))
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
                .onStatus(status -> status.value() == 404, response -> {
                    log.warn("Dify conversation {} not found for key {}", conversationId, apiKeyName);
                    return Mono.empty();
                })
                .bodyToMono(Map.class)
                .switchIfEmpty(Mono.just(Map.of("data", List.of(), "has_more", false, "limit", 20)))
                .block();
    }

    public void deleteConversation(String conversationId, String user, String apiKeyName) {
        String apiKey = difyProperties.resolveApiKey(apiKeyName);
        // Dify DELETE /conversations/{id} 要求 user 字段在 JSON request body 里，而非 query param
        Map<String, Object> body = Map.of("user", user);
        try {
            difyWebClient.method(HttpMethod.DELETE)
                    .uri("/conversations/" + conversationId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(body)
                    .retrieve()
                    .toBodilessEntity()
                    .block();
            log.info("Conversation {} deleted successfully", conversationId);
        } catch (Exception e) {
            log.error("Failed to delete conversation {} from Dify: {} - {}", conversationId, e.getClass().getSimpleName(), e.getMessage());
            // 抛出异常，让 Controller 层返回错误响应给前端
            if (e instanceof org.springframework.web.reactive.function.client.WebClientResponseException) {
                org.springframework.web.reactive.function.client.WebClientResponseException wcre =
                        (org.springframework.web.reactive.function.client.WebClientResponseException) e;
                throw new RuntimeException("Dify API 删除会话失败: " + wcre.getResponseBodyAsString(), wcre);
            }
            throw new RuntimeException("删除会话失败: " + e.getMessage(), e);
        }
    }
}
