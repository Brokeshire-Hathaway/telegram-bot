#!/usr/bin/env bash

rm -rf chroma
./get_chroma.bash
docker compose -f docker-compose.production.yml up
