package com.emomind.security;

import com.emomind.entity.User;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

class UserDetailsImplTest {

    @Test
    void shouldBuildAdminUserDetails() {
        UUID id = UUID.randomUUID();
        User user = User.builder()
                .id(id)
                .email("admin@test.com")
                .hashedPassword("pass")
                .isSuperuser(true)
                .build();

        UserDetailsImpl details = UserDetailsImpl.build(user);

        assertThat(details.getId()).isEqualTo(id);
        assertThat(details.getEmail()).isEqualTo("admin@test.com");
        assertThat(details.getUsername()).isEqualTo("admin@test.com");
        assertThat(details.getPassword()).isEqualTo("pass");
        assertThat(details.getIsSuperuser()).isTrue();
        assertThat(details.getAuthorities())
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    @Test
    void shouldBuildRegularUserDetails() {
        UUID id = UUID.randomUUID();
        User user = User.builder()
                .id(id)
                .email("user@test.com")
                .hashedPassword("pass")
                .isSuperuser(false)
                .build();

        UserDetailsImpl details = UserDetailsImpl.build(user);

        assertThat(details.getIsSuperuser()).isFalse();
        assertThat(details.getAuthorities())
                .anyMatch(a -> a.getAuthority().equals("ROLE_USER"));
    }

    @Test
    void shouldBuildWithNullSuperuser() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .email("user@test.com")
                .hashedPassword("pass")
                .isSuperuser(null)
                .build();

        UserDetailsImpl details = UserDetailsImpl.build(user);

        assertThat(details.getAuthorities())
                .anyMatch(a -> a.getAuthority().equals("ROLE_USER"));
    }

    @Test
    void shouldAlwaysReturnAccountActive() {
        UserDetailsImpl details = new UserDetailsImpl(UUID.randomUUID(), "test", false, "pass", null);
        assertThat(details.isAccountNonExpired()).isTrue();
        assertThat(details.isAccountNonLocked()).isTrue();
        assertThat(details.isCredentialsNonExpired()).isTrue();
        assertThat(details.isEnabled()).isTrue();
    }
}
