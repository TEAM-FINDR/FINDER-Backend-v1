# 도메인 이벤트와 예약 작업

## 처리 경계

HTTP 요청은 변경 유효성 확인과 도메인 저장까지만 동기 처리합니다. 프로필·기회 저장소는 변경과 같은 PostgreSQL 트랜잭션에서 outbox 이벤트를 기록합니다. Eligibility 재계산, 상태 변경 알림, 외부 메일·푸시 전달은 outbox worker가 비동기로 수행합니다.

| 이벤트 | 소비 작업 |
| --- | --- |
| `profile.changed` | 저장 프로필을 사용하는 자격 판정 재계산 |
| `opportunity.changed` | 저장 사용자들의 자격 판정 재계산 및 마감 일정 갱신 |
| `eligibility.changed` | 판정 상태가 실제로 바뀐 경우 사용자 알림 생성 |
| `notification.requested` | 사용자 환경설정에 맞춰 알림 센터·메일·푸시 전달 |
| `deadline.reminder` | D-7, D-3, D-1 마감 알림 전달 |

재계산 결과가 이전 상태와 같으면 `eligibility.changed` 및 알림을 만들지 않습니다. 저장소에서 원본 변경과 outbox 기록을 같은 트랜잭션에 묶어야 합니다. 외부 전송은 이 트랜잭션에 포함하지 않습니다.

TypeORM 저장소 어댑터는 aggregate 저장에 사용 중인 `EntityManager`를 `TypeOrmEventOutboxRepository.enqueueInTransaction(manager, event)`에 전달합니다. Service에서 aggregate 저장이 끝난 뒤 `DomainEventPublisher.publish()`를 호출하면 두 변경이 분리되므로 producer의 원자성 경로로 사용하지 않습니다.

## 영속성과 중복 처리

PostgreSQL `domain_event_outbox`를 작업 저장소로 사용합니다. 별도 Redis나 메시지 브로커가 없어도 기존 DB만으로 이벤트가 보존되고, worker 다중 실행은 `FOR UPDATE SKIP LOCKED`와 처리 lease로 분산합니다. 전달 보장은 at-least-once입니다. 이벤트 `eventKey`와 알림 `dedupeKey`에 고유 제약을 둡니다. 이벤트 handler는 `eventKey`를 기준으로 중복 실행에도 결과가 한 번만 반영되게 작성합니다.

Worker는 작업을 claim할 때 시도 횟수를 늘리고 lease 만료 작업은 다시 claim합니다. 실패는 최대 8회까지 지수 backoff로 재시도하고, 마지막 오류와 시각을 저장합니다. 한도를 넘긴 작업은 `dead` 상태로 남아 조사할 수 있습니다. 재시도 주기는 1초부터 시작해 최대 30분으로 제한합니다.

실패 작업은 다음 조회로 확인합니다.

```sql
SELECT id, event_key, event_type, attempts, last_error, created_at
FROM domain_event_outbox
WHERE status = 'dead'
ORDER BY created_at DESC;
```

## 자격 재분석

프로필·기회 저장소는 변경 버전을 포함한 고유 event key로 이벤트를 기록합니다. Eligibility 소비자는 영향을 받는 사용자/기회 쌍을 다시 계산하고 이전 판정과 비교합니다. 판정이 달라졌을 때만 알림을 요청하며, 알림의 dedupe key는 사용자·기회·새 판정 버전을 포함합니다.

## 마감 예약

마감 기준 시간대는 `APP_TIME_ZONE`(기본 `Asia/Seoul`)의 달력 날짜입니다. D-7/D-3/D-1 알림은 각각 마감일 기준 해당 일수 전 오전 9시에 예약합니다. 예약 key는 사용자·기회·마감 시각·남은 일수 조합으로 고유하게 생성합니다.

예약 후보 조회는 저장 목록, 기회 마감일, 마감 알림 환경설정을 함께 확인합니다. 푸시 후보는 활성 기기가 있을 때만 포함합니다. worker가 실제 전달 직전에 설정과 활성 기기 상태를 다시 확인해, 예약 이후 사용자가 설정을 끄거나 기기를 해제한 경우 발송하지 않습니다. 사용 가능한 채널이 하나도 없는 대상은 예약하지 않습니다.

## 공급자 경계와 운영

메일·푸시 provider는 `EmailDeliveryProvider`, `PushDeliveryProvider` 계약 뒤에 둡니다. 알림 업무 흐름은 공급자별 SDK를 직접 사용하지 않습니다. 외부 공급자의 idempotency key 지원을 우선 사용하고, 지원하지 않는 전송은 실패 후 재시도 시 중복 전달 가능성이 남으므로 attempt와 provider 응답 식별자를 기록합니다.

Profile, Opportunity, Saved, Eligibility, Notification 설정·기기 데이터 저장소는 현재 기능 API 구현 범위에 따라 각 도메인 모듈에서 제공합니다. 해당 저장소가 준비되면 이벤트 producer와 마감 후보 source를 연결합니다. source나 provider port 구현이 등록되지 않은 기능은 시작 로그에 비활성 상태를 남깁니다. 새 소비자를 추가할 때는 소유 모듈이 handler를 등록하고 `EventsModule`은 도메인 모듈을 import하지 않습니다.
