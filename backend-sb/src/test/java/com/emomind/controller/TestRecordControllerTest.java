package com.emomind.controller;

import com.emomind.dto.request.TestRecordCreateRequest;
import com.emomind.dto.request.TestRecordUpdateRequest;
import com.emomind.entity.TestRecord;
import com.emomind.entity.User;
import com.emomind.repository.TestRecordRepository;
import com.emomind.repository.UserRepository;
import com.emomind.security.JwtTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TestRecordControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TestRecordRepository testRecordRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String userToken;
    private String adminToken;
    private UUID userId;
    private UUID adminId;

    @BeforeEach
    void setUp() {
        testRecordRepository.deleteAll();
        userRepository.deleteAll();

        User user = new User();
        user.setEmail("user@example.com");
        user.setHashedPassword(passwordEncoder.encode("password123"));
        user.setActive(true);
        user.setSuperuser(false);
        user = userRepository.save(user);
        userId = user.getId();
        userToken = tokenProvider.generateToken(user.getId().toString());

        User admin = new User();
        admin.setEmail("admin@example.com");
        admin.setHashedPassword(passwordEncoder.encode("password123"));
        admin.setActive(true);
        admin.setSuperuser(true);
        admin = userRepository.save(admin);
        adminId = admin.getId();
        adminToken = tokenProvider.generateToken(admin.getId().toString());
    }

    @Test
    void shouldCreateAndGetRecord() throws Exception {
        TestRecordCreateRequest request = new TestRecordCreateRequest();
        request.setTestName("SAS Test");
        request.setUserTopic("Anxiety");
        request.setTotalScore(45);
        request.setTotalMax(80);
        request.setQuestions(List.of(Map.of("q", "Do you feel nervous?")));
        request.setAnswers(List.of(Map.of("a", "Often")));

        var createResult = mockMvc.perform(post("/api/v1/test-records/")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.test_name").value("SAS Test"))
                .andExpect(jsonPath("$.total_score").value(45))
                .andReturn();

        String responseBody = createResult.getResponse().getContentAsString();
        String recordId = objectMapper.readTree(responseBody).get("id").asText();

        mockMvc.perform(get("/api/v1/test-records/" + recordId)
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.test_name").value("SAS Test"))
                .andExpect(jsonPath("$.owner.email").value("user@example.com"));
    }

    @Test
    void shouldGetRecordList() throws Exception {
        createTestRecord(userId, "Record 1");
        createTestRecord(userId, "Record 2");

        mockMvc.perform(get("/api/v1/test-records/")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void shouldUpdateRecord() throws Exception {
        TestRecord record = createTestRecord(userId, "Original Name");

        TestRecordUpdateRequest updateRequest = new TestRecordUpdateRequest();
        updateRequest.setTestName("Updated Name");
        updateRequest.setTotalScore(60);

        mockMvc.perform(put("/api/v1/test-records/" + record.getId())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.test_name").value("Updated Name"))
                .andExpect(jsonPath("$.total_score").value(60));
    }

    @Test
    void shouldDeleteRecord() throws Exception {
        TestRecord record = createTestRecord(userId, "To Delete");

        mockMvc.perform(delete("/api/v1/test-records/" + record.getId())
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/test-records/" + record.getId())
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldDenyAccessToOthersRecord() throws Exception {
        User other = new User();
        other.setEmail("other@example.com");
        other.setHashedPassword(passwordEncoder.encode("password123"));
        other.setActive(true);
        other.setSuperuser(false);
        other = userRepository.save(other);
        TestRecord record = createTestRecord(other.getId(), "Other's Record");

        mockMvc.perform(get("/api/v1/test-records/" + record.getId())
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shouldAllowAdminToListAllRecords() throws Exception {
        createTestRecord(userId, "User Record");
        createTestRecord(adminId, "Admin Record");

        mockMvc.perform(get("/api/v1/admin/test-records")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.count").value(2));
    }

    @Test
    void shouldAllowAdminToDeleteAnyRecord() throws Exception {
        TestRecord record = createTestRecord(userId, "User Record");

        mockMvc.perform(delete("/api/v1/admin/test-records/" + record.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void shouldDenyNonAdminAccessToAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/admin/test-records")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }

    private TestRecord createTestRecord(UUID ownerId, String testName) {
        User owner = userRepository.findById(ownerId).orElseThrow();
        TestRecord record = TestRecord.builder()
                .testName(testName)
                .questions(List.of(Map.of("q", "test")))
                .answers(List.of(Map.of("a", "test")))
                .owner(owner)
                .build();
        return testRecordRepository.save(record);
    }
}
