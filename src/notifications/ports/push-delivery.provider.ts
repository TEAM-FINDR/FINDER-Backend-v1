export interface PushDeliveryRequest {
  deviceTokens: string[];
  title: string;
  body: string;
  idempotencyKey: string;
}

export abstract class PushDeliveryProvider {
  abstract send(request: PushDeliveryRequest): Promise<void>;
}
