# 백엔드 도메인 모듈 경계

## 기능 소유권

API 명세의 Application/Web 구분은 클라이언트별 API 목록입니다. 백엔드 모듈은 클라이언트 종류가 아니라 업무 기능을 소유합니다.

| Nest 모듈 | 소유 기능 | 소유하지 않는 기능 |
| --- | --- | --- |
| `AuthModule` | 이메일/OAuth 인증, 인증 challenge, 로그인 세션과 토큰 | 사용자 프로필 편집·조회 API |
| `UsersModule` | 계정 조회·수정·탈퇴와 계정 상태 | 자격 증명 검증과 세션 수명 관리 |
| `TermsModule` | 약관 목록·버전과 사용자 동의 기록 | 계정 인증 상태 |
| `ProfilesModule` | 프로필, 경험, 학력, 역량, 자격 정보 | 기회 데이터와 자격 판정 결과 |
| `OpportunitiesModule` | 기회 검색·상세·공유·지원 링크 및 지원 행동 기록 | 기관 마스터 정보 |
| `OrganizationsModule` | 기관 정보 조회 | 기관별 기회 검색 로직 |
| `SavedModule` | 사용자가 저장한 기회와 저장 목록 | 기회 상세 데이터 원본 |
| `EligibilityModule` | 사용자 조건과 기회 사이의 자격 판정 | 사용자 프로필 편집과 기회 편집 |
| `FinderModule` | 경로 탐색, 조건 변경 시뮬레이션, 추천 행동 | 프로필 및 기회 원본 관리 |
| `HomeModule` | 홈 화면의 사용자 맞춤 요약·조합 조회 | 조합 대상 도메인의 원본 데이터 관리 |
| `NotificationsModule` | 알림 생성·목록·읽음 상태 | 사용자의 전달 환경설정과 기기 토큰 |
| `NotificationSettingsModule` | 알림 전달 설정 조회·수정 | 알림 메시지와 발송 이력 |
| `DevicesModule` | 푸시 기기 토큰 등록·제거 | 알림 전달 설정과 메시지 본문 |

## 의존 방향

화살표의 왼쪽 모듈이 오른쪽 모듈의 공개 서비스 계약을 사용합니다.

```text
Users, Terms, Profiles, Opportunities, Saved, Eligibility,
Finder, Home, Notifications, NotificationSettings, Devices -> Auth
Opportunities -> Organizations
Saved -> Opportunities
Eligibility -> Profiles, Opportunities
Finder -> Profiles, Opportunities, Eligibility
Home -> Profiles, Opportunities, Saved, Finder, Notifications
Notifications -> NotificationSettings, Devices
```

`AuthModule`은 다른 기능 모듈을 import하지 않습니다. 인증이 필요한 모듈은 `AuthModule`이 export하는 `AccessTokenGuard`를 사용합니다. 모듈은 필요한 서비스만 export하고 소비자는 그 서비스의 공개 계약만 사용합니다. 다른 모듈의 Repository, TypeORM Entity, 데이터베이스 어댑터를 직접 주입하지 않습니다.

의존 관계는 위 방향으로만 추가합니다. 제공 모듈이 소비 모듈을 import해야 하는 요구가 생기면 기능 소유권을 다시 정하거나 읽기 전용 계약을 분리합니다. `forwardRef`로 순환 관계를 숨기지 않습니다.

## 공통 기반과 기능 코드

- `common`: 전역 오류 응답, request trace, HTTP 공통 응답·페이지네이션 같은 업무 중립 기능
- `config`: 환경 변수 검증과 런타임 설정
- `database`: TypeORM 연결, migration, 저장소 어댑터
- 기능 모듈: Controller, DTO, Service, 모듈 전용 port, Entity와 업무 규칙
- `AuthModule`: 인증과 권한 확인. 일반적인 공통 유틸리티 저장소로 사용하지 않습니다.

기능 모듈 간 공통으로 보이는 값도 실제 업무 의미가 있으면 소유 도메인에 둡니다. `common`에는 특정 업무 용어와 규칙을 넣지 않습니다.

## 신규 API 기본 패턴

각 기능은 `<domain>.module.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `dto/`, `ports/`로 시작합니다. 저장이 필요할 때만 기능 소유 Entity를 두고 저장소 계약과 TypeORM 어댑터를 추가합니다.

Controller는 경로·입력 DTO·인증 Guard를 선언하고 Service를 호출합니다. Service는 입력 검증 이후의 업무 흐름과 도메인 모듈 간 조합을 소유합니다. DTO는 HTTP 계약이며 Entity를 직접 응답으로 반환하지 않습니다. 저장소 포트는 기능에서 필요한 연산만 선언하고 TypeORM 어댑터는 DB 질의를 구현합니다.

Application과 Web의 같은 기능은 동일 Service와 데이터 규칙을 사용합니다. 요청 필드가 다르면 Controller 경계에서 별도 DTO로 변환하고, 클라이언트별 업무 규칙을 복제하지 않습니다. API 경로와 응답이 실제로 다른 경우에만 명세에 기록된 계약 차이를 Controller/DTO에 반영합니다.
