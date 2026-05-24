package com.emomind.controller;

import com.emomind.dto.request.AnalysisReportCreateRequest;
import com.emomind.entity.FileAnalysisReport;
import com.emomind.entity.User;
import com.emomind.repository.FileAnalysisReportRepository;
import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AnalysisReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FileAnalysisReportRepository reportRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String userToken;
    private UUID userId;

    @BeforeEach
    void setUp() {
        reportRepository.deleteAll();
        userRepository.deleteAll();

        User user = new User();
        user.setEmail("user@example.com");
        user.setHashedPassword(passwordEncoder.encode("password123"));
        user.setIsActive(true);
        user.setIsSuperuser(false);
        user = userRepository.save(user);
        userId = user.getId();
        userToken = tokenProvider.generateToken(user.getId().toString());
    }

    @Test
    void shouldCreateAndGetReport() throws Exception {
        AnalysisReportCreateRequest request = new AnalysisReportCreateRequest();
        request.setFileName("report.pdf");
        request.setFileType("pdf");
        request.setFileSize(1024);
        request.setAnalysisResult("This is a positive analysis result.");

        var createResult = mockMvc.perform(post("/api/v1/analysis/reports/")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fileName").value("report.pdf"))
                .andExpect(jsonPath("$.analysisResult").value("This is a positive analysis result."))
                .andReturn();

        String responseBody = createResult.getResponse().getContentAsString();
        String reportId = objectMapper.readTree(responseBody).get("id").asText();

        mockMvc.perform(get("/api/v1/analysis/reports/" + reportId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fileName").value("report.pdf"))
                .andExpect(jsonPath("$.owner.email").value("user@example.com"));
    }

    @Test
    void shouldGetReportList() throws Exception {
        createTestReport(userId, "report1.pdf");
        createTestReport(userId, "report2.pdf");

        mockMvc.perform(get("/api/v1/analysis/reports/")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void shouldDeleteReport() throws Exception {
        FileAnalysisReport report = createTestReport(userId, "to-delete.pdf");

        mockMvc.perform(delete("/api/v1/analysis/reports/" + report.getId())
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/analysis/reports/" + report.getId())
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldDenyAccessToOthersReport() throws Exception {
        User other = new User();
        other.setEmail("other@example.com");
        other.setHashedPassword(passwordEncoder.encode("password123"));
        other.setIsActive(true);
        other.setIsSuperuser(false);
        other = userRepository.save(other);
        FileAnalysisReport report = createTestReport(other.getId(), "other.pdf");

        mockMvc.perform(get("/api/v1/analysis/reports/" + report.getId())
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isUnauthorized());
    }

    private FileAnalysisReport createTestReport(UUID ownerId, String fileName) {
        User owner = userRepository.findById(ownerId).orElseThrow();
        FileAnalysisReport report = FileAnalysisReport.builder()
                .fileName(fileName)
                .fileType("pdf")
                .analysisResult("Test analysis")
                .owner(owner)
                .build();
        return reportRepository.save(report);
    }
}
