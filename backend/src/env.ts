import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  MQTT_HOST: z.string().default('emqx.dtek.co.id'),
  MQTT_PORT: z.coerce.number().default(1883),
  MQTT_USERNAME: z.string().default('pertamina-sfm'),
  MQTT_PASSWORD: z.string().default(''),
  MQTT_TOPIC_PREFIX: z.string().default('pertamina/sfm'),
  MQTT_WSS_URL: z.string().default('wss://mqtt.dtek.co.id'),
  API_PORT: z.coerce.number().default(3001),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);
