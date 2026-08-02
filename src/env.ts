import type { Token } from '@jakobgoerke/mercedes-benz-client';

export interface MonitorConfig {
	host: string;
	port: number;
	retryDelayMs: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): MonitorConfig {
	return {
		host: env.HOST ?? '0.0.0.0',
		port: parsePort(env.PORT ?? '9464'),
		retryDelayMs: 30_000,
	};
}

export function readAuthConfigFromEnv(env: NodeJS.ProcessEnv = process.env) {
	const token = {
		accessToken: requiredEnv(env, 'MERCEDES_ACCESS_TOKEN'),
		refreshToken: requiredEnv(env, 'MERCEDES_REFRESH_TOKEN'),
		expiresAt: requiredTimestamp(env, 'MERCEDES_EXPIRES_AT'),
	} satisfies Token;

	return {
		deviceId: requiredEnv(env, 'MERCEDES_DEVICE_ID'),
		token,
	};
}

function parsePort(value: string): number {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		throw new Error('PORT must be an integer between 1 and 65535');
	}
	return port;
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`${name} environment variable is required`);
	return value;
}

function requiredTimestamp(env: NodeJS.ProcessEnv, name: string): number {
	const value = Number(requiredEnv(env, name));
	if (!Number.isFinite(value)) throw new Error(`${name} must be a finite Unix timestamp in milliseconds`);
	return value;
}
