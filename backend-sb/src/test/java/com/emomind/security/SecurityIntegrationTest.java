package com.emomind.security;

import com.emomind.entity.User;
import com.emomind.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void shouldPermitLoginWithoutAuth() throws Exception {
        // LoginController binds a JSON @RequestBody (LoginRequest). Sending form params
        // causes HttpMessageNotReadableException → 500. Send a proper JSON body.
        mockMvc.perform(post("/api/v1/login/access-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"test@test.com\",\"password\":\"pass\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldPermitSignupWithoutAuth() throws Exception {
        mockMvc.perform(post("/api/v1/users/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"new@test.com\",\"password\":\"password123\",\"full_name\":\"New\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void shouldPermitHealthCheck() throws Exception {
        mockMvc.perform(get("/api/v1/utils/health-check/"))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRejectUnauthenticatedRequest() throws Exception {
        // Per M0 spec (doc/langgraph-migration/02-components.md § 1.1),
        // unauthenticated requests return 401 (not Spring's default 403).
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldAuthenticateWithValidToken() throws Exception {
        User user = User.builder()
                .email("auth@test.com")
                .hashedPassword(passwordEncoder.encode("password123"))
                .fullName("Auth User")
                .active(true)
                .superuser(false)
                .streakDays(0)
                .build();
        user = userRepository.save(user);

        String token = tokenProvider.generateToken(user.getId().toString());

        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRejectAdminEndpointForUser() throws Exception {
        User user = User.builder()
                .email("user@test.com")
                .hashedPassword(passwordEncoder.encode("password123"))
                .fullName("Regular User")
                .active(true)
                .superuser(false)
                .streakDays(0)
                .build();
        user = userRepository.save(user);

        String token = tokenProvider.generateToken(user.getId().toString());

        mockMvc.perform(get("/api/v1/users/")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldAllowAdminEndpointForAdmin() throws Exception {
        User admin = User.builder()
                .email("admin@test.com")
                .hashedPassword(passwordEncoder.encode("password123"))
                .fullName("Admin User")
                .active(true)
                .superuser(true)
                .streakDays(0)
                .build();
        admin = userRepository.save(admin);

        String token = tokenProvider.generateToken(admin.getId().toString());

        mockMvc.perform(get("/api/v1/users/")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void shouldRejectInvalidToken() throws Exception {
        // Invalid token → user not authenticated → 401 (M0 spec).
        mockMvc.perform(get("/api/v1/users/me")
                        .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldRejectMissingToken() throws Exception {
        // Missing token → user not authenticated → 401 (M0 spec).
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }
}
