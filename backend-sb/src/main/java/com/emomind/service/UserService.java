package com.emomind.service;

import com.emomind.dto.request.*;
import com.emomind.dto.response.*;
import com.emomind.entity.PasswordResetToken;
import com.emomind.entity.User;
import com.emomind.exception.ServiceException;
import com.emomind.exception.UnauthorizedException;
import com.emomind.mapper.UserMapper;
import com.emomind.repository.PasswordResetTokenRepository;
import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import com.emomind.security.UserDetailsImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Pageable;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Slf4j
@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authenticationManager;
    private final UserMapper userMapper;
    private final JavaMailSender mailSender;
    private final String frontendHost;

    public UserService(UserRepository userRepository,
                       PasswordResetTokenRepository tokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider,
                       @Lazy AuthenticationManager authenticationManager,
                       UserMapper userMapper,
                       @Autowired(required = false) JavaMailSender mailSender,
                       @Value("${app.frontend.host:}") String frontendHost) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.authenticationManager = authenticationManager;
        this.userMapper = userMapper;
        this.mailSender = mailSender;
        this.frontendHost = frontendHost;
    }

    public TokenResponse login(String email, String password) {
        if (!userRepository.existsByEmail(email)) {
            throw new UnauthorizedException("用户不存在");
        }
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, password));
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        String token = tokenProvider.generateToken(userDetails.getId().toString());
        return new TokenResponse(token, "bearer");
    }

    public UserResponse register(UserRegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ServiceException("邮箱已被注册");
        }
        User user = User.builder()
                .email(request.getEmail())
                .hashedPassword(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .active(true)
                .superuser(false)
                .streakDays(0)
                .build();
        User saved = userRepository.save(user);
        return userMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("凭证验证失败"));
        return userMapper.toResponse(user);
    }

    public UserResponse updateCurrentUser(UUID userId, UserUpdateMeRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("凭证验证失败"));
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new ServiceException("邮箱已被注册");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        return userMapper.toResponse(userRepository.save(user));
    }

    public void deleteCurrentUser(UUID userId) {
        userRepository.deleteById(userId);
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getAllUsers(Pageable pageable) {
        var page = userRepository.findAll(pageable);
        return new PageResponse<>(userMapper.toResponseList(page.getContent()), page.getTotalElements());
    }

    public UserResponse createUser(UserCreateRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ServiceException("邮箱已被注册");
        }
        User user = User.builder()
                .email(request.getEmail())
                .hashedPassword(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .active(request.getActive() != null ? request.getActive() : true)
                .superuser(request.getSuperuser() != null ? request.getSuperuser() : false)
                .streakDays(0)
                .build();
        return userMapper.toResponse(userRepository.save(user));
    }

    public UserResponse updateUser(UUID userId, UserUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ServiceException("User not found"));
        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw new ServiceException("邮箱已被注册");
            }
            user.setEmail(request.getEmail());
        }
        if (request.getFullName() != null) {
            user.setFullName(request.getFullName());
        }
        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }
        if (request.getSuperuser() != null) {
            user.setSuperuser(request.getSuperuser());
        }
        if (request.getPassword() != null) {
            user.setHashedPassword(passwordEncoder.encode(request.getPassword()));
        }
        return userMapper.toResponse(userRepository.save(user));
    }

    public void deleteUser(UUID userId) {
        userRepository.deleteById(userId);
    }

    public void updatePassword(UUID userId, UpdatePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("凭证验证失败"));
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getHashedPassword())) {
            throw new UnauthorizedException("密码错误");
        }
        user.setHashedPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public void updateStreakIfNeeded(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        LocalDateTime lastActive = user.getLastActiveDate();

        if (lastActive == null) {
            user.setStreakDays(1);
        } else {
            LocalDate lastDate = lastActive.atZone(ZoneId.of("Asia/Shanghai")).toLocalDate();
            if (lastDate.equals(today)) {
                return;
            } else if (lastDate.plusDays(1).equals(today)) {
                user.setStreakDays(user.getStreakDays() + 1);
            } else {
                user.setStreakDays(1);
            }
        }
        user.setLastActiveDate(LocalDateTime.now(ZoneId.of("Asia/Shanghai")));
        userRepository.save(user);
    }

    public void initiatePasswordReset(String email) {
        if (!userRepository.existsByEmail(email)) {
            return;
        }

        String token = UUID.randomUUID().toString();
        LocalDateTime expiresAt = LocalDateTime.now(ZoneId.of("Asia/Shanghai")).plusHours(48);

        tokenRepository.deleteByEmail(email);
        tokenRepository.save(PasswordResetToken.builder()
                .email(email)
                .token(token)
                .expiresAt(expiresAt)
                .createdAt(LocalDateTime.now(ZoneId.of("Asia/Shanghai")))
                .build());

        if (mailSender == null) {
            log.warn("Mail sender not configured, skipping password reset email");
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("密码重置");
            message.setText("请点击以下链接重置密码（48小时内有效）：\n" +
                    frontendHost + "/reset-password?token=" + token);
            mailSender.send(message);
        } catch (Exception e) {
            log.error("Failed to send password reset email", e);
        }
    }

    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = tokenRepository.findByToken(token)
                .orElseThrow(() -> new ServiceException("无效的令牌"));

        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now(ZoneId.of("Asia/Shanghai")))) {
            throw new ServiceException("令牌已过期");
        }

        User user = userRepository.findByEmail(resetToken.getEmail())
                .orElseThrow(() -> new ServiceException("用户不存在"));

        user.setHashedPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        tokenRepository.deleteById(resetToken.getId());
    }
}
