#!/usr/bin/env bash

scriptdir="$(dirname "$0")"
cd "$scriptdir"

#rm -rf ../chroma
./get_chroma.bash
docker compose -p ember-engine-stage -f ../docker-compose.staging.yml up -d