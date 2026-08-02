# mb-tracker

Mercedes-Benz vehicle stream data monitor.
Simple service listening to vehicle data updates and exposing them through a Prometheus api.

The repository also contains a simple grafana and prometheus deployment setup, with a preconfigured dashboard for monitoring metrics exposed via the api from a 2019 C-Class. Available data amount may be different for each vehicle depending on the spec.

[Example here](./docs/grafana.png)

The Grafana dashboard uses `VINCODE` as the VIN placeholder. Which should be replaced.

## Monitor

Build and run the monitor from the repository root:

```sh
yarn monitor
```

The monitor serves:

- `http://localhost:9464/metrics`
- `http://localhost:9464/health`

Set `PORT` to use a different port.

Provide the authentication environment variables before starting the monitor:

```sh
export MERCEDES_DEVICE_ID='...'
export MERCEDES_ACCESS_TOKEN='...'
export MERCEDES_REFRESH_TOKEN='...'
export MERCEDES_EXPIRES_AT=''
```

The neccessary credentials can be obtained by using [jakobgoerkes login script](https://github.com/jakobgoerke/mercedes-benz-client/blob/main/scripts/login.ts).

Alternatively, just use Docker:
```
docker build --platform linux/arm64 -t mb-tracker:latest .
```

```
docker run -d \
  --name mb-tracker \
  --restart unless-stopped \
  -p 9464:9464 \
  -e MERCEDES_DEVICE_ID="YOUR_DEVICE_ID" \
  -e MERCEDES_ACCESS_TOKEN="YOUR_ACCESS_TOKEN" \
  -e MERCEDES_REFRESH_TOKEN="YOUR_REFRESH_TOKEN" \
  -e MERCEDES_EXPIRES_AT="YOUR_EXPIRES_AT_IN_MILLISECONDS" \
  mb-tracker:latest
```
or set vars in [docker-compose.yml](./docker-compose.yml) and use Docker compose.

```
docker compose up -d --build
```

## Metric examples

Vehicle attributes keep their raw valid names and use only the VIN label:

```text
odo{vin="W..."} 12345
averageSpeedStart{vin="W..."} 42
tirepressureFrontLeft{vin="W..."} 2.4
```

Boolean attributes are exported as `0` or `1`. Null attributes remove the sample and structured attributes are skipped. Operational metrics include:

```text
stream_connected 1
last_update_timestamp_seconds{vin="W..."} 1730000000
updates_total{vin="W..."} 12
full_updates_total{vin="W..."} 1
```

## Credits
 * [ReneNulschDE/mbapi2020](https://github.com/ReneNulschDE/mbapi2020) 
  -- all of the underlying work reverse engineering the MB API
 * [TA2k/ioBroker.mercedesme](https://github.com/TA2k/ioBroker.mercedesme)
 -- protobuf definitions
 * [jakobgoerke/mercedes-benz-client](https://github.com/jakobgoerke/mercedes-benz-client) 
 -- formalizing the previous 2 works into a neat javascript library
