#!/usr/bin/env bash

CHROMA_RELEASE_VERSION=0.4.10
if [ ! -d "./../chroma" ]; then
    git clone -b release/$CHROMA_RELEASE_VERSION https://github.com/chroma-core/chroma.git ../chroma
fi
