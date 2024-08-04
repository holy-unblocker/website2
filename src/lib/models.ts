export interface TheatreModel {
  index: number;
  id: string;
  name: string;
  category: string;
  type: string;
  src: string;
  plays: number;
  controls: string;
}

export interface UserModel {
  id: number;
  email: string;
  email_verified: boolean;
  email_verification_code: string | null;
  password_hash: string;
  admin: boolean;
  paid_until: Date;
  stripe_customer: string; // should never be null
  signup_timestamp: Date;
  signup_ip: string;
  new_email: string | null;
  new_email_verification_secret: string | null;
  password_verification_secret: string | null;
  totp_secret: string | null;
  totp_enabled: Date | null;
  totp_backup_code: string | null;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_name: string | null;
  discord_updated: Date | null;
}

export interface InvoiceModel {
  id: number;
  token: string;
  user_id: number;
  time: string; // bigint
  price: number;
  fiat_url: string | null;
  crypto_url: string | null;
  paid: boolean;
  created: Date;
}

export interface PaymentModel {
  invoice_id: string;
  subscription_id: string | null;
  user_id: number;
  tier: number;
  period_start: Date;
  period_end: Date;
  stripe_renew: boolean;
}

export interface EmailModel {
  id: number;
  send_time: Date;
  email: string;
  ip: string;
  user_id: number;
}

export interface SessionModel {
  secret: string;
  created: Date;
  ip: string;
  user_id: number;
  totp_verified: boolean;
}

export interface BanModel {
  id: number;
  created: Date;
  user_id: number | null;
  expires: Date | null;
  reason: string | null;
}
