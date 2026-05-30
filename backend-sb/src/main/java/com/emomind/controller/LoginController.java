package com.emomind.controller;

import com.emomind.dto.request.LoginRequest;
import com.emomind.dto.request.PasswordResetRequest;
import com.emomind.dto.response.MessageResponse;
import com.emomind.dto.response.TokenResponse;
import com.emomind.dto.response.UserResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "用户认证与密码管理")
public class LoginController {

    private final UserService userService;

    @PostMapping("/login/access-token")
    @Operation(summary = "用户登录，返回 JWT 访问令牌")
    public ResponseEntity<TokenResponse> login(@Valid @ModelAttribute LoginRequest request) {
        return ResponseEntity.ok(userService.login(request.getUsername(), request.getPassword()));
    }

    @PostMapping("/login/test-token")
    @Operation(summary = "验证当前 JWT 令牌是否有效")
    public ResponseEntity<UserResponse> testToken(@AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok(userService.getCurrentUser(user.getId()));
    }

    @PostMapping("/password-recovery/{email}")
    @Operation(summary = "发送密码找回邮件")
    public ResponseEntity<MessageResponse> recoverPassword(@PathVariable String email) {
        userService.initiatePasswordReset(email);
        return ResponseEntity.ok(new MessageResponse("密码重置邮件已发送"));
    }

    @PostMapping("/reset-password/")
    @Operation(summary = "使用令牌重置密码")
    public ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        userService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok(new MessageResponse("密码已更新"));
    }
}
