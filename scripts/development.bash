#!/usr/bin/env bash

scriptdir="$(dirname "$0")"
cd "$scriptdir"

./get_chroma.bash
docker compose -f ../docker-compose.develop.yml up
