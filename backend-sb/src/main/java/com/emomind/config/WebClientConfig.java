package com.emomind.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

import java.time.Duration;

@Configuration
@RequiredArgsConstructor
public class WebClientConfig {

    private final DifyProperties difyProperties;

    @Bean
    public WebClient difyWebClient() {
        HttpClient httpClient = HttpClient.create()
                .responseTimeout(Duration.ofSeconds(120))
                .followRedirect(true);

        return WebClient.builder()
                .baseUrl(difyProperties.getApiUrl())
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
}
