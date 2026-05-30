package com.emomind.controller;

import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import com.emomind.service.DifyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DifyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockBean
    private DifyService difyService;

    private String userToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        var user = new com.emomind.entity.User();
        user.setEmail("user@example.com");
        user.setHashedPassword(passwordEncoder.encode("password123"));
        user.setActive(true);
        user.setSuperuser(false);
        user = userRepository.save(user);
        userToken = tokenProvider.generateToken(user.getId().toString());
    }

    @Test
    void shouldGetConversations() throws Exception {
        when(difyService.getConversations(any(), eq("ai-doctor")))
                .thenReturn(Map.of("data", java.util.List.of()));

        mockMvc.perform(get("/api/v1/dify/conversations")
                        .param("api_key_name", "ai-doctor")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void shouldGetMessages() throws Exception {
        when(difyService.getMessages(any(), eq("conv-123"), eq("ai-doctor")))
                .thenReturn(Map.of("data", java.util.List.of()));

        mockMvc.perform(get("/api/v1/dify/messages")
                        .param("api_key_name", "ai-doctor")
                        .param("conversation_id", "conv-123")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void shouldDeleteConversation() throws Exception {
        mockMvc.perform(delete("/api/v1/dify/conversations/conv-123")
                        .param("api_key_name", "ai-doctor")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Conversation deleted successfully"));
    }

    @Test
    void shouldReturnStreamForChatMessages() throws Exception {
        when(difyService.sendChatMessage(eq("ai-doctor"), any()))
                .thenReturn(reactor.core.publisher.Flux.just("data: hello\n\n"));

        mockMvc.perform(post("/api/v1/dify/chat-messages")
                        .param("api_key_name", "ai-doctor")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"inputs\":{},\"query\":\"hello\"}"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(org.springframework.http.MediaType.TEXT_EVENT_STREAM));
    }
}
