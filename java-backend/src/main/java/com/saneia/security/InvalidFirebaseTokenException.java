package com.saneia.security;

import org.springframework.security.core.AuthenticationException;

public class InvalidFirebaseTokenException extends AuthenticationException {

    public InvalidFirebaseTokenException(String msg) {
        super(msg);
    }

    public InvalidFirebaseTokenException(String msg, Throwable cause) {
        super(msg, cause);
    }
}
