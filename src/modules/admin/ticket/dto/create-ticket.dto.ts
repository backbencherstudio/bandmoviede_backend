export class CreateTicketDto {
  title: string;
  description?: string;
  ticket_price: number;
  is_active: boolean;
  sold_limit: number;
  event_date: Date;
}
