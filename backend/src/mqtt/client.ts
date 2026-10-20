import mqtt from 'mqtt';
import { env } from '../env.js';
import { handleMqttMessage, markStaleNodesOffline, STALE_CHECK_MS } from './ingest.js';

let client: mqtt.MqttClient | null = null;
let staleTimer: ReturnType<typeof setInterval> | null = null;

export function startMqttClient() {
  if (!env.MQTT_PASSWORD) {
    console.warn('[mqtt] MQTT_PASSWORD empty — skip broker connect');
    return;
  }

  const url = `mqtt://${env.MQTT_HOST}:${env.MQTT_PORT}`;
  client = mqtt.connect(url, {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    clientId: `sfm-backend-${process.pid}`,
    reconnectPeriod: 5000,
    clean: true,
  });

  client.on('connect', () => {
    const topic = `${env.MQTT_TOPIC_PREFIX}/#`;
    client?.subscribe(topic, { qos: 1 }, (err) => {
      if (err) console.error('[mqtt] subscribe failed', err);
      else console.log(`[mqtt] connected, subscribed ${topic}`);
    });
  });

  client.on('error', (err) => {
    console.error('[mqtt] error', err.message);
  });

  client.on('message', (topic, payload) => {
    if (process.env.MQTT_DEBUG === '1') {
      console.log('[mqtt]', topic, payload.toString().slice(0, 200));
    }
    void handleMqttMessage(topic, payload);
  });

  if (!staleTimer) {
    staleTimer = setInterval(() => {
      void markStaleNodesOffline();
    }, STALE_CHECK_MS);
  }
}

export function isMqttConnected() {
  return !!client?.connected;
}

export function publishCommand(deviceId: string, kind: 'valve' | 'config' | 'sync' | 'dev', payload: unknown, retain = false) {
  if (!client?.connected) {
    throw new Error('MQTT broker not connected');
  }
  const topic =
    kind === 'sync'
      ? `${env.MQTT_TOPIC_PREFIX}/${deviceId}/sync/state`
      : `${env.MQTT_TOPIC_PREFIX}/${deviceId}/command/${kind}`;
  client.publish(topic, JSON.stringify(payload), { qos: 1, retain });
  return topic;
}

export function stopMqttClient() {
  if (staleTimer) {
    clearInterval(staleTimer);
    staleTimer = null;
  }
  client?.end(true);
  client = null;
}
