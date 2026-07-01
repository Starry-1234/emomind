package com.emomind.service;

import com.emomind.config.LangGraphProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Forwards chat / file / conversation requests from the Spring Boot gateway
 * to the ai-runtime Python sidecar.
 *
 * M0: empty stub. Real implementations of proxyChatStream, proxyStop,
 * proxyConversations, proxyMessages, deleteConversation, uploadFile
 * land in M1 / M4 / M5.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiProxyService {

    private final LangGraphProperties langGraphProperties;

    public LangGraphProperties getLangGraphProperties() {
        return langGraphProperties;
    }
}