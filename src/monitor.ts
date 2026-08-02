import { MercedesBenzClient, VehicleEventStream } from '@jakobgoerke/mercedes-benz-client';

import { readAuthConfigFromEnv, readConfig } from './env.js';
import { createHttpServer, listen } from './http.js';
import { PrometheusMetrics } from './metrics.js';
import { VehicleStateStore } from './state.js';

async function main(): Promise<void> {
	const config = readConfig();
	console.log(`starting monitor: host=${config.host} port=${config.port} retry_delay_ms=${config.retryDelayMs}`);
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
		console.log('vehicle event stream connected');
	});
	stream.on('disconnected', (reason) => {
		streamIsConnected = false;
		metrics.setStreamConnected(false);
		console.warn(`vehicle event stream disconnected: ${reason || 'unknown reason'}`);
	});
	stream.on('error', (error) => {
		console.error(`stream error: ${error.message}`);
	});
	stream.on('assignedVehicles', (vins) => {
		console.log(`assigned vehicles: count=${vins.length} vins=${vins.join(',') || 'none'}`);
	});
	stream.on('update', (update) => {
		const attributeCount = Object.keys(update.attributes ?? {}).length;
		console.log(
			`vehicle update: vin=${update.vin || 'unknown'} type=${update.fullUpdate ? 'full' : 'partial'} attributes=${attributeCount}`,
		);
		const state = stateStore.apply(update);
		if (!state) {
			console.warn('vehicle update ignored: missing VIN');
			return;
		}
		metrics.observe(state, update.fullUpdate);
	});

	const server = createHttpServer(metrics, () => streamIsConnected);
	const shutdown = (): void => {
		if (stopping) return;
		stopping = true;
		console.log('shutting down monitor');
		stream.close();
		server.close();
	};

	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);
	metrics.setStreamConnected(false);
	await listen(server, config.host, config.port);
	console.log(`HTTP server listening: host=${config.host} port=${config.port}`);

	let connectionAttempt = 0;
	while (!stopping) {
		connectionAttempt++;
		console.log(`connecting to vehicle event stream: attempt=${connectionAttempt}`);
		try {
			await stream.connect();
			return;
		} catch (error: unknown) {
			console.error(
				`stream connection failed: ${error instanceof Error ? error.message : String(error)}; retrying in ${config.retryDelayMs}ms`,
			);
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
