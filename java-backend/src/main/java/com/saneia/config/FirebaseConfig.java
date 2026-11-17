package com.saneia.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.FirestoreOptions;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Inicializa o FirebaseApp, FirebaseAuth e o cliente Cloud Firestore
 * apontando explicitamente para o banco nomeado do projeto SaneIA.
 */
@Configuration
@ConditionalOnProperty(name = "saneia.firebase.enabled", havingValue = "true", matchIfMissing = true)
public class FirebaseConfig {

    @Bean
    public GoogleCredentials firebaseCredentials(SaneIaProperties properties) throws IOException {
        SaneIaProperties.FirebaseProperties fb = properties.firebase();

        if (StringUtils.hasText(fb.credentialsJson())) {
            try (InputStream is = new ByteArrayInputStream(
                    fb.credentialsJson().getBytes(StandardCharsets.UTF_8))) {
                return GoogleCredentials.fromStream(is);
            }
        }

        if (StringUtils.hasText(fb.credentialsPath())) {
            try (InputStream is = new FileInputStream(fb.credentialsPath())) {
                return GoogleCredentials.fromStream(is);
            }
        }

        return GoogleCredentials.getApplicationDefault();
    }

    @Bean
    public FirebaseApp firebaseApp(SaneIaProperties properties, GoogleCredentials credentials) {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(credentials)
                .setProjectId(properties.firebase().projectId())
                .build();

        return FirebaseApp.initializeApp(options);
    }

    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        return FirebaseAuth.getInstance(firebaseApp);
    }

    @Bean
    public Firestore firestore(SaneIaProperties properties, GoogleCredentials credentials) {
        SaneIaProperties.FirebaseProperties fb = properties.firebase();
        return FirestoreOptions.newBuilder()
                .setCredentials(credentials)
                .setProjectId(fb.projectId())
                .setDatabaseId(fb.databaseId())
                .build()
                .getService();
    }
}
