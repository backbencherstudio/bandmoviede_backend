import appConfig from '../../../../config/app.config';
import { Fetch } from '../../Fetch';

export class PaypalPayment {
  private static get config() {
    const c = appConfig().payment.paypal;
    return { clientId: c.client_id, secret: c.secret, api: c.api };
  }

  private static async getAccessToken(): Promise<string> {
    const { clientId, secret, api } = this.config;

    if (!clientId || !secret) {
      console.error('PayPal Config Missing:', {
        clientId: clientId ? 'PRESENT' : 'MISSING',
        secret: secret ? 'PRESENT' : 'MISSING',
        api,
      });
      throw new Error(
        'PayPal client_id or secret is missing. Check .env file.',
      );
    }

    const token = Buffer.from(`${clientId}:${secret}`).toString('base64');

    try {
      const response = await Fetch.post(
        `${api}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      return response.data.access_token;
    } catch (error) {
      console.error(
        'PayPal Access Token Error:',
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  // --- Checkout Methods ---

  static async createOrder(
    amount: number,
    currency: string = 'USD',
    returnUrl?: string,
    cancelUrl?: string,
  ) {
    const { api } = this.config;
    const accessToken = await this.getAccessToken();

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: 'PAY_NOW',
            return_url:
              returnUrl || `${appConfig().app.client_app_url}/checkout/success`,
            cancel_url:
              cancelUrl || `${appConfig().app.client_app_url}/checkout/cancel`,
          },
        },
      },
    };

    const response = await Fetch.post(`${api}/v2/checkout/orders`, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  static async captureOrder(orderId: string) {
    const { api } = this.config;
    const accessToken = await this.getAccessToken();

    const response = await Fetch.post(
      `${api}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data;
  }

  // --- Payout Methods ---

  static async sendPayout(
    recipientEmail: string,
    amount: string,
    currency: string = 'USD',
  ) {
    const { api } = this.config;
    const accessToken = await this.getAccessToken();

    const body = {
      sender_batch_header: {
        sender_batch_id: `batch-${Date.now()}`,
        email_subject: 'You have a payment',
        email_message: 'You have received a payment',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: amount,
            currency,
          },
          receiver: recipientEmail,
          note: 'Thanks for your great service!',
          sender_item_id: `item-${Date.now()}`,
        },
      ],
    };

    const response = await Fetch.post(`${api}/v1/payments/payouts`, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  static async getPayoutStatus(batchId: string) {
    const { api } = this.config;
    const accessToken = await this.getAccessToken();

    const response = await Fetch.get(`${api}/v1/payments/payouts/${batchId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  }
}
