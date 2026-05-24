package com.emomind.service;

import com.emomind.dto.request.*;
import com.emomind.dto.response.PageResponse;
import com.emomind.dto.response.TokenResponse;
import com.emomind.dto.response.UserResponse;
import com.emomind.entity.User;
import com.emomind.exception.ServiceException;
import com.emomind.exception.UnauthorizedException;
import com.emomind.mapper.UserMapper;
import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import com.emomind.security.UserDetailsImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private UserService userService;

    @Test
    void shouldLoginSuccessfully() {
        String email = "user@example.com";
        String password = "password123";
        UUID userId = UUID.randomUUID();
        UserDetailsImpl userDetails = new UserDetailsImpl(userId, email, false, "encoded", null);
        Authentication auth = mock(Authentication.class);

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(auth);
        when(auth.getPrincipal()).thenReturn(userDetails);
        when(tokenProvider.generateToken(userId.toString())).thenReturn("jwt-token");

        TokenResponse result = userService.login(email, password);

        assertThat(result.getAccessToken()).isEqualTo("jwt-token");
        assertThat(result.getTokenType()).isEqualTo("bearer");
    }

    @Test
    void shouldRegisterNewUser() {
        UserRegisterRequest request = new UserRegisterRequest();
        request.setEmail("new@example.com");
        request.setPassword("password123");
        request.setFullName("New User");

        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        UserResponse result = userService.register(request);

        assertThat(result).isNotNull();
        verify(userRepository).save(any(User.class));
    }

    @Test
    void shouldThrowWhenRegisteringDuplicateEmail() {
        UserRegisterRequest request = new UserRegisterRequest();
        request.setEmail("exists@example.com");

        when(userRepository.existsByEmail("exists@example.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.register(request))
                .isInstanceOf(ServiceException.class)
                .hasMessage("Email already registered");
    }

    @Test
    void shouldGetCurrentUser() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("user@example.com").build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userMapper.toResponse(user)).thenReturn(new UserResponse());

        UserResponse result = userService.getCurrentUser(userId);

        assertThat(result).isNotNull();
    }

    @Test
    void shouldThrowWhenUserNotFound() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getCurrentUser(userId))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void shouldUpdatePasswordSuccessfully() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).hashedPassword("oldEncoded").build();
        UpdatePasswordRequest request = new UpdatePasswordRequest();
        request.setCurrentPassword("old123");
        request.setNewPassword("new123");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("old123", "oldEncoded")).thenReturn(true);
        when(passwordEncoder.encode("new123")).thenReturn("newEncoded");

        userService.updatePassword(userId, request);

        assertThat(user.getHashedPassword()).isEqualTo("newEncoded");
        verify(userRepository).save(user);
    }

    @Test
    void shouldThrowWhenCurrentPasswordIncorrect() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).hashedPassword("oldEncoded").build();
        UpdatePasswordRequest request = new UpdatePasswordRequest();
        request.setCurrentPassword("wrong");
        request.setNewPassword("new123");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "oldEncoded")).thenReturn(false);

        assertThatThrownBy(() -> userService.updatePassword(userId, request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Incorrect password");
    }

    @Test
    void shouldGetAllUsers() {
        Page<User> page = new PageImpl<>(List.of(User.builder().build()));
        when(userRepository.findAll(any(PageRequest.class))).thenReturn(page);
        when(userMapper.toResponseList(any())).thenReturn(List.of(new UserResponse()));

        PageResponse<UserResponse> result = userService.getAllUsers(PageRequest.of(0, 10));

        assertThat(result.getCount()).isEqualTo(1);
    }

    @Test
    void shouldCreateUserWithDefaults() {
        UserCreateRequest request = new UserCreateRequest();
        request.setEmail("new@example.com");
        request.setPassword("password123");
        request.setFullName("New User");

        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        UserResponse result = userService.createUser(request);

        assertThat(result).isNotNull();
    }

    @Test
    void shouldCreateUserWithExplicitFlags() {
        UserCreateRequest request = new UserCreateRequest();
        request.setEmail("admin@example.com");
        request.setPassword("password123");
        request.setFullName("Admin");
        request.setIsActive(false);
        request.setIsSuperuser(true);

        when(userRepository.existsByEmail("admin@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        userService.createUser(request);
    }

    @Test
    void shouldUpdateCurrentUserEmail() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("old@example.com").fullName("Old").build();
        UserUpdateMeRequest request = new UserUpdateMeRequest();
        request.setEmail("new@example.com");
        request.setFullName("New");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        userService.updateCurrentUser(userId, request);

        assertThat(user.getEmail()).isEqualTo("new@example.com");
    }

    @Test
    void shouldNotUpdateEmailWhenSame() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("same@example.com").fullName("Old").build();
        UserUpdateMeRequest request = new UserUpdateMeRequest();
        request.setEmail("same@example.com");
        request.setFullName("New");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        userService.updateCurrentUser(userId, request);

        verify(userRepository, never()).existsByEmail(any());
    }

    @Test
    void shouldUpdateUserWithAllFields() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).email("old@example.com").fullName("Old").isActive(true).isSuperuser(false).build();
        UserUpdateRequest request = new UserUpdateRequest();
        request.setEmail("new@example.com");
        request.setFullName("New");
        request.setIsActive(false);
        request.setIsSuperuser(true);
        request.setPassword("newpass");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.existsByEmail("new@example.com")).thenReturn(false);
        when(passwordEncoder.encode("newpass")).thenReturn("encoded");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userMapper.toResponse(any(User.class))).thenReturn(new UserResponse());

        userService.updateUser(userId, request);

        assertThat(user.getFullName()).isEqualTo("New");
        assertThat(user.getIsActive()).isFalse();
        assertThat(user.getIsSuperuser()).isTrue();
    }

    @Test
    void shouldDeleteUser() {
        UUID userId = UUID.randomUUID();
        userService.deleteUser(userId);
        verify(userRepository).deleteById(userId);
    }

    @Test
    void shouldUpdateStreakForFirstLogin() {
        UUID userId = UUID.randomUUID();
        User user = User.builder().id(userId).streakDays(0).lastActiveDate(null).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        userService.updateStreakIfNeeded(userId);

        assertThat(user.getStreakDays()).isEqualTo(1);
        assertThat(user.getLastActiveDate()).isNotNull();
    }

    @Test
    void shouldNotUpdateStreakOnSameDay() {
        UUID userId = UUID.randomUUID();
        LocalDateTime today = LocalDate.now(ZoneId.of("Asia/Shanghai")).atStartOfDay().plusHours(1);
        User user = User.builder().id(userId).streakDays(5).lastActiveDate(today).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        userService.updateStreakIfNeeded(userId);

        assertThat(user.getStreakDays()).isEqualTo(5);
        verify(userRepository, never()).save(user);
    }

    @Test
    void shouldIncrementStreakOnConsecutiveDay() {
        UUID userId = UUID.randomUUID();
        LocalDate yesterday = LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(1);
        LocalDateTime lastActive = yesterday.atTime(12, 0);
        User user = User.builder().id(userId).streakDays(3).lastActiveDate(lastActive).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        userService.updateStreakIfNeeded(userId);

        assertThat(user.getStreakDays()).isEqualTo(4);
        verify(userRepository).save(user);
    }

    @Test
    void shouldResetStreakAfterGap() {
        UUID userId = UUID.randomUUID();
        LocalDate twoDaysAgo = LocalDate.now(ZoneId.of("Asia/Shanghai")).minusDays(2);
        LocalDateTime lastActive = twoDaysAgo.atTime(12, 0);
        User user = User.builder().id(userId).streakDays(10).lastActiveDate(lastActive).build();

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        userService.updateStreakIfNeeded(userId);

        assertThat(user.getStreakDays()).isEqualTo(1);
        verify(userRepository).save(user);
    }

    @Test
    void shouldSkipWhenUserNotFound() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        userService.updateStreakIfNeeded(userId);

        verify(userRepository, never()).save(any());
    }
}
