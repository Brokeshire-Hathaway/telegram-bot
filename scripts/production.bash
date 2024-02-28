#!/usr/bin/env bash

scriptdir="$(dirname "$0")"
cd "$scriptdir"

#rm -rf ../chroma
./get_chroma.bash
docker compose -p ember-engine-prod -f ../docker-compose.production.yml up -d
