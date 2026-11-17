package com.saneia.repository;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.saneia.dto.UsuarioDtos.UsuarioResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Repository
@ConditionalOnBean(Firestore.class)
public class UsuarioRepository {

    private static final String COLLECTION = "usuarios";

    private final Firestore firestore;

    public UsuarioRepository(Firestore firestore) {
        this.firestore = firestore;
    }

    public Optional<UsuarioResponse> findByUid(String uid) {
        DocumentSnapshot snap = FirestoreSupport.await(
                firestore.collection(COLLECTION).document(uid).get(),
                "buscar perfil do usuário"
        );
        if (!snap.exists()) {
            return Optional.empty();
        }
        return Optional.of(toResponse(snap));
    }

    public UsuarioResponse saveProfile(
            String uid,
            String email,
            String nome,
            String telefone,
            String regiaoPadraoId
    ) {
        DocumentReference docRef = firestore.collection(COLLECTION).document(uid);
        DocumentSnapshot existing = FirestoreSupport.await(docRef.get(), "verificar perfil existente");

        Map<String, Object> fields = new HashMap<>();
        fields.put("nome", nome);
        fields.put("telefone", telefone);
        fields.put("regiaoPadraoId", regiaoPadraoId != null ? regiaoPadraoId : "");
        fields.put("cadastroCompleto", true);
        fields.put("updatedAt", FieldValue.serverTimestamp());

        if (!existing.exists()) {
            fields.put("uid", uid);
            fields.put("email", email);
            fields.put("createdAt", FieldValue.serverTimestamp());
            FirestoreSupport.await(docRef.set(fields), "criar perfil do usuário");
        } else {
            FirestoreSupport.await(docRef.update(fields), "atualizar perfil do usuário");
        }

        DocumentSnapshot updated = FirestoreSupport.await(docRef.get(), "recarregar perfil do usuário");
        return toResponse(updated);
    }

    private UsuarioResponse toResponse(DocumentSnapshot snap) {
        return new UsuarioResponse(
                FirestoreSupport.stringOrEmpty(snap.get("uid")),
                FirestoreSupport.stringOrEmpty(snap.get("nome")),
                FirestoreSupport.stringOrEmpty(snap.get("email")),
                FirestoreSupport.stringOrEmpty(snap.get("telefone")),
                FirestoreSupport.stringOrEmpty(snap.get("regiaoPadraoId")),
                FirestoreSupport.booleanOrFalse(snap.get("cadastroCompleto")),
                FirestoreSupport.toInstant(snap.get("createdAt")),
                FirestoreSupport.toInstant(snap.get("updatedAt"))
        );
    }
}
