package com.emomind.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class JwtTokenProviderTest {

    @InjectMocks
    private JwtTokenProvider tokenProvider;

    private final String secret = "my-very-long-secret-key-for-testing-jwt-tokens-1234567890";
    private final long expiration = 86400000;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(tokenProvider, "jwtSecret", secret);
        ReflectionTestUtils.setField(tokenProvider, "jwtExpiration", expiration);
    }

    @Test
    void shouldGenerateAndValidateToken() {
        String userId = "550e8400-e29b-41d4-a716-446655440000";
        String token = tokenProvider.generateToken(userId);
        assertThat(token).isNotNull();
        assertThat(tokenProvider.validateToken(token)).isTrue();
        assertThat(tokenProvider.getUserIdFromToken(token)).isEqualTo(userId);
    }

    @Test
    void shouldRejectExpiredToken() {
        ReflectionTestUtils.setField(tokenProvider, "jwtExpiration", -1000L);
        String token = tokenProvider.generateToken("user-id");
        assertThat(tokenProvider.validateToken(token)).isFalse();
    }

    @Test
    void shouldRejectMalformedToken() {
        assertThat(tokenProvider.validateToken("not.a.token")).isFalse();
    }

    @Test
    void shouldRejectUnsupportedToken() {
        String unsupportedToken = Jwts.builder().subject("user").compact();
        assertThat(tokenProvider.validateToken(unsupportedToken)).isFalse();
    }

    @Test
    void shouldRejectInvalidSignature() {
        SecretKey wrongKey = Keys.hmacShaKeyFor("wrong-key-for-testing-jwt-signature-check".getBytes(StandardCharsets.UTF_8));
        String badToken = Jwts.builder().subject("user").signWith(wrongKey).compact();
        assertThat(tokenProvider.validateToken(badToken)).isFalse();
    }

    @Test
    void shouldRejectEmptyToken() {
        assertThat(tokenProvider.validateToken("")).isFalse();
        assertThat(tokenProvider.validateToken("   ")).isFalse();
    }

    @Test
    void shouldGetUserIdFromExpiredToken() {
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        Date now = new Date();
        Date expiry = new Date(now.getTime() - 1000);
        String expiredToken = Jwts.builder()
                .subject("expired-user")
                .issuedAt(new Date(now.getTime() - 2000))
                .expiration(expiry)
                .signWith(key)
                .compact();

        assertThatThrownBy(() -> tokenProvider.getUserIdFromToken(expiredToken))
                .isInstanceOf(ExpiredJwtException.class);
    }
}
