#!/usr/bin/env bash

./get_chroma.bash
docker compose -f docker-compose.develop.yml up
