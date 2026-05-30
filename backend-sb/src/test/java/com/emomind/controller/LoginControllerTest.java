package com.emomind.controller;

import com.emomind.dto.response.TokenResponse;
import com.emomind.dto.response.UserResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(LoginController.class)
@ContextConfiguration(classes = LoginController.class)
@AutoConfigureMockMvc(addFilters = false)
class LoginControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldLoginSuccessfully() throws Exception {
        when(userService.login(anyString(), anyString()))
                .thenReturn(new TokenResponse("token", "bearer"));

        mockMvc.perform(post("/api/v1/login/access-token")
                        .param("username", "test@test.com")
                        .param("password", "password"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").value("token"));
    }

    @Test
    void shouldTestToken() throws Exception {
        UUID id = UUID.randomUUID();
        UserDetailsImpl userDetails = new UserDetailsImpl(id, "test@test.com", false, "pass", Collections.emptyList());
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);

        UserResponse response = new UserResponse();
        response.setId(id);
        when(userService.getCurrentUser(id)).thenReturn(response);

        mockMvc.perform(post("/api/v1/login/test-token"))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRecoverPassword() throws Exception {
        doNothing().when(userService).initiatePasswordReset("test@test.com");
        mockMvc.perform(post("/api/v1/password-recovery/test@test.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("密码重置邮件已发送"));
    }

    @Test
    void shouldResetPassword() throws Exception {
        doNothing().when(userService).resetPassword(anyString(), anyString());
        mockMvc.perform(post("/api/v1/reset-password/")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"abc\",\"newPassword\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("密码已更新"));
    }
}
