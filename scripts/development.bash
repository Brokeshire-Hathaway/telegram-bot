#!/usr/bin/env bash

scriptdir="$(dirname "$0")"
cd "$scriptdir"

./get_chroma.bash
docker compose -p ember-engine_dev -f ../docker-compose.develop.yml stop
docker compose -p ember-engine_dev -f ../docker-compose.develop.yml up
