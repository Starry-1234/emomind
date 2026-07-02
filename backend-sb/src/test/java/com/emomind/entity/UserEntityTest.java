package com.emomind.entity;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class UserEntityTest {

    @Test
    void shouldCreateUserWithDefaults() {
        User user = User.builder()
                .email("test@example.com")
                .hashedPassword("hashed123")
                .build();

        assertThat(user.getEmail()).isEqualTo("test@example.com");
        assertThat(user.getHashedPassword()).isEqualTo("hashed123");
        assertThat(user.getActive()).isTrue();
        assertThat(user.getSuperuser()).isFalse();
        assertThat(user.getStreakDays()).isZero();
        assertThat(user.getCreatedAt()).isNull();
    }

    @Test
    void shouldSetCreatedAtOnPersist() {
        User user = new User();
        user.setEmail("test@example.com");
        user.setHashedPassword("hashed123");
        user.onCreate();

        assertThat(user.getCreatedAt()).isNotNull();
        assertThat(user.getCreatedAt()).isBeforeOrEqualTo(LocalDateTime.now());
    }
}
