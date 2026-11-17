package com.saneia.security;

public record AuthenticatedUser(
        String uid,
        String email,
        String name,
        boolean emailVerified,
        String signInProvider
) {
    public AuthenticatedUser(String uid, String email, String name) {
        this(uid, email, name, false, "");
    }
}
