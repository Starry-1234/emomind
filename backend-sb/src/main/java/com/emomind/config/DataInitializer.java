package com.emomind.config;

import com.emomind.entity.User;
import com.emomind.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.first-superuser.email:}")
    private String superuserEmail;

    @Value("${app.first-superuser.password:}")
    private String superuserPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (superuserEmail == null || superuserEmail.isBlank()) {
            log.debug("FIRST_SUPERUSER not configured, skipping");
            return;
        }
        if (superuserPassword == null || superuserPassword.isBlank()) {
            log.warn("FIRST_SUPERUSER email is set but password is blank, skipping");
            return;
        }
        if (userRepository.existsByEmail(superuserEmail)) {
            log.info("Superuser {} already exists", superuserEmail);
            return;
        }
        User superuser = User.builder()
                .email(superuserEmail)
                .hashedPassword(passwordEncoder.encode(superuserPassword))
                .active(true)
                .superuser(true)
                .streakDays(0)
                .build();
        userRepository.save(superuser);
        log.info("Created superuser: {}", superuserEmail);
    }
}