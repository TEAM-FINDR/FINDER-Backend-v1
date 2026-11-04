# FINDR Backend

FINDR 앱과 웹에서 함께 사용하는 NestJS API 서버입니다.

## 요구 사항

- Node.js 24 이상
- npm 11 이상

## 설치 및 로컬 실행

```bash
npm install
```

`.env.example`을 복사해 `.env`를 만들고 필요한 값을 설정합니다.

```bash
cp .env.example .env
npm run start:dev
```

Windows PowerShell에서는 환경 파일을 복사할 때 다음 명령을 사용할 수 있습니다.

```powershell
Copy-Item .env.example .env
npm run start:dev
```

## 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `NODE_ENV` | `development` | 실행 환경: `development`, `test`, `production` |
| `PORT` | `3000` | HTTP 서버 포트. 1~65535 정수여야 합니다. |
| `CORS_ORIGINS` | 빈 값 | 브라우저 요청을 허용할 출처 목록. 여러 출처는 쉼표로 구분합니다. |

`CORS_ORIGINS`에는 경로가 없는 정확한 출처를 입력합니다. 예: `https://app.example.com,http://localhost:5173`. 비워 두면 브라우저 교차 출처 요청을 허용하지 않습니다. 네이티브 앱 요청에는 브라우저 CORS가 적용되지 않습니다.

환경 변수 값이 유효하지 않으면 서버는 시작하지 않습니다. 실제 비밀 값이 포함된 `.env` 파일은 저장소에 커밋하지 마세요.

## 주요 경로

- `GET /health`: 서버 상태 확인
- `/api/v1`: 버전이 지정된 API 경로의 공통 prefix
- `/docs`: OpenAPI 문서와 Swagger UI
- `/docs-json`: OpenAPI JSON 문서

## 빌드 및 실행

```bash
npm run build
npm run start:prod
```

개발 모드에서는 `npm run start:dev`를 사용합니다.
