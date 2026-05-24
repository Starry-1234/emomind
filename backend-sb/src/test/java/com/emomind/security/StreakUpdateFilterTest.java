package com.emomind.security;

import com.emomind.service.UserService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.util.Collections;
import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StreakUpdateFilterTest {

    @Mock
    private UserService userService;

    @Mock
    private HttpServletRequest request;

    @Mock
    private HttpServletResponse response;

    @Mock
    private FilterChain filterChain;

    @InjectMocks
    private StreakUpdateFilter filter;

    @Test
    void shouldUpdateStreakForAuthenticatedUser() throws ServletException, IOException {
        UUID userId = UUID.randomUUID();
        UserDetailsImpl userDetails = new UserDetailsImpl(userId, "test@test.com", false, "pass", Collections.emptyList());
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);

        filter.doFilterInternal(request, response, filterChain);

        verify(userService).updateStreakIfNeeded(userId);
        verify(filterChain).doFilter(request, response);
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldSkipWhenNotAuthenticated() throws ServletException, IOException {
        SecurityContextHolder.clearContext();

        filter.doFilterInternal(request, response, filterChain);

        verify(userService, never()).updateStreakIfNeeded(any());
        verify(filterChain).doFilter(request, response);
    }

    @Test
    void shouldContinueOnException() throws ServletException, IOException {
        UUID userId = UUID.randomUUID();
        UserDetailsImpl userDetails = new UserDetailsImpl(userId, "test@test.com", false, "pass", Collections.emptyList());
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userDetails, null, Collections.emptyList());
        SecurityContextHolder.getContext().setAuthentication(auth);
        doThrow(new RuntimeException("db error")).when(userService).updateStreakIfNeeded(userId);

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        SecurityContextHolder.clearContext();
    }
}
