# 인증 API

모든 경로는 `/api/v1` prefix를 사용합니다. 요청/응답 본문은 JSON입니다. 이메일은 앞뒤 공백 제거 후 소문자로 정규화하고, 비밀번호는 8~72자입니다.

## 이메일 회원가입 및 인증

`POST /auth/register`

```json
{ "email": "user@example.com", "password": "password123" }
```

성공하면 6자리 인증 코드를 이메일로 보내고 아래 응답을 반환합니다. 코드는 10분 동안 유효하며 1분에 한 번 요청할 수 있습니다.

```json
{ "message": "인증 코드를 이메일로 보냈습니다." }
```

`POST /auth/email/send-code`는 `{ "email": "user@example.com" }`을 받습니다. 계정 존재 여부를 응답에 드러내지 않습니다.

`POST /auth/email/verify`는 `{ "email": "user@example.com", "code": "123456" }`를 받습니다. 코드는 한 번만 사용할 수 있습니다. 인증 성공 시 토큰 응답을 반환합니다.

## 이메일 로그인 및 OAuth 로그인

`POST /auth/login`은 회원가입과 같은 이메일/비밀번호 본문을 받습니다. 이메일 인증을 완료한 계정만 로그인할 수 있습니다.

OAuth 제공자별 경로는 `POST /auth/google`, `/auth/apple`, `/auth/kakao`입니다. 각 경로는 `{ "idToken": "<provider ID token>" }`을 받습니다. 서버가 제공자의 서명 키, 발급자, audience와 토큰 만료를 확인합니다. 클라이언트가 보낸 이메일이나 사용자 ID는 계정 식별에 사용하지 않습니다. OAuth audience 환경 변수가 비어 있으면 해당 제공자는 사용할 수 없습니다.

검증된 제공자 이메일이 기존 계정과 일치하면 해당 계정에 OAuth identity를 연결합니다. 검증되지 않은 이메일은 계정 이메일로 저장하지 않습니다.

## 토큰 수명 주기

로그인 및 이메일 인증 성공 응답:

```json
{
  "accessToken": "<signed JWT>",
  "refreshToken": "<opaque one-time-rotating token>",
  "expiresIn": 900,
  "profileCompleted": false
}
```

API 인증에는 `Authorization: Bearer <accessToken>` 헤더를 사용합니다. Access token 기본 유효 시간은 15분입니다. Refresh token은 원문 대신 해시만 저장하며 기본 30일 동안 유효합니다.

`POST /auth/refresh`는 `{ "refreshToken": "<current refresh token>" }`을 받습니다. 성공하면 새 access/refresh token 쌍을 반환하고 이전 refresh token은 즉시 무효화됩니다. 동시 재사용은 거부됩니다.

`POST /auth/logout`은 유효한 access token이 필요합니다. 현재 세션을 폐기하므로 그 세션의 access token과 refresh token 모두 더 이상 사용할 수 없습니다.

`GET /auth/me`는 같은 Bearer access token을 받아 현재 사용자 ID, 이메일, 이메일 인증 시각, 프로필 완료 여부, 가입 시각을 반환합니다.

## 비밀번호 재설정

`POST /auth/password/reset-request`는 `{ "email": "user@example.com" }`을 받습니다. 등록된 인증 계정에만 30분 유효한 단일 사용 링크를 보냅니다. 응답은 계정 존재 여부를 공개하지 않습니다.

`POST /auth/password/reset`은 `{ "token": "<reset token>", "newPassword": "newpassword123" }`을 받습니다. 재설정이 완료되면 해당 계정의 모든 로그인 세션을 폐기합니다.

## 제한 및 저장

인증 경로에는 기본 전역 요청 제한과 경로별 더 낮은 제한이 적용됩니다. 인증 코드와 비밀번호 재설정 토큰은 HMAC 해시로 저장되고, 비밀번호는 Argon2id로 저장됩니다. 사용자, OAuth identity, 세션, 인증 코드는 PostgreSQL 테이블에 저장되며 스키마는 `npm run migration:run`으로 생성합니다.
