package com.emomind.entity;

import com.emomind.repository.ConversationMetaRepository;
import com.emomind.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ConversationMeta persistence test. Validates V5 migration applies and the
 * entity round-trips through the repository.
 *
 * <p>Mirrors the {@link com.emomind.migration.V4MigrationTest} setup: on this
 * Windows host Testcontainers cannot start a container from inside the JVM
 * (Docker CLI proxy returns HTTP 400 over the named pipe). Instead, we reuse
 * the manually-launched {@code pgvector-test} container on localhost:55432 —
 * started by {@code scripts/test.sh} before the maven invocation.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ConversationMetaTest {

    private static final String JDBC_URL =
        "jdbc:postgresql://localhost:55432/emomind_test";

    @DynamicPropertySource
    static void overrideProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> JDBC_URL);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "postgres");
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        // Override the test-profile H2 settings — force real Postgres + Flyway:
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        registry.add("spring.jpa.properties.hibernate.dialect",
            () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.locations", () -> "classpath:db/migration");
        registry.add("spring.flyway.baseline-on-migrate", () -> "true");
        registry.add("spring.flyway.clean-disabled", () -> "true");
        // Defuse the test-profile mail autoconfigure to avoid port conflicts.
        registry.add("spring.mail.host", () -> "");
    }

    @Autowired private ConversationMetaRepository repo;
    @Autowired private UserRepository userRepo;

    @Test
    void persists_and_retrieves_by_user_graph_thread() {
        User u = new User();
        u.setEmail("test-" + UUID.randomUUID() + "@example.com");
        u.setHashedPassword("x");
        u.setActive(true);
        u.setSuperuser(false);
        userRepo.save(u);
        userRepo.flush();

        ConversationMeta m = new ConversationMeta();
        m.setOwner(u);
        m.setGraph("ai-doctor");
        m.setThreadId("t-1");
        m.setTitle("hello");
        m.setMetadata(Map.of("k", "v"));
        repo.saveAndFlush(m);

        var found = repo.findByUserIdAndGraphAndThreadId(u.getId(), "ai-doctor", "t-1");
        assertThat(found).isPresent();
        assertThat(found.get().getTitle()).isEqualTo("hello");
        assertThat(found.get().getMetadata()).containsEntry("k", "v");
        assertThat(found.get().getGraph()).isEqualTo("ai-doctor");
        assertThat(found.get().getThreadId()).isEqualTo("t-1");
        assertThat(found.get().getCreatedAt()).isNotNull();
        assertThat(found.get().getUpdatedAt()).isNotNull();
    }
}
