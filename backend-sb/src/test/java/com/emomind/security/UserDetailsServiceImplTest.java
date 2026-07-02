package com.emomind.security;

import com.emomind.entity.User;
import com.emomind.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    @Test
    void shouldLoadUserByUuid() {
        UUID id = UUID.randomUUID();
        User user = User.builder().id(id).email("test@test.com").hashedPassword("pass").superuser(false).build();
        when(userRepository.findById(id)).thenReturn(Optional.of(user));

        var result = userDetailsService.loadUserByUsername(id.toString());

        assertThat(result.getUsername()).isEqualTo("test@test.com");
    }

    @Test
    void shouldLoadUserByEmail() {
        User user = User.builder().id(UUID.randomUUID()).email("test@test.com").hashedPassword("pass").superuser(false).build();
        when(userRepository.findByEmail("test@test.com")).thenReturn(Optional.of(user));

        var result = userDetailsService.loadUserByUsername("test@test.com");

        assertThat(result.getUsername()).isEqualTo("test@test.com");
        verify(userRepository, never()).findById(any());
    }

    @Test
    void shouldThrowWhenUserNotFoundByUuid() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername(id.toString()))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    void shouldThrowWhenUserNotFoundByEmail() {
        when(userRepository.findByEmail("unknown@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("unknown@test.com"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
