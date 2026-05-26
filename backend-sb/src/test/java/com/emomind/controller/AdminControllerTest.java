package com.emomind.controller;

import com.emomind.entity.FileAnalysisReport;
import com.emomind.entity.TestRecord;
import com.emomind.entity.User;
import com.emomind.repository.FileAnalysisReportRepository;
import com.emomind.repository.TestRecordRepository;
import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TestRecordRepository testRecordRepository;

    @Autowired
    private FileAnalysisReportRepository fileAnalysisReportRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String userToken;
    private String adminToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        testRecordRepository.deleteAll();
        fileAnalysisReportRepository.deleteAll();

        User user = new User();
        user.setEmail("user@example.com");
        user.setHashedPassword(passwordEncoder.encode("password123"));
        user.setActive(true);
        user.setSuperuser(false);
        user = userRepository.save(user);
        userToken = tokenProvider.generateToken(user.getId().toString());

        User admin = new User();
        admin.setEmail("admin@example.com");
        admin.setHashedPassword(passwordEncoder.encode("password123"));
        admin.setActive(true);
        admin.setSuperuser(true);
        admin = userRepository.save(admin);
        adminToken = tokenProvider.generateToken(admin.getId().toString());
    }

    @Test
    void shouldReturnStatsForAdmin() throws Exception {
        // Create test data
        User testUser = userRepository.save(User.builder()
                .email("test@example.com")
                .hashedPassword(passwordEncoder.encode("password123"))
                .active(true)
                .superuser(false)
                .build());

        testRecordRepository.save(TestRecord.builder()
                .testName("PHQ-9")
                .questions(List.of(Map.of("text", "Q1")))
                .answers(List.of(Map.of("score", 1)))
                .owner(testUser)
                .build());

        fileAnalysisReportRepository.save(FileAnalysisReport.builder()
                .fileName("report.pdf")
                .fileType("application/pdf")
                .analysisResult("Analysis result")
                .owner(testUser)
                .build());

        mockMvc.perform(get("/api/v1/admin/stats")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_users").value(3))
                .andExpect(jsonPath("$.total_test_records").value(1))
                .andExpect(jsonPath("$.total_analysis_reports").value(1))
                .andExpect(jsonPath("$.today_new_users").value(3))
                .andExpect(jsonPath("$.today_new_test_records").value(1))
                .andExpect(jsonPath("$.today_new_analysis_reports").value(1));
    }

    @Test
    void shouldDenyNonAdminAccessToStats() throws Exception {
        mockMvc.perform(get("/api/v1/admin/stats")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }
}
