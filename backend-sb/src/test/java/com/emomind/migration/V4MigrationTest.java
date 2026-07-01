package com.emomind.migration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V4 migration requires pgvector, which H2 does not support.
 *
 * On this Windows host the bundled Testcontainers transport (1.19.7) probes the
 * `docker_cli` named pipe and fails with HTTP 400 from the Docker Desktop CLI
 * proxy, so we cannot start a container from inside the JVM. Instead, we reuse
 * a manually-launched pgvector container — start it once via:
 *
 *     docker run -d --name pgvector-test -p 55432:5432 \
 *         -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
 *         -e POSTGRES_DB=emomind_test pgvector/pgvector:pg17
 *
 * Flyway will create all tables in that database; we then inspect pg_extension,
 * information_schema, and pg_indexes to assert the migration applied cleanly.
 */
@SpringBootTest
@ActiveProfiles("test")
class V4MigrationTest {

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

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void pgvectorExtensionExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM pg_extension WHERE extname = 'vector'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    void userMemoryTableExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'user_memory'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    void embeddingColumnExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM information_schema.columns " +
            "WHERE table_name = 'user_memory' AND column_name = 'embedding'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }

    @Test
    void hnswIndexExists() {
        Integer count = jdbc.queryForObject(
            "SELECT count(*) FROM pg_indexes WHERE tablename = 'user_memory' " +
            "AND indexname = 'user_memory_embedding_hnsw_idx'",
            Integer.class
        );
        assertThat(count).isEqualTo(1);
    }
}