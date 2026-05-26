package com.emomind.exception;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class GlobalExceptionHandlerTest {

    @InjectMocks
    private GlobalExceptionHandler handler;

    @Test
    void shouldHandleServiceException() {
        var response = handler.handleServiceException(new ServiceException("bad request"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("detail")).isEqualTo("bad request");
    }

    @Test
    void shouldHandleNotFound() {
        var response = handler.handleNotFound(new ResourceNotFoundException("not found"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void shouldHandleUnauthorized() {
        var response = handler.handleUnauthorized(new UnauthorizedException("unauthorized"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldHandleAccessDenied() {
        var response = handler.handleAccessDenied(new AccessDeniedException("denied"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().get("detail")).isEqualTo("Not enough permissions");
    }

    @Test
    void shouldHandleAuthenticationException() {
        var response = handler.handleAuthenticationException(new BadCredentialsException("bad creds"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().get("detail")).isEqualTo("Incorrect email or password");
    }

    @Test
    void shouldHandleValidationException() {
        Object target = new Object();
        BeanPropertyBindingResult errors = new BeanPropertyBindingResult(target, "target");
        errors.addError(new FieldError("target", "email", "must not be blank"));
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(null, errors);

        var response = handler.handleValidationException(ex);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }

    @Test
    void shouldHandleGenericException() {
        var response = handler.handleException(new RuntimeException("boom"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().get("detail")).isEqualTo("Internal server error");
    }
}
