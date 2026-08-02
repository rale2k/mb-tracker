import { MercedesBenzClient, VehicleEventStream } from '@jakobgoerke/mercedes-benz-client';

import { readAuthConfigFromEnv, readConfig } from './env.js';
import { createHttpServer, listen } from './http.js';
import { PrometheusMetrics } from './metrics.js';
import { VehicleStateStore } from './state.js';

async function main(): Promise<void> {
	const config = readConfig();
	const auth = readAuthConfigFromEnv();
	const client = new MercedesBenzClient({ deviceId: auth.deviceId, token: auth.token });
	const stream = new VehicleEventStream(client);
	const stateStore = new VehicleStateStore();
	const metrics = new PrometheusMetrics();
	let streamIsConnected = false;
	let stopping = false;

	stream.on('connected', () => {
		streamIsConnected = true;
		metrics.setStreamConnected(true);
	});
	stream.on('disconnected', () => {
		streamIsConnected = false;
		metrics.setStreamConnected(false);
	});
	stream.on('error', (error) => {
		console.error(`stream error: ${error.message}`);
	});
	stream.on('update', (update) => {
		const state = stateStore.apply(update);
		if (state) metrics.observe(state, update.fullUpdate);
	});

	const server = createHttpServer(metrics, () => streamIsConnected);
	const shutdown = (): void => {
		if (stopping) return;
		stopping = true;
		stream.close();
		server.close();
	};

	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);
	metrics.setStreamConnected(false);
	await listen(server, config.host, config.port);
	console.log(`listening on ${config.host}:${config.port}`);

	while (!stopping) {
		try {
			await stream.connect();
			return;
		} catch {
			console.error('stream connection failed; retrying');
			await delay(config.retryDelayMs);
		}
	}
}

function delay(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error: unknown) => {
	console.error(`failed to start: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
