# 공통 API 오류 응답

모든 API 오류는 같은 JSON 형식으로 반환합니다.

```json
{
  "code": "INVALID_REQUEST",
  "message": "요청 값이 유효하지 않습니다.",
  "field": "email",
  "traceId": "8f8ef948-48a7-4cd4-9e35-bc93cde9d2e8"
}
```

`field`는 특정 입력 필드와 연결할 수 있는 오류에서만 포함합니다. 모든 오류 응답에는 요청 추적을 위한 `traceId`가 포함됩니다. 응답의 `x-request-id` 헤더 값도 같은 ID입니다.

| HTTP 상태 | 오류 코드 | 용도 |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | 요청 값이 없거나 형식·범위·허용값 검증에 실패했습니다. |
| 401 | `AUTH_TOKEN_INVALID` | 인증 정보가 없거나 유효하지 않습니다. |
| 403 | `PERMISSION_DENIED` | 요청을 수행할 권한이 없습니다. |
| 404 | `RESOURCE_NOT_FOUND` | 요청한 리소스를 찾을 수 없습니다. |
| 409 | `RESOURCE_CONFLICT` | 중복 데이터 또는 현재 상태와 충돌합니다. |
| 429 | `RATE_LIMITED` | 요청 횟수 제한을 초과했습니다. |
| 500 | `INTERNAL_ERROR` | 서버 내부에서 예상하지 못한 오류가 발생했습니다. |

서버 내부 오류 응답에는 내부 예외 메시지나 stack trace를 넣지 않습니다. 서버 로그에는 `traceId`, HTTP 메서드, 경로, 상태 코드, 오류 코드가 구조화된 JSON으로 기록되며 내부 오류는 서버 로그에만 stack trace를 남깁니다.
