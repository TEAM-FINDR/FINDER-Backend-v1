export interface EmailDeliveryRequest {
  recipient: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export abstract class EmailDeliveryProvider {
  abstract send(request: EmailDeliveryRequest): Promise<void>;
}
