export type DeliveryClaim = {
  release(): Promise<void>;
};

export interface DeliveryDedup {
  claim(id?: string): Promise<DeliveryClaim | null>;
}
