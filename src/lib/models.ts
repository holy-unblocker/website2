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

export interface CompatModel {
  host: string;
  proxy: string;
}

export interface UserModel {
  id: number;
  email: string;
  email_verified: boolean;
  email_verification_code: string | null;
  password_hash: string;
  admin: boolean;
  signup_timestamp: Date;
  signup_ip: string;
  new_email: string | null;
  new_email_verification_secret: string | null;
  password_verification_secret: string | null;
  stripe_customer: string | null;
}

export interface PaymentModel {
  id: string;
  user_id: number;
  tier: number;
  period_start: Date;
  period_end: Date;
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
}

export interface BanModel {
  id: number;
  created: Date;
  user_id: number | null;
  expires: Date | null;
  reason: string | null;
}

export interface IpBanModel {
  id: number;
  created: Date;
  ip: string;
  expires: Date | null;
  reason: string | null;
  user_id: number | null;
}
