import { createServer, type Server } from 'node:http';

import type { PrometheusMetrics } from './metrics.js';

export function createHttpServer(metrics: PrometheusMetrics, isStreamConnected: () => boolean): Server {
	return createServer(async (request, response) => {
		const startedAt = Date.now();
		const method = request.method ?? 'UNKNOWN';
		const requestPath = (request.url ?? '/').split('?', 1)[0] || '/';
		response.once('finish', () => {
			console.log(
				`HTTP request: method=${method} path=${requestPath} status=${response.statusCode} duration_ms=${Date.now() - startedAt}`,
			);
		});

		try {
			if (request.method !== 'GET') {
				sendJson(response, 405, { error: 'method not allowed' });
				return;
			}

			const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
			if (pathname === '/health') {
				sendJson(response, 200, { status: 'ok', stream_connected: isStreamConnected() });
				return;
			}

			if (pathname === '/metrics') {
				response.writeHead(200, { 'Content-Type': metrics.registry.contentType });
				response.end(await metrics.registry.metrics());
				return;
			}

			sendJson(response, 404, { error: 'not found' });
		} catch (error: unknown) {
			console.error(
				`HTTP request failed: method=${method} path=${requestPath} error=${error instanceof Error ? error.message : String(error)}`,
			);
			if (!response.headersSent) sendJson(response, 500, { error: 'internal server error' });
			else response.destroy();
		}
	});
}

export function listen(server: Server, host: string, port: number): Promise<void> {
	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, host, resolve);
	});
}

function sendJson(response: import('node:http').ServerResponse, statusCode: number, body: unknown): void {
	response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
	response.end(JSON.stringify(body));
}
