FROM node:lts-alpine

LABEL org.opencontainers.image.source=https://github.com/1RandomDev/iptables-web-ui

RUN apk add iptables xtables-addons conntrack-tools

# Create non-root user for security
RUN addgroup -g 1001 nodeapp && \
    adduser -D -u 1001 -G nodeapp nodeapp

COPY . /app
WORKDIR /app

# Set proper permissions
RUN chmod 755 /app && \
    chmod 755 /app/src && \
    chmod 755 /app/www && \
    npm install --omit=dev && \
    mkdir -p /app/data && \
    chmod 700 /app/data && \
    chown -R nodeapp:nodeapp /app/data

# Run as non-root user
USER nodeapp

VOLUME /app/data
ENTRYPOINT ["node", "src/main.js"]
