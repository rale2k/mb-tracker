import type { AttributeValue, VehicleUpdate } from '@jakobgoerke/mercedes-benz-client';

export type GaugeValue = number | boolean;

export interface VehicleState {
	readonly vin: string;
	readonly attributes: ReadonlyMap<string, GaugeValue>;
	readonly lastUpdateTimestampSeconds: number;
	readonly lastFullUpdateTimestampSeconds?: number;
	readonly updateCount: number;
	readonly fullUpdateCount: number;
}

export class VehicleStateStore {
	private readonly states = new Map<string, VehicleState>();

	public apply(update: VehicleUpdate): VehicleState | undefined {
		if (!update.vin) return undefined;

		const previous = this.states.get(update.vin);
		const attributes = update.fullUpdate
			? new Map<string, GaugeValue>()
			: new Map(previous?.attributes ?? []);

		for (const [name, value] of Object.entries(update.attributes ?? {})) {
			if (isGaugeValue(value)) attributes.set(name, value);
			else attributes.delete(name);
		}

		const timestampSeconds = timestampSecondsFor(update);
		const state: VehicleState = {
			vin: update.vin,
			attributes,
			lastUpdateTimestampSeconds: timestampSeconds,
			lastFullUpdateTimestampSeconds: update.fullUpdate
				? timestampSeconds
				: previous?.lastFullUpdateTimestampSeconds,
			updateCount: (previous?.updateCount ?? 0) + 1,
			fullUpdateCount: (previous?.fullUpdateCount ?? 0) + (update.fullUpdate ? 1 : 0),
		};

		this.states.set(update.vin, state);
		return state;
	}

	public values(): IterableIterator<VehicleState> {
		return this.states.values();
	}
}

function isGaugeValue(value: AttributeValue): value is GaugeValue {
	return typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

function timestampSecondsFor(update: VehicleUpdate): number {
	const timestamp = update.emittedAt?.getTime();
	return timestamp !== undefined && Number.isFinite(timestamp) ? timestamp / 1000 : Date.now() / 1000;
}
