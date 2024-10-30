#!/bin/bash
#Thanks to https://paravoce.bearblog.dev/how-do-you-deploy-in-10-seconds/
TMP_DIR=$(mktemp -d)
env GOOS=linux go build -o "${TMP_DIR}/rss"
./build.sh

scp -r static ansible@linode1:
scp "${TMP_DIR}/rss" ansible@linode1:

ssh ansible@linode1 '
    sudo systemctl stop rss && \
    sudo rm -rf /home/_rss/static && \
    sudo mv static /home/_rss/ && \
    sudo mv rss /home/_rss/ && \
    sudo chown -R _rss:_rss /home/_rss/* && \
    sudo systemctl start rss'
