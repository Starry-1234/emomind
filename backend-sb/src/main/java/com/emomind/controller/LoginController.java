package com.emomind.controller;

import com.emomind.dto.request.LoginRequest;
import com.emomind.dto.request.PasswordResetRequest;
import com.emomind.dto.response.MessageResponse;
import com.emomind.dto.response.TokenResponse;
import com.emomind.dto.response.UserResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class LoginController {

    private final UserService userService;

    @PostMapping("/login/access-token")
    public ResponseEntity<TokenResponse> login(@Valid @ModelAttribute LoginRequest request) {
        return ResponseEntity.ok(userService.login(request.getUsername(), request.getPassword()));
    }

    @PostMapping("/login/test-token")
    public ResponseEntity<UserResponse> testToken(@AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok(userService.getCurrentUser(user.getId()));
    }

    @PostMapping("/password-recovery/{email}")
    public ResponseEntity<MessageResponse> recoverPassword(@PathVariable String email) {
        // TODO: Implement email sending in next iteration
        return ResponseEntity.ok(new MessageResponse("Password recovery email sent"));
    }

    @PostMapping("/reset-password/")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        // TODO: Implement password reset in next iteration
        return ResponseEntity.ok(new MessageResponse("Password updated successfully"));
    }
}
