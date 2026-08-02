import promClient from 'prom-client';

import type { VehicleState } from './state.js';

type PrometheusRegistry = InstanceType<typeof promClient.Registry>;
type AttributeGauge = ReturnType<typeof createAttributeGauge>;

const operationalMetricNames = new Set([
	'stream_connected',
	'last_update_timestamp_seconds',
	'last_full_update_timestamp_seconds',
	'updates_total',
	'full_updates_total',
]);

class MetricNameAllocator {
	private readonly allocated = new Map<string, string>();
	private readonly used = new Set(operationalMetricNames);

	public get(rawName: string): string {
		const existing = this.allocated.get(rawName);
		if (existing) return existing;

		const baseName = sanitizeMetricName(rawName);
		let name = baseName;
		let suffix = 2;
		while (this.used.has(name)) {
			name = `${baseName}_${suffix}`;
			suffix++;
		}

		this.allocated.set(rawName, name);
		this.used.add(name);
		return name;
	}
}

function sanitizeMetricName(rawName: string): string {
	let name = rawName.replace(/[^a-zA-Z0-9_:]/g, '_');
	if (!/^[a-zA-Z_:]/.test(name)) name = `_${name}`;
	return name || '_';
}

export class PrometheusMetrics {
	public readonly registry = new promClient.Registry();

	private readonly metricNames = new MetricNameAllocator();
	private readonly attributeMetrics = new Map<string, AttributeGauge>();
	private readonly streamConnected = new promClient.Gauge({
		name: 'stream_connected',
		help: 'Whether the Mercedes vehicle event stream is connected.',
		registers: [this.registry],
	});
	private readonly lastUpdateTimestamp = new promClient.Gauge({
		name: 'last_update_timestamp_seconds',
		help: 'Unix timestamp of the most recent vehicle update.',
		labelNames: ['vin'],
		registers: [this.registry],
	});
	private readonly lastFullUpdateTimestamp = new promClient.Gauge({
		name: 'last_full_update_timestamp_seconds',
		help: 'Unix timestamp of the most recent full vehicle update.',
		labelNames: ['vin'],
		registers: [this.registry],
	});
	private readonly updatesTotal = new promClient.Counter({
		name: 'updates_total',
		help: 'Total number of vehicle updates received.',
		labelNames: ['vin'],
		registers: [this.registry],
	});
	private readonly fullUpdatesTotal = new promClient.Counter({
		name: 'full_updates_total',
		help: 'Total number of full vehicle updates received.',
		labelNames: ['vin'],
		registers: [this.registry],
	});

	public setStreamConnected(connected: boolean): void {
		this.streamConnected.set(connected ? 1 : 0);
	}

	public observe(state: VehicleState, isFullUpdate: boolean): void {
		for (const name of state.attributes.keys()) {
			this.ensureAttributeMetric(name);
		}

		for (const [rawName, metric] of this.attributeMetrics) {
			const value = state.attributes.get(rawName);
			if (value === undefined) metric.remove({ vin: state.vin });
			else metric.set({ vin: state.vin }, typeof value === 'boolean' ? Number(value) : value);
		}

		this.lastUpdateTimestamp.set({ vin: state.vin }, state.lastUpdateTimestampSeconds);
		if (state.lastFullUpdateTimestampSeconds !== undefined) {
			this.lastFullUpdateTimestamp.set({ vin: state.vin }, state.lastFullUpdateTimestampSeconds);
		}
		this.updatesTotal.inc({ vin: state.vin });
		if (isFullUpdate) this.fullUpdatesTotal.inc({ vin: state.vin });
	}

	private ensureAttributeMetric(rawName: string): void {
		if (this.attributeMetrics.has(rawName)) return;

		const metricName = this.metricNames.get(rawName);
		this.attributeMetrics.set(rawName, createAttributeGauge(metricName, this.registry));
	}
}

function createAttributeGauge(name: string, registry: PrometheusRegistry) {
	return new promClient.Gauge({
		name,
		help: 'Mercedes vehicle scalar attribute.',
		labelNames: ['vin'],
		registers: [registry],
	});
}
