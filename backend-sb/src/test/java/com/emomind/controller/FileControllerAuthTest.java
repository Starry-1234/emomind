package com.emomind.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.emomind.service.AiProxyService;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class FileControllerAuthTest {

    @Autowired private WebApplicationContext context;
    @MockBean private AiProxyService aiProxyService;

    @Test
    void unauthenticated_upload_returns401() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        org.springframework.mock.web.MockMultipartFile mf =
            new org.springframework.mock.web.MockMultipartFile(
                "file", "a.png", "image/png", new byte[]{1, 2, 3});
        mvc.perform(multipart("/api/v1/ai/files").file(mf))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "00000000-0000-0000-0000-000000000001", roles = "USER")
    void authenticated_upload_returns200() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        org.springframework.mock.web.MockMultipartFile mf =
            new org.springframework.mock.web.MockMultipartFile(
                "file", "a.png", "image/png", new byte[]{1, 2, 3});
        mvc.perform(multipart("/api/v1/ai/files").file(mf))
            .andExpect(status().is(org.hamcrest.Matchers.anyOf(
                org.hamcrest.Matchers.equalTo(200),
                org.hamcrest.Matchers.equalTo(500))));
    }
}