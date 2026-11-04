# 데이터베이스와 저장소 정책

## 선택

PostgreSQL 17을 기본 데이터베이스로 사용하고 TypeORM 0.3을 NestJS 저장소 어댑터로 사용합니다. PostgreSQL은 계정·세션 간 외래 키와 고유 제약을 제공하고, 이후 서비스 도메인에서 필요한 트랜잭션과 관계형 조회를 지원합니다. TypeORM은 현재 NestJS 구성과 통합되고 엔티티 및 명시적 migration으로 스키마 변경을 관리할 수 있습니다.

런타임 자동 스키마 동기화(`synchronize`)는 끕니다. 스키마 변경은 리뷰 가능한 migration으로만 적용하고, migration 실행은 `npm run migration:run`, 마지막 migration 되돌리기는 `npm run migration:revert`를 사용합니다.

## 연결 정보와 비밀 관리

애플리케이션은 `DATABASE_URL`로 PostgreSQL에 연결합니다. 로컬 개발 값은 `.env.example`과 Docker Compose에 제공하며, 실제 운영 URL과 비밀번호는 배포 환경의 비밀 저장소에서 주입합니다. 실제 `.env`와 운영 자격 증명은 저장소에 커밋하지 않습니다.

NestJS가 시작될 때 TypeORM DataSource 초기화가 완료되어야 앱이 준비됩니다. 연결이 불가능하면 TypeORM 초기화가 실패하며 서버는 정상 시작하지 않습니다. `GET /health`는 실행 중인 DB에 `SELECT 1`을 보내 연결 상태를 확인합니다.

## 핵심 테이블과 관계

| 테이블 | 목적 | 관계와 제약 |
| --- | --- | --- |
| `users` | 사용자와 이메일 인증 상태 | 이메일은 nullable이며 값이 있으면 유일 |
| `auth_identities` | OAuth 제공자 계정 연결 | 사용자 FK, `(provider, provider_subject)` 유일 |
| `auth_sessions` | refresh token 해시와 세션 수명 | 사용자 FK, 토큰 해시 유일 |
| `auth_challenges` | 이메일 인증·비밀번호 재설정 challenge | 사용자 FK(nullable), 이메일/목적 조회 인덱스 |

사용자 삭제 시 연결된 OAuth identity, 세션, challenge는 외래 키의 `ON DELETE CASCADE`로 함께 삭제합니다. 현재 API에는 계정 삭제 동작이 없습니다. 세션 폐기는 행을 삭제하지 않고 `revoked_at`에 기록해 재사용을 차단합니다. 소비되었거나 만료된 challenge는 30일, 폐기되었거나 만료된 세션은 90일 보관 후 정리 대상입니다. 현재 정리 작업은 자동화되어 있지 않으므로 운영 배포 전에 정기 정리 작업을 연결해야 합니다.

## 저장소 경계와 트랜잭션

도메인/애플리케이션 서비스는 TypeORM의 `Repository`, query builder, SQL을 직접 사용하지 않습니다. 서비스는 저장소 포트에 의존하고 TypeORM 어댑터가 데이터베이스 질의를 소유합니다. 이를 통해 DB 호출 방식과 업무 규칙을 분리합니다.

여러 행이 함께 상태를 바꾸는 작업은 하나의 DB 트랜잭션으로 처리합니다. 이메일 challenge 소비와 사용자 인증 완료, 비밀번호 challenge 소비·비밀번호 변경·전체 세션 폐기, OAuth 사용자와 identity 생성은 모두 함께 성공하거나 롤백되어야 합니다. refresh token 회전은 기존 토큰 해시를 조건으로 한 단일 원자적 갱신 쿼리로 동시 재사용을 막습니다. 이메일 발송은 DB 트랜잭션 밖에서 실행하며, 발송 실패 시 재요청이 가능하도록 저장된 challenge를 보존합니다.

## 로컬 DB

```bash
docker compose up -d database
npm run migration:run
```

로컬 데이터를 초기화하려면 `docker compose down -v`로 Compose 볼륨을 제거한 뒤 DB를 다시 시작하고 migration을 적용합니다. 이 명령은 로컬 DB 데이터를 삭제합니다.
