package com.emomind.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private JwtTokenProvider tokenProvider;

    @BeforeEach
    void setUp() {
        tokenProvider = new JwtTokenProvider();
        ReflectionTestUtils.setField(tokenProvider, "jwtSecret", "test-secret-key-that-is-long-enough-for-hs256");
        ReflectionTestUtils.setField(tokenProvider, "jwtExpiration", 86400000L);
    }

    @Test
    void shouldGenerateValidToken() {
        String userId = "550e8400-e29b-41d4-a716-446655440000";
        String token = tokenProvider.generateToken(userId);

        assertThat(token).isNotBlank();
        assertThat(tokenProvider.validateToken(token)).isTrue();
    }

    @Test
    void shouldExtractUserIdFromToken() {
        String userId = "550e8400-e29b-41d4-a716-446655440000";
        String token = tokenProvider.generateToken(userId);

        String extracted = tokenProvider.getUserIdFromToken(token);
        assertThat(extracted).isEqualTo(userId);
    }

    @Test
    void shouldValidateExpiredToken() throws InterruptedException {
        ReflectionTestUtils.setField(tokenProvider, "jwtExpiration", 1L);
        String token = tokenProvider.generateToken("user-id");
        Thread.sleep(10);

        assertThat(tokenProvider.validateToken(token)).isFalse();
    }

    @Test
    void shouldInvalidateMalformedToken() {
        assertThat(tokenProvider.validateToken("invalid-token")).isFalse();
    }
}
