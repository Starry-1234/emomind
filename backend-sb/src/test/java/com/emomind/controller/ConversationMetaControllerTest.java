package com.emomind.controller;

import com.emomind.entity.ConversationMeta;
import com.emomind.entity.User;
import com.emomind.repository.ConversationMetaRepository;
import com.emomind.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * M4 T8: MockMvc integration tests for {@link ConversationMetaController}.
 *
 * <p>Reuses the same data-source override as {@code ConversationMetaTest} and
 * {@code V4MigrationTest}: on this Windows host Testcontainers cannot start a
 * container from inside the JVM (Docker CLI proxy returns HTTP 400 over the
 * named pipe). Instead, we connect to the manually-launched
 * {@code pgvector-test} container on localhost:55432 — started by
 * {@code scripts/test.sh} before the maven invocation.
 *
 * <p>Authentication is driven by Spring Security's
 * {@code @WithMockUser(username = "uuid", roles = "USER")}. The
 * {@code ConversationMetaController.currentUserId()} helper unwraps
 * {@code Authentication#getName()} to a {@code UUID}, so the principal's
 * username must be a parseable UUID string that matches the
 * {@link ConversationMeta#getOwner() owner}'s id.
 */
@SpringBootTest
@ActiveProfiles("test")
class ConversationMetaControllerTest {

    private static final String JDBC_URL =
        "jdbc:postgresql://localhost:55432/emomind_test";

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.jpa.properties.hibernate.dialect",
            () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.locations", () -> "classpath:db/migration");
        registry.add("spring.flyway.baseline-on-migrate", () -> "true");
        registry.add("spring.flyway.clean-disabled", () -> "true");
        registry.add("spring.mail.host", () -> "");
    }

    @Autowired private WebApplicationContext context;
    @Autowired private ConversationMetaRepository repo;
    @Autowired private UserRepository userRepo;

    private UUID userId;

    @BeforeEach
    void setUp() {
        User u = new User();
        u.setEmail("test-" + UUID.randomUUID() + "@example.com");
        u.setHashedPassword("x");
        u.setActive(true);
        u.setSuperuser(false);
        userRepo.saveAndFlush(u);
        userId = u.getId();
    }

    @Test
    @WithMockUser(username = "test-user-placeholder", roles = "USER")
    void create_returns_200_and_persists() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity()).build();
        // Override principal name with the actual userId UUID so controller's
        // currentUserId() can parse it back.
        mvc.perform(post("/api/v1/ai/conversations")
                .with(user(userId.toString()).roles("USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"graph\":\"ai-doctor\",\"thread_id\":\"t-create-1\",\"title\":\"hi\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.graph").value("ai-doctor"))
            .andExpect(jsonPath("$.thread_id").value("t-create-1"))
            .andExpect(jsonPath("$.title").value("hi"));

        // Assert the row is persisted with the expected unique key.
        Optional<ConversationMeta> stored =
            repo.findByUserIdAndGraphAndThreadId(userId, "ai-doctor", "t-create-1");
        assertThat(stored).isPresent();
        assertThat(stored.get().getOwner().getId()).isEqualTo(userId);
    }

    @Test
    @WithMockUser(username = "test-user-placeholder", roles = "USER")
    void getByThread_returns_200() throws Exception {
        ConversationMeta m = ConversationMeta.builder()
            .owner(userRepo.getReferenceById(userId))
            .graph("ai-doctor")
            .threadId("t-get-1")
            .title("seeded")
            .build();
        repo.saveAndFlush(m);

        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity()).build();
        mvc.perform(get("/api/v1/ai/conversations")
                .with(user(userId.toString()).roles("USER"))
                .param("graph", "ai-doctor")
                .param("thread_id", "t-get-1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.graph").value("ai-doctor"))
            .andExpect(jsonPath("$.thread_id").value("t-get-1"))
            .andExpect(jsonPath("$.title").value("seeded"));
    }

    @Test
    @WithMockUser(username = "test-user-placeholder", roles = "USER")
    void getByThread_returns_404_when_missing() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity()).build();
        mvc.perform(get("/api/v1/ai/conversations")
                .with(user(userId.toString()).roles("USER"))
                .param("graph", "ai-doctor")
                .param("thread_id", "t-does-not-exist"))
            .andExpect(status().isNotFound());
    }

    @Test
    void unauthenticated_returns_401() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity()).build();
        // No JWT/mock principal: controller's currentUserId() returns null.
        mvc.perform(post("/api/v1/ai/conversations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"graph\":\"ai-doctor\",\"thread_id\":\"t-1\"}"))
            .andExpect(status().isUnauthorized());
    }
}
