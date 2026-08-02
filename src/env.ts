export interface MonitorConfig {
	host: string;
	port: number;
	retryDelayMs: number;
	loginIntervalMs: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): MonitorConfig {
	return {
		host: env.HOST ?? '0.0.0.0',
		port: parsePort(env.PORT ?? '9464'),
		retryDelayMs: 30_000,
		loginIntervalMs: parseLoginInterval(env.MERCEDES_LOGIN_INTERVAL_MS ?? `${12 * 60 * 60 * 1000}`),
	};
}

export function readAuthConfigFromEnv(env: NodeJS.ProcessEnv = process.env) {
	return {
		deviceId: requiredEnv(env, 'MERCEDES_DEVICE_ID'),
		email: requiredEnv(env, 'MERCEDES_EMAIL'),
		password: requiredEnv(env, 'MERCEDES_PASSWORD'),
	};
}

function parsePort(value: string): number {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error('PORT must be an integer between 1 and 65535');
	}
	return port;
}

function parseLoginInterval(value: string): number {
	const interval = Number(value);
	if (!Number.isSafeInteger(interval) || interval < 1 || interval > 2_147_483_647) {
		throw new Error('MERCEDES_LOGIN_INTERVAL_MS must be an integer between 1 and 2147483647');
	}
	return interval;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} environment variable is required`);
	return value;
}
